"use client";

import { useEffect, useRef, useState } from "react";
import { ShareCardModal, type ShareableMoment } from "./ShareCardModal";
import { Icon } from "@/components/ui/Icon";
import {
  FootballIcon,
  Alert01Icon,
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
  return {
    key: `${num(raw.FixtureId ?? raw.fixtureId) ?? "x"}-${num(raw.Seq ?? raw.seq) ?? idx}-${idx}`,
    actionId: num(raw.Id ?? raw.id),
    fixtureId: num(raw.FixtureId ?? raw.fixtureId),
    seq: num(raw.Seq ?? raw.seq),
    action: str(raw.Action ?? raw.action),
    ts: num(raw.Ts ?? raw.ts),
    raw,
  };
}

/** Match minute from Clock.Seconds + StatusId */
function clockMin(raw: RawEvent): string | null {
  const clk = raw.Clock as Record<string, unknown> | undefined;
  if (!clk) return null;
  const secs = num(clk.Seconds);
  if (secs == null) return null;
  const sid = num(raw.StatusId);
  let offset = 0, len = 45 * 60;
  if (sid === 4) offset = 45;
  else if (sid === 6) { offset = 90; len = 15 * 60; }
  else if (sid === 7) { offset = 105; len = 15 * 60; }
  else if (sid !== 2) return null;
  const min = offset + Math.max(1, Math.ceil((len - secs) / 60));
  return `${min}'`;
}

