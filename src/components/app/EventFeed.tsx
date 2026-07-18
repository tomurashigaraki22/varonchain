"use client";

import { useEffect, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { ShareCardModal, type ShareableMoment } from "./ShareCardModal";
import { WalletErrorModal } from "./WalletErrorModal";
import { scoreFromEvent, extractPhase } from "@/lib/txline/scoreSoccer";
import { validateStatsOnChain, type StatValidationApiResponse } from "@/lib/txline/verify";
import { friendlyWalletError } from "@/lib/txline/friendlyError";
import type { PlayerState } from "@/lib/txline/lineups";
import { Icon } from "@/components/ui/Icon";
import {
  FootballIcon,
  UserSwitchIcon,
  RacingFlagIcon,
  Timer01Icon,
  VideoReplayIcon,
  Flag01Icon,
  Shield01Icon,
  CheckmarkCircle01Icon,
  Wifi01Icon,
  WifiOff01Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons";

// ── Types ─────────────────────────────────────────────────────────────────────

type RawEvent = Record<string, unknown>;

type ScoreEvent = {
  key: string;
  actionId?: number;
  fixtureId?: number;
  seq?: number;
  action?: string;
  ts?: number;
  raw: RawEvent;
};

type VerifyState = "idle" | "checking" | "verified" | "failed";
type VerifyResult = { verified: boolean; epochDay: number; dailyScoresPda: string; ts: number };
type VerifyError = string | null;
type Tier = "key" | "marker" | "activity" | "system";

// ── Helpers ───────────────────────────────────────────────────────────────────

function num(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() && !isNaN(+v)) return +v;
  return undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function parseEvent(raw: RawEvent, idx: number): ScoreEvent {
  const fixtureId = num(raw.FixtureId ?? raw.fixtureId);
  const seq = num(raw.Seq ?? raw.seq);
  const actionId = num(raw.Id ?? raw.id);
  // Must be stable across re-parses of the SAME real event (history load,
  // live push, poll re-fetch all call parseEvent independently) — using the
  // volatile idx counter here meant the same goal/card got a different key
  // every time, which showed up as duplicate list entries AND orphaned
  // verify state (a "verified" goal reappearing under a new key looked
  // unverified again, and if auto-verify re-ran on it and happened to
  // fail, it looked like a real failure the user never triggered).
  const stableId = seq ?? actionId ?? `idx${idx}`;
  return {
    key: `${fixtureId ?? "x"}-${stableId}`,
    actionId,
    fixtureId,
    seq,
    action: str(raw.Action ?? raw.action),
    ts: num(raw.Ts ?? raw.ts),
    raw,
  };
}

/** Dedupe by stable key, incoming wins on conflict (fresher data). */
function mergeEvents(prev: ScoreEvent[], incoming: ScoreEvent[]): ScoreEvent[] {
  const byKey = new Map(prev.map((e) => [e.key, e]));
  for (const e of incoming) byKey.set(e.key, e);
  return Array.from(byKey.values()).sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
}

/**
 * Match minute from Clock.Seconds + StatusId.
 *
 * Confirmed against real captured data: Clock.Seconds is a SINGLE
 * continuously-incrementing elapsed-seconds counter for the whole match —
 * it starts at 0 at kickoff, reaches exactly 2700 (45:00) at halftime, and
 * keeps climbing through the second half (H2's own kickoff event already
 * carries Seconds:2700, it does not reset to 0). So the match minute is
 * simply floor(seconds/60) — no per-half offset/length reconstruction
 * needed, and the whole-game (not "half half") minute the docs table alone
 * doesn't make obvious.
 *
 * StatusId values per the TxLINE Soccer Feed "Game Phase Encoding" table
 * (docs): NS=1, H1=2, HT=3, H2=4, F=5, WET=6 (waiting for ET — a break, not
 * play), ET1=7, HTET=8 (ET half time — a break), ET2=9, FET=10, WPE=11
 * (waiting for penalties — a break), PE=12, FPE=13. Only H1/H2/ET1/ET2/PE
 * are active play periods with a running clock; everything else is a break
 * or terminal state and has no meaningful match-minute.
 */
function clockMin(raw: RawEvent): string | null {
  const clk = raw.Clock as Record<string, unknown> | undefined;
  if (!clk) return null;
  const secs = num(clk.Seconds);
  if (secs == null || secs < 0) return null;
  const sid = num(raw.StatusId);
  if (sid !== 2 && sid !== 4 && sid !== 7 && sid !== 9 && sid !== 12) return null;
  const min = Math.floor(secs / 60) + 1;
  return `${min}'`;
}

/** Match minute from wall-clock Ts vs fixture start */
function tsMin(ts: number | undefined, start: number | undefined): string | null {
  if (!ts || !start || start <= 0) return null;
  const min = Math.ceil((ts - start) / 60000);
  if (min <= 0 || min > 150) return null;
  return `${min}'`;
}

/** Real local wall-clock time for an event — always available, unlike the
 * best-effort match-minute estimate, so it's shown alongside every row. */
function wallClock(ts: number | undefined): string | null {
  if (!ts) return null;
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function minute(evt: ScoreEvent, start?: number): string | null {
  return clockMin(evt.raw) ?? tsMin(evt.ts, start);
}

function team(raw: RawEvent, label: string): string | null {
  const p = num(raw.Participant ?? raw.participant);
  if (p == null) return null;
  const parts = label.split(" vs ");
  return p === 1 ? (parts[0] ?? "Home") : (parts[1] ?? "Away");
}

function teamSide(raw: RawEvent): "home" | "away" | null {
  const p = num(raw.Participant ?? raw.participant);
  if (p === 1) return "home";
  if (p === 2) return "away";
  return null;
}

/** Score at the moment of a goal event: "1 – 0" */
function scoreAtGoal(raw: RawEvent): string | null {
  const { home, away } = scoreFromEvent(raw);
  if (home == null && away == null) return null;
  return `${home ?? 0} – ${away ?? 0}`;
}

// ── Classification ────────────────────────────────────────────────────────────

const SYSTEM = new Set([
  "connected","disconnected","venue","players_warming_up","players_on_the_pitch",
  "pitch","weather","lineup","lineups","referee","coverage","kit","coverage_update",
  "standby","action_amend","action_discarded","attack_possession","danger_possession",
  "high_danger_possession","safe_possession","possession","possible","throw_in",
  "goal_kick","free_kick","additional_time","clock_adjustment","comment","injury",
  "jersey","kickoff_team","shot","status",
]);

const GOALS = new Set(["goal","own_goal","penalty_goal"]);
const MARKERS = new Set(["game_finalised","halftime_finalised","kickoff"]);
// var_end = key (has a decision); var = activity (just start of review)
const KEY = new Set(["red_card","yellow_card","substitution","penalty_outcome","var_end"]);
// penalty (awarded), var (start), corner = activity
const ACTIVITY = new Set(["penalty","var","corner"]);

function classify(action?: string): Tier {
  const a = (action ?? "").toLowerCase();
  if (!a || SYSTEM.has(a)) return "system";
  if (GOALS.has(a)) return "key";
  if (MARKERS.has(a)) return "marker";
  if (KEY.has(a)) return "key";
  if (ACTIVITY.has(a)) return "activity";
  if (a.includes("card") || a.includes("substitut")) return "key";
  return "activity";
}

function statKeys(action?: string): number[] {
  const a = (action ?? "").toLowerCase();
  if (GOALS.has(a)) return [1, 2];
  if (a === "red_card") return [5, 6];
  if (a === "yellow_card") return [3, 4];
  return [1, 2];
}

const AUTO_VERIFY = new Set(["goal","own_goal","penalty_goal","red_card"]);

// ── Event card config ─────────────────────────────────────────────────────────

type CardConfig = {
  icon: React.ReactNode;
  title: string;
  detail?: string;          // e.g. team name, player, score
  scorer?: string;
  assist?: string;
  accent: "goal" | "red" | "yellow" | "var" | "none";
  verifiable: boolean;
};

/**
 * var_end.Data.Outcome is only ever "Stands" or "Overturned" per the docs —
 * it does NOT say what was under review. That comes from the Data.Type of
 * the var event that started the review (Goal/Penalty/RedCard/
 * SecondYellowCard/CornerKick/MistakenIdentity/Other). Find the nearest
 * preceding "var" event by Ts (not array position — snapshot arrays aren't
 * guaranteed ordered) to correlate them.
 */
function findVarReviewType(events: ScoreEvent[], varEndEvt: ScoreEvent): string | undefined {
  const endTs = varEndEvt.ts ?? Infinity;
  let best: ScoreEvent | undefined;
  let bestTs = -Infinity;
  for (const e of events) {
    if ((e.action ?? "").toLowerCase() !== "var") continue;
    const ts = e.ts ?? 0;
    if (ts <= endTs && ts > bestTs) {
      best = e;
      bestTs = ts;
    }
  }
  const data = best?.raw.Data as Record<string, unknown> | undefined;
  return str(data?.Type ?? data?.type);
}

const VAR_TYPE_LABELS: Record<string, string> = {
  goal: "Goal",
  penalty: "Penalty",
  redcard: "Red card",
  secondyellowcard: "Second yellow card",
  cornerkick: "Corner kick",
  mistakenidentity: "Mistaken identity",
  other: "Decision",
};

function playerName(players: PlayerState[], id: number | undefined): string | undefined {
  if (id == null) return undefined;
  // Data.PlayerId is confirmed to be normativeId, not fixturePlayerId —
  // checking both is defensive and costs nothing.
  return players.find((p) => p.fixturePlayerId === id || p.normativeId === id)?.name;
}

/**
 * Assist isn't in any documented enum for the soccer feed's goal payload —
 * these are best-effort field-name guesses, checked in order, and simply
 * omitted (not fabricated) if none resolve to a real roster player.
 */
function assistPlayerId(raw: RawEvent): number | undefined {
  const data = (raw.Data ?? raw.data) as Record<string, unknown> | undefined;
  return num(data?.AssistPlayerId ?? data?.assistPlayerId ?? data?.AssistId ?? data?.assistId);
}

function cardConfig(
  evt: ScoreEvent,
  fixtureLabel: string,
  allEvents: ScoreEvent[] = [],
  players: PlayerState[] = []
): CardConfig {
  const a = (evt.action ?? "").toLowerCase();
  const t = team(evt.raw, fixtureLabel);
  const data = evt.raw.Data as Record<string, unknown> | undefined;

  // ── Goals ──────────────────────────────────────────────────────────────────
  if (GOALS.has(a)) {
    const score = scoreAtGoal(evt.raw);
    const title = a === "own_goal" ? "Own goal" : "Goal";
    const scorer = playerName(players, num(data?.PlayerId ?? data?.playerId));
    const assist = playerName(players, assistPlayerId(evt.raw));
    return {
      icon: <Icon icon={FootballIcon} size={18} />,
      title,
      detail: [scorer ?? t, score].filter(Boolean).join("  ·  ") || t || undefined,
      scorer,
      assist,
      accent: "goal",
      verifiable: true,
    };
  }

  // ── Penalty outcome ────────────────────────────────────────────────────────
  // Docs: penalty outcomes are exactly Scored, Missed, or Retake — there is
  // no documented "Saved" value.
  if (a === "penalty_outcome") {
    const outcome = str(data?.Outcome ?? data?.outcome ?? "")?.toLowerCase() ?? "";
    const scored = outcome === "scored";
    const retake = outcome === "retake";
    const title = scored ? "Penalty scored" : retake ? "Penalty retaken" : "Penalty missed";
    return {
      icon: scored
        ? <Icon icon={FootballIcon} size={18} />
        : <Icon icon={Shield01Icon} size={18} />,
      title,
      detail: t ?? undefined,
      accent: scored ? "goal" : "none",
      verifiable: scored,
    };
  }

  // ── Red card ────────────────────────────────────────────────────────────────
  if (a === "red_card") {
    return {
      icon: (
        <span className="inline-flex h-4 w-3 rounded-[2px] bg-red-500" aria-hidden />
      ),
      title: "Red card",
      detail: t ?? undefined,
      accent: "red",
      verifiable: true,
    };
  }

  // ── Yellow card ────────────────────────────────────────────────────────────
  if (a === "yellow_card") {
    return {
      icon: (
        <span className="inline-flex h-4 w-3 rounded-[2px] bg-yellow-400" aria-hidden />
      ),
      title: "Yellow card",
      detail: t ?? undefined,
      accent: "yellow",
      verifiable: false,
    };
  }

  // ── Substitution ───────────────────────────────────────────────────────────
  if (a === "substitution") {
    const outId = num(data?.PlayerOutId ?? data?.playerOutId);
    const inId = num(data?.PlayerInId ?? data?.playerInId);
    const pOut = playerName(players, outId) ?? str(data?.PlayerOutName ?? data?.PlayerOut ?? data?.OutPlayer);
    const pIn = playerName(players, inId) ?? str(data?.PlayerInName ?? data?.PlayerIn ?? data?.InPlayer);
    const detail = pOut && pIn ? `${pOut} → ${pIn}` : t ?? undefined;
    return {
      icon: <Icon icon={UserSwitchIcon} size={17} />,
      title: "Substitution",
      detail,
      accent: "none",
      verifiable: false,
    };
  }

  // ── VAR end (decision) ─────────────────────────────────────────────────────
  // Docs: var_end.Data.Outcome is only ever "Stands" or "Overturned" — the
  // type of decision under review comes from the originating var event's
  // Data.Type (Goal/Penalty/RedCard/SecondYellowCard/CornerKick/
  // MistakenIdentity/Other), not from var_end itself.
  if (a === "var_end") {
    const outcome = str(data?.Outcome ?? data?.outcome ?? "")?.toLowerCase() ?? "";
    const overturned = outcome === "overturned";
    const reviewTypeRaw = findVarReviewType(allEvents, evt);
    const reviewLabel = reviewTypeRaw
      ? VAR_TYPE_LABELS[reviewTypeRaw.toLowerCase()] ?? reviewTypeRaw
      : "Decision";
    const title = `VAR — ${reviewLabel} ${overturned ? "overturned" : "stands"}`;
    return {
      icon: <Icon icon={VideoReplayIcon} size={17} />,
      title,
      detail: t ?? undefined,
      accent: "var",
      verifiable: false,
    };
  }

  // Fallback
  return {
    icon: <Icon icon={Clock01Icon} size={16} />,
    title: evt.action?.replace(/_/g, " ") ?? "Event",
    detail: t ?? undefined,
    accent: "none",
    verifiable: false,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Horizontal divider: ─────  HALF TIME  ───── */
function MarkerRow({
  label,
  icon,
  time,
}: {
  label: string;
  icon: React.ReactNode;
  time?: string | null;
}) {
  return (
    <li className="flex items-center gap-3 py-0.5" aria-label={label}>
      <div className="h-px flex-1 bg-border" />
      <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2/80 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-text-dim">
        {icon}
        <span>{label}</span>
        {time && <span className="text-text-dimmer">· {time}</span>}
      </span>
      <div className="h-px flex-1 bg-border" />
    </li>
  );
}

/** A single key event row in the timeline */
function EventRow({
  evt, fixtureLabel, matchStartTime, allEvents, players,
  verifyState, verifyError, verifyResult, verifyHint,
  isExpanded, onVerify, onToggleExpand, onShare,
}: {
  evt: ScoreEvent; fixtureLabel: string; matchStartTime?: number; allEvents: ScoreEvent[];
  players: PlayerState[];
  verifyState: VerifyState; verifyError: VerifyError; verifyResult?: VerifyResult; verifyHint?: string;
  isExpanded: boolean;
  onVerify(): void; onToggleExpand(): void; onShare(): void;
}) {
  const cfg = cardConfig(evt, fixtureLabel, allEvents, players);
  const min = minute(evt, matchStartTime);
  const clock = wallClock(evt.ts);
  const verified = verifyState === "verified";

  // Container accent
  const border = {
    goal: verified
      ? "border-verified/30 bg-verified/[0.04]"
      : "border-accent/25 bg-accent/[0.03]",
    red:    "border-red-500/25 bg-red-500/[0.03]",
    yellow: "border-yellow-400/20 bg-surface",
    var:    "border-border bg-surface",
    none:   "border-border bg-surface",
  }[cfg.accent];

  // Icon circle
  const iconRing = {
    goal:   verified ? "bg-verified/15 text-verified" : "bg-accent-dim text-accent",
    red:    "bg-red-500/15 text-red-400",
    yellow: "bg-yellow-400/15 text-yellow-400",
    var:    "bg-surface-2 text-text-dim",
    none:   "bg-surface-2 text-text-dim",
  }[cfg.accent];

  // Title colour
  const titleColor = {
    goal:   verified ? "text-verified" : "text-accent",
    red:    "text-red-400",
    yellow: "text-yellow-400",
    var:    "text-text",
    none:   "text-text",
  }[cfg.accent];

  return (
    <li className={`overflow-hidden rounded-xl border transition-all ${border}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Left: minute + icon stacked */}
        <div className="flex w-10 shrink-0 flex-col items-center gap-0.5">
          <span className="font-mono text-[11px] font-semibold tabular-nums text-text-dimmer leading-none">
            {min ?? "–"}
          </span>
          <span className={`flex h-8 w-8 items-center justify-center rounded-full ${iconRing}`}>
            {cfg.icon}
          </span>
        </div>

        {/* Middle: title + detail */}
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold leading-tight ${titleColor}`}>{cfg.title}</p>
          {(cfg.detail || clock) && (
            <p className="mt-0.5 truncate text-xs text-text-dim">
              {[cfg.detail, clock].filter(Boolean).join("  ·  ")}
            </p>
          )}
        </div>

        {/* Right: share (always available) + verify state (when applicable) */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button onClick={onShare}
            className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-text-dimmer transition-colors hover:border-accent/40 hover:bg-accent-dim hover:text-accent">
            Share
          </button>
          {cfg.verifiable && (
            <>
              {verifyState === "idle" && (
                <button onClick={onVerify}
                  className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-text-dimmer transition-colors hover:border-accent/40 hover:bg-accent-dim hover:text-accent">
                  Verify
                </button>
              )}
              {verifyState === "checking" && (
                <span title={verifyHint} className="flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-0.5 font-mono text-[9px] text-warning">
                  <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-warning border-t-transparent" />
                  {verifyHint ?? "Checking"}
                </span>
              )}
              {verifyState === "verified" && (
                <button onClick={onToggleExpand}
                  className="rounded-full border border-verified/30 bg-verified/10 px-2.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-verified transition-colors hover:bg-verified/20">
                  ✓ Verified
                </button>
              )}
              {verifyState === "failed" && (
                <button onClick={onVerify} title={verifyError ? `${verifyError} — click to retry` : "Click to retry"}
                  className="flex items-center gap-1 rounded-full border border-danger/30 bg-danger/10 px-2.5 py-0.5 font-mono text-[9px] text-danger transition-colors hover:bg-danger/20">
                  ✗ Failed · Retry
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Proof drawer */}
      {verified && verifyResult && isExpanded && (
        <div className="border-t border-verified/10 bg-verified/[0.03] px-4 py-2.5">
          <p className="mb-1 flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-text-dimmer">
            <Icon icon={CheckmarkCircle01Icon} size={10} />
            On-chain proof
          </p>
          <a href={`https://explorer.solana.com/address/${verifyResult.dailyScoresPda}?cluster=devnet`}
            target="_blank" rel="noreferrer"
            className="break-all font-mono text-[10px] text-verified/80 underline-offset-2 hover:underline">
            {verifyResult.dailyScoresPda}
          </a>
          <p className="mt-0.5 font-mono text-[10px] text-text-dimmer">Epoch day {verifyResult.epochDay}</p>
        </div>
      )}

    </li>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function EventFeed({
  fixtureId, fixtureLabel, matchStartTime, players = [],
  onEventsChange, onLatestKeyAction, onMatchEnd, onGoal,
}: {
  fixtureId: number;
  fixtureLabel: string;
  matchStartTime?: number;
  /** Resolved roster (home + away) — used to show real scorer/assist/sub
   * names instead of guessed field names where possible. */
  players?: PlayerState[];
  onEventsChange?: (events: RawEvent[]) => void;
  onLatestKeyAction?: (action: string) => void;
  onMatchEnd?: () => void;
  /** Fired only for goals arriving on the live stream (not history backfill). */
  onGoal?: (payload: { side: "home" | "away" | null; teamName?: string; scoreLabel?: string }) => void;
}) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [events, setEvents] = useState<ScoreEvent[]>([]);
  const [shareMoment, setShareMoment] = useState<ShareableMoment | null>(null);
  const [vstates, setVstates] = useState<Record<string, VerifyState>>({});
  const [vresults, setVresults] = useState<Record<string, VerifyResult>>({});
  const [verrors, setVerrors] = useState<Record<string, VerifyError>>({});
  const [vhints, setVhints] = useState<Record<string, string>>({});
  const [walletError, setWalletError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // ── auto-scroll to bottom (newest events are appended to the top, so we reverse rendering)
  const [connected, setConnected] = useState(false);
  const [loadState, setLoadState] = useState<"loading" | "done" | "error">("loading");
  const idxRef = useRef(0);
  // Keys already seen (from history or a prior live/poll tick) — used to
  // tell genuinely NEW events apart from re-deliveries of the same event,
  // so prediction callbacks / auto-verify / celebrations only fire once
  // per real event instead of every time it's re-parsed.
  const seenKeysRef = useRef<Set<string>>(new Set());
  const autoVerifiedRef = useRef<Set<string>>(new Set());

  // ── verify ─────────────────────────────────────────────────────────────────
  // The proof is fetched server-side (needs the activated session's cookies),
  // but the actual on-chain validateStatV2 simulation runs client-side using
  // the connected wallet as fee payer — Solana's simulator requires the fee
  // payer to actually exist on-chain, which a server-side throwaway keypair
  // never does. This will prompt a lightweight signature in the wallet (no
  // real transaction is submitted or SOL spent — it's a read-only simulation).
  //
  // A goal/card streaming in live means the underlying stat was JUST
  // recorded — TxLINE's backend needs a beat to actually anchor its Merkle
  // root on-chain before /scores/stat-validation has anything to return.
  // Verifying the instant the event arrives was asking "prove this
  // happened" before the proof existed yet, so it failed almost every
  // time — not a real failure, just asked too early. Retrying the PROOF
  // FETCH (server-side, no wallet interaction) a few times with backoff
  // fixes that without ever prompting the wallet more than once.
  const PROOF_RETRY_DELAYS_MS = [0, 3000, 5000, 8000];

  async function fetchProofWithRetry(
    evt: ScoreEvent,
    onAttempt?: (attempt: number, maxAttempts: number) => void
  ): Promise<StatValidationApiResponse> {
    let lastError = "Failed to fetch proof";
    for (let attempt = 0; attempt < PROOF_RETRY_DELAYS_MS.length; attempt++) {
      if (PROOF_RETRY_DELAYS_MS[attempt] > 0) {
        await new Promise((r) => setTimeout(r, PROOF_RETRY_DELAYS_MS[attempt]));
      }
      onAttempt?.(attempt, PROOF_RETRY_DELAYS_MS.length);
      const res = await fetch("/api/txline/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtureId: evt.fixtureId, seq: evt.seq, statKeys: statKeys(evt.action) }),
      });
      const d = await res.json();
      if (res.ok) return d.proof as StatValidationApiResponse;
      lastError = d?.error ?? lastError;
    }
    throw new Error(lastError);
  }

  async function verify(evt: ScoreEvent) {
    if (evt.fixtureId == null || evt.seq == null) return;
    setVstates(s => ({ ...s, [evt.key]: "checking" }));
    setVhints(s => ({ ...s, [evt.key]: "Checking…" }));
    try {
      const proof = await fetchProofWithRetry(evt, (attempt, max) => {
        setVhints(s => ({
          ...s,
          [evt.key]: attempt === 0 ? "Checking…" : `Waiting for on-chain anchor… (${attempt}/${max - 1})`,
        }));
      });

      if (!wallet.connected) throw new Error("Connect a wallet to verify");
      setVhints(s => ({ ...s, [evt.key]: "Confirm in your wallet…" }));
      const result = await validateStatsOnChain(connection, wallet, proof);

      setVresults(s => ({ ...s, [evt.key]: result }));
      setVstates(s => ({ ...s, [evt.key]: result.verified ? "verified" : "failed" }));
    } catch (e) {
      const rawMsg = e instanceof Error ? e.message : "Failed";
      const msg = friendlyWalletError(e);
      setVerrors(s => ({ ...s, [evt.key]: msg }));
      setVstates(s => ({ ...s, [evt.key]: "failed" }));

      // Check for common wallet connection issues (Phantom inject errors, disconnected states)
      if (
        !wallet.connected ||
        rawMsg.includes("Connect a wallet") ||
        rawMsg.includes("Receiving end does not exist") ||
        rawMsg.includes("User rejected")
      ) {
        setWalletError(msg);
      }
    }
  }

  // ── history backfill ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    seenKeysRef.current = new Set();
    autoVerifiedRef.current = new Set();

    Promise.resolve().then(() => {
      if (cancelled) return;
      setEvents([]); setVstates({}); setVresults({}); setVerrors({});
      setLoadState("loading");
    });

    const historyUrl = matchStartTime
      ? `/api/txline/history?fixtureId=${fixtureId}&startTime=${matchStartTime}`
      : `/api/txline/history?fixtureId=${fixtureId}&hours=6`;

    fetch(historyUrl)
      .then(r => r.json())
      .then((d: { events: RawEvent[]; error?: string }) => {
        if (cancelled) return;
        if (!d.events) throw new Error(d.error ?? "No events");
        const parsed = d.events.map((r, i) => parseEvent(r, idxRef.current + i));
        idxRef.current += d.events.length;
        const merged = mergeEvents([], parsed); // dedupe within the batch itself
        merged.forEach((e) => seenKeysRef.current.add(e.key));
        setEvents(merged);
        onEventsChange?.(d.events);
        if (d.events.some(r => String(r.Action ?? "").toLowerCase() === "game_finalised")) {
          onMatchEnd?.();
        }
        setLoadState("done");
      })
      .catch(() => { if (!cancelled) setLoadState("error"); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtureId]);

  // ── live stream and polling fallback ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const es: EventSource | null = new EventSource("/api/txline/stream/scores");
    let pollInterval: NodeJS.Timeout | null = null;
    let lastEventCount = 0;

    // Shared by both the poll and live paths — fires prediction/celebration/
    // auto-verify side effects exactly once per real event, using the
    // stable key rather than array position or a "did the count change"
    // heuristic. Fixes predictions never resolving for corner/penalty
    // (they were never promoted past display-tier "activity" before) and
    // fixes the polling fallback never triggering predictions at all.
    const notifyNewEvent = (evt: ScoreEvent) => {
      const a = (evt.action ?? "").toLowerCase();
      const tier = classify(a);
      if (tier !== "system") {
        onLatestKeyAction?.(a);
        if (a === "game_finalised") onMatchEnd?.();
      }
      if (AUTO_VERIFY.has(a) && !autoVerifiedRef.current.has(evt.key)) {
        autoVerifiedRef.current.add(evt.key);
        void verify(evt);
      }
      if (GOALS.has(a)) {
        onGoal?.({
          side: teamSide(evt.raw),
          teamName: team(evt.raw, fixtureLabel) ?? undefined,
          scoreLabel: scoreAtGoal(evt.raw) ?? undefined,
        });
      }
    };

    const startPolling = () => {
      if (pollInterval) return;
      pollInterval = setInterval(() => {
        const historyUrl = matchStartTime
          ? `/api/txline/history?fixtureId=${fixtureId}&startTime=${matchStartTime}`
          : `/api/txline/history?fixtureId=${fixtureId}&hours=6`;

        fetch(historyUrl)
          .then(r => r.json())
          .then((d: { events: RawEvent[]; error?: string }) => {
            if (cancelled || !d.events) return;
            setConnected(true);
            const parsed = d.events.map((r, i) => parseEvent(r, idxRef.current + i));
            idxRef.current += d.events.length;

            // Only act when the poll actually returned new data — this
            // fetch re-pulls the FULL match history every 5s as a fallback,
            // so calling onEventsChange unconditionally here re-sends the
            // entire event list (hundreds of events) on every single tick,
            // forever, to a parent that just appends without dedup.
            if (d.events.length === lastEventCount) return;
            lastEventCount = d.events.length;

            const newOnes = parsed.filter((e) => !seenKeysRef.current.has(e.key));
            newOnes.forEach((e) => seenKeysRef.current.add(e.key));

            // Merge, never wholesale-replace — replacing wiped out events
            // the live stream had already added but this poll's snapshot
            // hadn't caught up to yet ("old events disappear").
            setEvents((prev) => mergeEvents(prev, parsed));
            onEventsChange?.(d.events);
            newOnes.forEach(notifyNewEvent);
          })
          .catch(() => {});
      }, 5000);
    };

    // Always start polling as a reliable backup, because devnet streams
    // can connect successfully but remain silently empty without firing onerror.
    startPolling();

    es.onopen  = () => {
      if (cancelled) return;
      setConnected(true);
      // We keep polling active on devnet to guarantee updates
    };

    es.onerror = () => {
      if (cancelled) return;
      setConnected(false);
      startPolling();
    };

    es.onmessage = (e) => {
      if (cancelled) return;
      let raw: RawEvent;
      try { raw = JSON.parse(e.data); } catch { return; }

      const parsed = parseEvent(raw, idxRef.current++);
      if (parsed.fixtureId !== fixtureId) return;
      const a = (parsed.action ?? "").toLowerCase();

      if (a === "action_discarded") {
        const id = parsed.actionId;
        if (id != null) setEvents(p => p.filter(ev => ev.actionId !== id));
        return;
      }

      const isNew = !seenKeysRef.current.has(parsed.key);
      seenKeysRef.current.add(parsed.key);

      setEvents(prev => {
        if (a === "action_amend") {
          const dd = parsed.raw.Data as Record<string, unknown> | undefined;
          const origId = num(dd?.Id ?? dd?.id);
          if (origId != null) {
            const idx = prev.findIndex(ev => ev.actionId === origId);
            if (idx !== -1) {
              const next = [...prev];
              next[idx] = { ...prev[idx],
                raw: { ...prev[idx].raw,
                  ...(parsed.raw.ScoreSoccer !== undefined ? { ScoreSoccer: parsed.raw.ScoreSoccer } : {}),
                },
                ts: parsed.ts ?? prev[idx].ts,
              };
              return next;
            }
          }
          return prev;
        }
        // penalty_outcome → upgrade the penalty card in place
        if (a === "penalty_outcome") {
          const pi = prev.findIndex(ev => ev.action === "penalty" && ev.fixtureId === fixtureId);
          if (pi !== -1) {
            const next = [...prev];
            next[pi] = { ...next[pi], action: "penalty_outcome", raw: { ...next[pi].raw, ...parsed.raw } };
            return next;
          }
        }
        if (!isNew) {
          // Re-delivery of an event we already have (e.g. SSE reconnect
          // resending its recent buffer) — refresh in place, don't duplicate.
          return prev.map((ev) => (ev.key === parsed.key ? parsed : ev));
        }
        return [parsed, ...prev].slice(0, 300);
      });

      onEventsChange?.([raw]);
      if (isNew) notifyNewEvent(parsed);
    };

    return () => {
      cancelled = true;
      if (es) es.close();
      if (pollInterval) clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtureId]);

  // ── render ──────────────────────────────────────────────────────────────────
  const timeline = events.filter(e => {
    const t = classify(e.action);
    return t === "key" || t === "marker";
  });
  const activityList = events.filter(e => classify(e.action) === "activity");
  const phase = extractPhase(events.map(e => e.raw));
  const matchFinished = phase != null && !phase.live;

  return (
    <>
      <div className="px-4 py-4 sm:px-6">
        {/* Header */}
        <div className="mb-3 flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-dim">
            Match events
          </span>
          {matchFinished ? (
            <span className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-text-dimmer">
              <Icon icon={CheckmarkCircle01Icon} size={9} />
              {phase.label}
            </span>
          ) : (
            <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${connected ? "border-accent/30 bg-accent-dim text-accent" : "border-border text-text-dimmer"}`}>
              <Icon icon={connected ? Wifi01Icon : WifiOff01Icon} size={9} />
              {connected ? "Live" : "Connecting…"}
            </span>
          )}
        </div>

        {/* Loading skeleton */}
        {loadState === "loading" && (
          <div className="space-y-2">
            {[0,1,2].map(i => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3" style={{ opacity: 1 - i * 0.3 }}>
                <div className="h-8 w-8 animate-pulse rounded-full bg-surface-2" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 animate-pulse rounded-full bg-surface-2" />
                  <div className="h-2 w-20 animate-pulse rounded-full bg-surface-2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {loadState === "done" && timeline.length === 0 && (
          <div className="rounded-xl border border-border bg-surface px-5 py-10 text-center">
            <Icon icon={Clock01Icon} size={28} />
            <p className="mt-3 text-sm font-medium text-text">No events yet</p>
            <p className="mt-1 text-xs text-text-dim">Events appear as the match progresses.</p>
          </div>
        )}

        {/* Timeline */}
        {timeline.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {timeline.map(evt => {
              const tier = classify(evt.action);
              if (tier === "marker") {
                const labels: Record<string, string> = {
                  game_finalised: "Full time",
                  halftime_finalised: "Half time",
                  kickoff: "Kick off",
                };
                const icons: Record<string, React.ReactNode> = {
                  game_finalised: <Icon icon={RacingFlagIcon} size={12} />,
                  halftime_finalised: <Icon icon={Timer01Icon} size={12} />,
                  kickoff: <Icon icon={FootballIcon} size={12} />,
                };
                const a = (evt.action ?? "").toLowerCase();
                return (
                  <MarkerRow
                    key={evt.key}
                    label={labels[a] ?? a}
                    icon={icons[a] ?? null}
                    time={wallClock(evt.ts)}
                  />
                );
              }
              return (
                <EventRow
                  key={evt.key}
                  evt={evt}
                  fixtureLabel={fixtureLabel}
                  matchStartTime={matchStartTime}
                  allEvents={events}
                  players={players}
                  verifyState={vstates[evt.key] ?? "idle"}
                  verifyError={verrors[evt.key] ?? null}
                  verifyResult={vresults[evt.key]}
                  verifyHint={vhints[evt.key]}
                  isExpanded={!!expanded[evt.key]}
                  onVerify={() => verify(evt)}
                  onToggleExpand={() => setExpanded(s => ({ ...s, [evt.key]: !s[evt.key] }))}
                  onShare={() => {
                    const cfg = cardConfig(evt, fixtureLabel, events, players);
                    const r = vresults[evt.key];
                    setShareMoment({
                      title: cfg.title,
                      detail: cfg.detail,
                      scorer: cfg.scorer,
                      assist: cfg.assist,
                      accent: cfg.accent,
                      fixtureLabel,
                      minuteLabel: minute(evt, matchStartTime) ?? undefined,
                      verified: !!r?.verified,
                      dailyScoresPda: r?.dailyScoresPda,
                      epochDay: r?.epochDay,
                    });
                  }}
                />
              );
            })}
          </ul>
        )}

        {/* Activity drawer — corners, penalty awarded, VAR start */}
        {loadState === "done" && activityList.length > 0 && (
          <details className="mt-3">
            <summary className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-surface px-4 py-2.5 text-xs text-text-dim hover:bg-surface-2 list-none">
              <span className="font-mono text-[10px] uppercase tracking-widest">More updates</span>
              <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] text-text-dimmer">
                {activityList.length}
              </span>
            </summary>
            <ul className="mt-1 divide-y divide-border overflow-hidden rounded-xl border border-border">
              {activityList.map(evt => {
                const a = (evt.action ?? "").toLowerCase();
                const t = team(evt.raw, fixtureLabel);
                const min = minute(evt, matchStartTime);
                const label = a === "corner" ? "Corner"
                  : a === "penalty" ? "Penalty awarded"
                  : a === "var" ? "VAR review started"
                  : evt.action?.replace(/_/g, " ") ?? "Event";
                const icon = a === "corner"
                  ? <Icon icon={Flag01Icon} size={13} />
                  : a.includes("var")
                  ? <Icon icon={VideoReplayIcon} size={13} />
                  : <Icon icon={Clock01Icon} size={13} />;
                return (
                  <li key={evt.key} className="flex items-center gap-3 px-4 py-2 text-xs text-text-dim">
                    <span className="w-8 shrink-0 font-mono text-[10px] text-text-dimmer">{min ?? ""}</span>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center text-text-dimmer">{icon}</span>
                    <span className="flex-1">{label}</span>
                    {t && <span className="shrink-0 font-mono text-[10px] text-text-dimmer">{t}</span>}
                    <span className="shrink-0 font-mono text-[10px] text-text-dimmer">{wallClock(evt.ts)}</span>
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </div>

      {shareMoment && (
        <ShareCardModal moment={shareMoment} onClose={() => setShareMoment(null)} />
      )}

      {/* Wallet Error Modal */}
      <WalletErrorModal 
        isOpen={!!walletError} 
        onClose={() => setWalletError(null)} 
        message={walletError ?? undefined}
      />
    </>
  );
}
