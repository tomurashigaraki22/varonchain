"use client";

import { useEffect, useState } from "react";

type RawScoreEvent = Record<string, unknown>;

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

/**
 * Extract goal count for one participant.
 *
 * Sums H1 + H2 + ET periods rather than trusting Total.Goals, because the
 * snapshot's Total can reflect mid-match state after a discarded goal.
 * The period-by-period sum is always accurate.
 */
function goalsFromParticipant(p: Record<string, unknown> | undefined): number | undefined {
  if (!p || typeof p !== "object") return undefined;

  // Sum all known period keys — this is always accurate
  let sum = 0;
  let found = false;
  for (const key of ["H1", "H2", "ET1", "ET2", "P"]) {
    const period = p[key] as Record<string, unknown> | undefined;
    const g = asNumber(period?.Goals);
    if (g != null) { sum += g; found = true; }
  }
  if (found) return sum;

  // Fallback to Total.Goals only if no period data at all
  const total = p.Total as Record<string, unknown> | undefined;
  const fromTotal = asNumber(total?.Goals);
  if (fromTotal != null) return fromTotal;

  return undefined;
}

/**
 * Scan an array of TxLINE score events and return the definitive final score.
 *
 * Priority:
 *   1. The `game_finalised` event's Score (authoritative end-of-match total)
 *   2. The `halftime_finalised` event's Score (for half-time display)
 *   3. The most recent event that carries a Score with Goals data
 *
 * We sum H1 + H2 (+ ET periods) from the Score object rather than trusting
 * Total.Goals, because the snapshot may carry a mid-game Total that hasn't
 * been rolled back after a discarded goal.
 */
function extractScore(events: RawScoreEvent[]): { home?: number; away?: number } {
  // Pass 1: look for game_finalised with a Score (highest priority)
  for (let i = events.length - 1; i >= 0; i--) {
    const raw = events[i];
    const action = String(raw.Action ?? raw.action ?? "").toLowerCase();
    if (action !== "game_finalised" && action !== "halftime_finalised") continue;
    const scoreObj = (raw.Score ?? raw.score) as Record<string, unknown> | undefined;
    if (!scoreObj) continue;
    const p1 = scoreObj.Participant1 as Record<string, unknown> | undefined;
    const p2 = scoreObj.Participant2 as Record<string, unknown> | undefined;
    const home = goalsFromParticipant(p1);
    const away = goalsFromParticipant(p2);
    if (home != null || away != null) return { home: home ?? 0, away: away ?? 0 };
  }

  // Pass 2: most recent event with a Score
  for (let i = events.length - 1; i >= 0; i--) {
    const raw = events[i];
    const scoreObj = (raw.Score ?? raw.score) as Record<string, unknown> | undefined;
    if (!scoreObj || typeof scoreObj !== "object") continue;
    const p1 = scoreObj.Participant1 as Record<string, unknown> | undefined;
    const p2 = scoreObj.Participant2 as Record<string, unknown> | undefined;
    const home = goalsFromParticipant(p1);
    const away = goalsFromParticipant(p2);
    if (home != null || away != null) return { home: home ?? 0, away: away ?? 0 };
  }

  return {};
}

function latestPhase(events: RawScoreEvent[]): { label: string; live: boolean } | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const raw = events[i];
    const action = String(raw.Action ?? raw.action ?? "").toLowerCase();
    // game_finalised (statusId=100) is the definitive end-of-match record
    if (action === "game_finalised" || action.includes("game_final")) return { label: "Full time", live: false };
    if (action.includes("final")) return { label: "Full time", live: false };
    if (action === "halftime_finalised" || action.includes("halftime_final")) return { label: "Half time", live: false };
    if (action.includes("half")) return { label: "Half time", live: false };
    if (action.includes("kickoff") || action.includes("start")) return { label: "In play", live: true };
    // status events carry StatusId — H1=2, H2=4 = in play; HT=3 = halftime; F=5 = finished
    if (action === "status") {
      const sid = Number((raw.Data as Record<string, unknown> | undefined)?.StatusId ?? raw.StatusId ?? 0);
      if (sid === 5 || sid === 10 || sid === 13) return { label: "Full time", live: false };
      if (sid === 3 || sid === 8) return { label: "Half time", live: false };
      if (sid === 2 || sid === 4 || sid === 7 || sid === 9) return { label: "In play", live: true };
    }
  }
  return null;
}

export function MatchHeader({
  label,
  fixtureId,
  fixture,
  events,
}: {
  label: string;
  fixtureId?: number;
  /** The raw fixture object — carries Participant1Score/Participant2Score for finished matches */
  fixture?: Record<string, unknown>;
  events: RawScoreEvent[];
}) {
  const parts = label.split(" vs ");
  const home = parts[0] ?? "Home";
  const away = parts[1] ?? "Away";

  // Score from live events (goal counts from Score.ParticipantN.Total.Goals)
  const eventScore = extractScore(events);

  // Snapshot fallback — same extraction applied to the scores/snapshot response
  const [snapshotScore, setSnapshotScore] = useState<{ home?: number; away?: number } | null>(null);

  useEffect(() => {
    if (!fixtureId) return;
    let cancelled = false;
    fetch(`/api/txline/proxy/scores/snapshot/${fixtureId}`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (cancelled) return;
        const items = Array.isArray(data) ? data : [data];
        const extracted = extractScore(items as RawScoreEvent[]);
        if (extracted.home != null || extracted.away != null) {
          setSnapshotScore(extracted);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fixtureId]);

  // Priority: live event stream > snapshot
  const { home: homeScore, away: awayScore } =
    (eventScore.home != null || eventScore.away != null) ? eventScore : (snapshotScore ?? {});

  const phase = latestPhase(events);

  return (
    <div className="relative overflow-hidden border-b border-border bg-dot-grid">
      {/* Subtle glow behind the scoreline */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 120% at 50% 100%, rgba(205,254,0,0.05), transparent 70%)",
        }}
        aria-hidden
      />

      <div className="relative px-4 py-4 sm:px-8 sm:py-6">
        {/* Phase badge */}
        {phase ? (
          <div className="mb-4 flex justify-center">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest ${
                phase.live
                  ? "border-accent/30 bg-accent-dim text-accent"
                  : "border-border bg-surface text-text-dim"
              }`}
            >
              {phase.live && (
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" />
              )}
              {phase.label}
            </span>
          </div>
        ) : (
          <div className="mb-4 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-text-dimmer">
              Scheduled
            </span>
          </div>
        )}

        {/* Scoreline — three columns: home | score | away */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          {/* Home team */}
          <div className="flex flex-col items-end gap-1">
            <span className="text-right font-display text-sm font-bold leading-tight text-text sm:text-base lg:text-lg">
              {home}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-text-dimmer">
              Home
            </span>
          </div>

          {/* Score display */}
          <div className="flex flex-col items-center gap-1">
            <span className="font-display text-[clamp(2rem,8vw,3.5rem)] font-extrabold tabular-nums leading-none tracking-tight text-text">
              {homeScore ?? "–"}
              <span className="mx-2 text-text-dimmer">:</span>
              {awayScore ?? "–"}
            </span>
            {homeScore == null && awayScore == null && (
              <span className="font-mono text-[9px] text-text-dimmer">Awaiting data</span>
            )}
          </div>

          {/* Away team */}
          <div className="flex flex-col items-start gap-1">
            <span className="font-display text-sm font-bold leading-tight text-text sm:text-base lg:text-lg">
              {away}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-text-dimmer">
              Away
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
