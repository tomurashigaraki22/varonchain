/**
 * Shared soccer score/phase extraction for TxLINE score events.
 *
 * Per the TxLINE API reference (/api/scores/snapshot/{fixtureId} and
 * /api/scores/stream), goal data for soccer fixtures lives under a
 * sport-specific `ScoreSoccer` object — NOT the generic `Score` field, which
 * is shaped for American football (Touchdown/FieldGoal/Safety). The two are
 * structurally different objects; reading `Score` on a soccer fixture reads
 * the wrong (and usually absent) field entirely.
 *
 * Soccer period keys per the docs are H1, HT, H2, ET1, ET2, PE, ETTotal,
 * Total. We sum H1 + H2 (+ ET1/ET2/PE) rather than trusting Total.Goals,
 * because a snapshot's Total can lag after a discarded goal. HT/ETTotal are
 * cumulative snapshots (HT mirrors H1, ETTotal mirrors ET1+ET2) and must be
 * excluded from the sum to avoid double-counting.
 */

export type SoccerScore = { home?: number; away?: number };
export type MatchPhase = { label: string; live: boolean } | null;

type RawEvent = Record<string, unknown>;

function num(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

const INCREMENTAL_PERIODS = ["H1", "H2", "ET1", "ET2", "PE"] as const;

function goalsFromParticipant(
  p: Record<string, unknown> | undefined,
  scoreExists: boolean
): number | undefined {
  if (!p || typeof p !== "object") return scoreExists ? 0 : undefined;

  let sum = 0;
  let found = false;
  for (const key of INCREMENTAL_PERIODS) {
    const period = p[key] as Record<string, unknown> | undefined;
    const g = num(period?.Goals);
    if (g != null) {
      sum += g;
      found = true;
    }
  }
  if (found) return sum;

  const total = p.Total as Record<string, unknown> | undefined;
  const fromTotal = num(total?.Goals);
  if (fromTotal != null) return fromTotal;

  return 0;
}

function getScoreSoccerObj(raw: RawEvent): Record<string, unknown> | undefined {
  return (raw.ScoreSoccer ?? raw.scoreSoccer ?? raw.Score ?? raw.score) as
    | Record<string, unknown>
    | undefined;
}

/** Score carried by a single event, or {} if it has no usable score payload. */
export function scoreFromEvent(raw: RawEvent): SoccerScore {
  const scoreObj = getScoreSoccerObj(raw);
  if (!scoreObj || typeof scoreObj !== "object") return {};
  const p1 = scoreObj.Participant1 as Record<string, unknown> | undefined;
  const p2 = scoreObj.Participant2 as Record<string, unknown> | undefined;
  if (!p1 && !p2) return {};
  return {
    home: goalsFromParticipant(p1, !!p1) ?? 0,
    away: goalsFromParticipant(p2, !!p2) ?? 0,
  };
}

function actionOf(raw: RawEvent): string {
  return String(raw.Action ?? raw.action ?? "").toLowerCase();
}

function tsOf(raw: RawEvent): number {
  return num(raw.Ts ?? raw.ts) ?? -Infinity;
}

/**
 * IMPORTANT: /api/scores/snapshot/{fixtureId} returns one entry per DISTINCT
 * action type ("snapshots for each action in the latest score events"), not
 * a chronological log. Array position carries no meaning — a finished
 * fixture's snapshot contains BOTH its old "kickoff" entry and its
 * "game_finalised" entry side by side. Scanning by array position (as an
 * earlier version of this file did) is order-dependent and picks whichever
 * one happens to sit later in the array, independent of what actually
 * happened last — which is why finished matches were showing as "Live".
 * Everything here must instead use presence checks and each entry's own Ts,
 * never array position.
 */

/**
 * Scan an array of TxLINE score events and return the definitive score.
 * Priority: game_finalised (truly authoritative, order-independent presence
 * check — nothing else can happen after a match is finalised) > the single
 * event with the greatest Ts that carries a usable score (true recency, not
 * array position).
 *
 * halftime_finalised is deliberately NOT given the same presence-check
 * priority as game_finalised: it marks a break mid-match, not the end of
 * one. Treating it as authoritative caused the scoreboard to freeze at the
 * half-time score forever, even after second-half goals streamed in with a
 * later Ts — it's just a regular event in the recency scan below.
 */
export function extractScore(events: RawEvent[]): SoccerScore {
  const finalised = events.find((e) => actionOf(e) === "game_finalised");
  if (finalised) {
    const score = scoreFromEvent(finalised);
    if (score.home != null || score.away != null) return score;
  }

  let best: SoccerScore = {};
  let bestTs = -Infinity;
  for (const raw of events) {
    const score = scoreFromEvent(raw);
    if (score.home == null && score.away == null) continue;
    const ts = tsOf(raw);
    if (ts >= bestTs) {
      bestTs = ts;
      best = score;
    }
  }
  return best;
}

/**
 * Determine the current match phase. StatusId per the TxLINE Soccer Feed
 * docs' Game Phase Encoding table: NS=1, H1=2, HT=3, H2=4, F=5, WET=6
 * (waiting for extra time — a break), ET1=7, HTET=8 (break), ET2=9, FET=10,
 * WPE=11 (waiting for penalties — a break), PE=12, FPE=13.
 * game_finalised is checked by presence first since it's truly authoritative
 * — nothing else can happen after a match is finalised, regardless of where
 * it sits in the snapshot array. halftime_finalised is NOT given the same
 * treatment: it marks a break mid-match, not the end of one, so it must lose
 * to any later event (like a second-half kickoff or goal) once one exists.
 * Everything else — including halftime_finalised — is resolved from
 * whichever entry has the greatest Ts (truly most recent), not array
 * position.
 */
export function extractPhase(events: RawEvent[]): MatchPhase {
  if (events.some((e) => actionOf(e) === "game_finalised")) {
    return { label: "Full time", live: false };
  }

  let latest: RawEvent | null = null;
  let latestTs = -Infinity;
  for (const raw of events) {
    const ts = tsOf(raw);
    if (ts >= latestTs) {
      latestTs = ts;
      latest = raw;
    }
  }
  if (!latest) return null;

  const action = actionOf(latest);
  if (action === "halftime_finalised") return { label: "Half time", live: false };
  if (action.includes("kickoff") || action.includes("start")) return { label: "In play", live: true };

  // StatusId per the docs' Game Phase Encoding table: NS=1, H1=2, HT=3,
  // H2=4, F=5, WET=6 (waiting for ET — a break), ET1=7, HTET=8 (break),
  // ET2=9, FET=10, WPE=11 (break), PE=12, FPE=13.
  const sid = num((latest.Data as RawEvent | undefined)?.StatusId ?? latest.StatusId);
  if (sid != null) {
    if (sid === 5 || sid === 10 || sid === 13) return { label: "Full time", live: false };
    if (sid === 3 || sid === 8) return { label: "Half time", live: false };
    if (sid === 6 || sid === 11) return { label: "Break", live: false };
    if (sid === 2 || sid === 4 || sid === 7 || sid === 9 || sid === 12) return { label: "In play", live: true };
    if (sid === 1) return null; // not started
  }
  return null;
}