/** Match minute from wall-clock Ts vs fixture start */
function tsMin(ts: number | undefined, start: number | undefined): string | null {
  if (!ts || !start || start <= 0) return null;
  const min = Math.ceil((ts - start) / 60000);
  if (min <= 0 || min > 150) return null;
  return `${min}'`;
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

/** Score at the moment of a goal event: "1 – 0" */
function scoreAtGoal(raw: RawEvent): string | null {
  const s = raw.Score as Record<string, unknown> | undefined;
  if (!s) return null;
  const p1 = s.Participant1 as Record<string, unknown> | undefined;
  const p2 = s.Participant2 as Record<string, unknown> | undefined;
  const g1 = num((p1?.Total as Record<string,unknown>|undefined)?.Goals)
    ?? ([...(["H1","H2","ET1","ET2"] as const)].reduce((acc, k) => acc + (num((p1?.[k] as Record<string,unknown>|undefined)?.Goals) ?? 0), 0));
  const g2 = num((p2?.Total as Record<string,unknown>|undefined)?.Goals)
    ?? ([...(["H1","H2","ET1","ET2"] as const)].reduce((acc, k) => acc + (num((p2?.[k] as Record<string,unknown>|undefined)?.Goals) ?? 0), 0));
  return `${g1} – ${g2}`;
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
  accent: "goal" | "red" | "yellow" | "var" | "none";
  verifiable: boolean;
};

function cardConfig(evt: ScoreEvent, fixtureLabel: string): CardConfig {
  const a = (evt.action ?? "").toLowerCase();
  const t = team(evt.raw, fixtureLabel);
  const data = evt.raw.Data as Record<string, unknown> | undefined;

  // ── Goals ──────────────────────────────────────────────────────────────────
  if (GOALS.has(a)) {
    const score = scoreAtGoal(evt.raw);
    const title = a === "own_goal" ? "Own goal" : "Goal";
    return {
      icon: <Icon icon={FootballIcon} size={18} />,
      title,
      detail: [t, score].filter(Boolean).join("  ·  ") || t || undefined,
      accent: "goal",
      verifiable: true,
    };
  }

  // ── Penalty outcome ────────────────────────────────────────────────────────
  if (a === "penalty_outcome") {
    const outcome = str(data?.Outcome ?? data?.outcome ?? data?.Result ?? "")?.toLowerCase() ?? "";
    const scored = outcome.includes("score") || outcome.includes("goal") || outcome === "converted" || outcome === "scored";
    const saved  = outcome.includes("saved") || outcome.includes("save");
    const missed = outcome.includes("miss");
    const title = scored ? "Penalty scored" : saved ? "Penalty saved" : missed ? "Penalty missed" : "Penalty";
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
    const pOut = str(data?.PlayerOutName ?? data?.PlayerOut ?? data?.OutPlayer);
    const pIn  = str(data?.PlayerInName  ?? data?.PlayerIn  ?? data?.InPlayer);
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
  if (a === "var_end") {
    const raw = str(data?.Decision ?? data?.Outcome ?? data?.Result ?? data?.VarDecision ?? "")?.toLowerCase() ?? "";
    const title = raw.includes("no_goal") || raw.includes("cancelled") || raw.includes("disallow")
      ? "VAR — Goal disallowed"
      : raw.includes("goal") ? "VAR — Goal confirmed"
      : raw.includes("red") ? "VAR — Red card"
      : raw.includes("penalty") ? "VAR — Penalty awarded"
      : raw.includes("overturn") ? "VAR — Decision overturned"
      : raw ? `VAR — ${raw.replace(/_/g," ")}`
      : "VAR — Decision";
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
function MarkerRow({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-0.5" aria-label={label}>
      <div className="h-px flex-1 bg-border" />
      <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2/80 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-text-dim">
        {icon}
        <span>{label}</span>
      </span>
      <div className="h-px flex-1 bg-border" />
    </li>
  );
}

/** A single key event row in the timeline */
function EventRow({
  evt, fixtureLabel, matchStartTime,
  verifyState, verifyError, verifyResult,
  isExpanded, onVerify, onToggleExpand, onShare,
}: {
  evt: ScoreEvent; fixtureLabel: string; matchStartTime?: number;
  verifyState: VerifyState; verifyError: VerifyError; verifyResult?: VerifyResult;
  isExpanded: boolean;
  onVerify(): void; onToggleExpand(): void; onShare(): void;
}) {
  const cfg = cardConfig(evt, fixtureLabel);
  const min = minute(evt, matchStartTime);
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
          {cfg.detail && (
            <p className="mt-0.5 truncate text-xs text-text-dim">{cfg.detail}</p>
          )}
        </div>

        {/* Right: verify button */}
        {cfg.verifiable && (
          <div className="shrink-0">
            {verifyState === "idle" && (
              <button onClick={onVerify}
                className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-text-dimmer transition-colors hover:border-accent/40 hover:bg-accent-dim hover:text-accent">
                Verify
              </button>
            )}
            {verifyState === "checking" && (
              <span className="flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-0.5 font-mono text-[9px] text-warning">
                <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-warning border-t-transparent" />
                Checking
              </span>
            )}
            {verifyState === "verified" && (
              <div className="flex items-center gap-1.5">
                <button onClick={onShare}
                  className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-text-dimmer transition-colors hover:text-text">
                  Share
                </button>
                <button onClick={onToggleExpand}
                  className="rounded-full border border-verified/30 bg-verified/10 px-2.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-verified transition-colors hover:bg-verified/20">
                  ✓ Verified
                </button>
              </div>
            )}
            {verifyState === "failed" && (
              <span title={verifyError ?? "Failed"}
                className="cursor-help rounded-full border border-danger/30 bg-danger/10 px-2.5 py-0.5 font-mono text-[9px] text-danger">
                ✗ Failed
              </span>
            )}
          </div>
        )}
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
  fixtureId, fixtureLabel, matchStartTime,
  onEventsChange, onLatestKeyAction, onMatchEnd,
}: {
  fixtureId: number;
  fixtureLabel: string;
  matchStartTime?: number;
  onEventsChange?: (events: RawEvent[]) => void;
  onLatestKeyAction?: (action: string) => void;
  onMatchEnd?: () => void;
}) {
  const [events, setEvents] = useState<ScoreEvent[]>([]);
  const [shareMoment, setShareMoment] = useState<ShareableMoment | null>(null);
  const [vstates, setVstates] = useState<Record<string, VerifyState>>({});
  const [vresults, setVresults] = useState<Record<string, VerifyResult>>({});
  const [verrors, setVerrors] = useState<Record<string, VerifyError>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [connected, setConnected] = useState(false);
  const [loadState, setLoadState] = useState<"loading" | "done" | "error">("loading");
  const idxRef = useRef(0);

  // ── verify ─────────────────────────────────────────────────────────────────
  async function verify(evt: ScoreEvent) {
    if (evt.fixtureId == null || evt.seq == null) return;
    setVstates(s => ({ ...s, [evt.key]: "checking" }));
    try {
      const res = await fetch("/api/txline/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtureId: evt.fixtureId, seq: evt.seq, statKeys: statKeys(evt.action) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error ?? "Failed");
      setVresults(s => ({ ...s, [evt.key]: d }));
      setVstates(s => ({ ...s, [evt.key]: d.verified ? "verified" : "failed" }));
    } catch (e) {
      setVerrors(s => ({ ...s, [evt.key]: e instanceof Error ? e.message : "Failed" }));
      setVstates(s => ({ ...s, [evt.key]: "failed" }));
    }
  }

  // ── history backfill ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setEvents([]); setVstates({}); setVresults({}); setVerrors({});
    setLoadState("loading");

    fetch(`/api/txline/history?fixtureId=${fixtureId}&hours=6`)
      .then(r => r.json())
      .then((d: { events: RawEvent[]; error?: string }) => {
        if (cancelled) return;
        if (!d.events) throw new Error(d.error ?? "No events");
        const parsed = d.events.map((r, i) => parseEvent(r, idxRef.current + i));
        idxRef.current += d.events.length;
        // Newest first
        setEvents(parsed.slice().sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0)));
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

  // ── live stream ────────────────────────────────────────────────────────────
  useEffect(() => {
    const es = new EventSource("/api/txline/stream/scores");
    es.onopen  = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (e) => {
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
                  ...(parsed.raw.Score !== undefined ? { Score: parsed.raw.Score } : {}),
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
        return [parsed, ...prev].slice(0, 300);
      });

      onEventsChange?.([raw]);
      const tier = classify(a);
      if (tier === "key" || tier === "marker") {
        onLatestKeyAction?.(a);
        if (a === "game_finalised") onMatchEnd?.();
      }
      if (AUTO_VERIFY.has(a)) void verify(parsed);
    };

    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtureId]);

  // ── render ──────────────────────────────────────────────────────────────────
  const timeline = events.filter(e => {
    const t = classify(e.action);
    return t === "key" || t === "marker";
  });
  const activityList = events.filter(e => classify(e.action) === "activity");

  return (
    <>
      <div className="px-4 py-4 sm:px-6">
        {/* Header */}
        <div className="mb-3 flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-dim">
            Match events
          </span>
          <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${connected ? "border-accent/30 bg-accent-dim text-accent" : "border-border text-text-dimmer"}`}>
            <Icon icon={connected ? Wifi01Icon : WifiOff01Icon} size={9} />
            {connected ? "Live" : "Offline"}
          </span>
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
                return <MarkerRow key={evt.key} label={labels[a] ?? a} icon={icons[a] ?? null} />;
              }
              return (
                <EventRow
                  key={evt.key}
                  evt={evt}
                  fixtureLabel={fixtureLabel}
                  matchStartTime={matchStartTime}
                  verifyState={vstates[evt.key] ?? "idle"}
                  verifyError={verrors[evt.key] ?? null}
                  verifyResult={vresults[evt.key]}
                  isExpanded={!!expanded[evt.key]}
                  onVerify={() => verify(evt)}
                  onToggleExpand={() => setExpanded(s => ({ ...s, [evt.key]: !s[evt.key] }))}
                  onShare={() => {
                    const r = vresults[evt.key];
                    if (!r) return;
                    const cfg = cardConfig(evt, fixtureLabel);
                    setShareMoment({
                      label: cfg.title,
                      fixtureLabel,
                      minuteLabel: minute(evt, matchStartTime) ?? undefined,
                      dailyScoresPda: r.dailyScoresPda,
                      epochDay: r.epochDay,
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
    </>
  );
}
