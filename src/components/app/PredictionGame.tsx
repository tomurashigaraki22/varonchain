"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useNow } from "@/lib/hooks/useNow";
import { usePlayContext } from "@/lib/playContext";
import { Icon } from "@/components/ui/Icon";
import {
  FootballIcon,
  Alert01Icon,
  Flag01Icon,
  GoalIcon,
  Medal01Icon,
  CrownIcon,
  Award01Icon,
} from "@hugeicons/core-free-icons";

type PredictionType = "goal" | "card" | "corner" | "penalty";

type Prediction = {
  id: string;
  wallet: string;
  fixtureId: number;
  type: PredictionType;
  ts: number;
  resolvedCorrect?: boolean;
  resolvedAt?: number;
};

type LeaderboardEntry = {
  wallet: string;
  points: number;
  predictions: number;
};

type PredictionOption = {
  type: PredictionType;
  icon: React.ReactNode;
  label: string;
};

const PREDICTION_OPTIONS: PredictionOption[] = [
  { type: "goal",    icon: <Icon icon={FootballIcon} size={18} />,  label: "Next goal" },
  { type: "card",    icon: <Icon icon={Alert01Icon} size={18} />,   label: "Card" },
  { type: "corner",  icon: <Icon icon={Flag01Icon} size={18} />,    label: "Corner" },
  { type: "penalty", icon: <Icon icon={GoalIcon} size={18} />,      label: "Penalty" },
];

// How long a prediction stays "active" before auto-expiring (5 min)
const PREDICTION_TTL_MS = 5 * 60 * 1000;

function truncate(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function timeAgo(ts: number, now: number) {
  const diffS = Math.floor((now - ts) / 1000);
  if (diffS < 60) return `${diffS}s ago`;
  return `${Math.floor(diffS / 60)}m ago`;
}

function PredictionBadge({ p, now }: { p: Prediction; now: number }) {
  const opt = PREDICTION_OPTIONS.find((o) => o.type === p.type);
  const pending = p.resolvedCorrect == null;
  const expired = pending && now - p.ts > PREDICTION_TTL_MS;

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
        p.resolvedCorrect === true
          ? "border-verified/25 bg-verified/[0.06] text-verified"
          : p.resolvedCorrect === false || expired
          ? "border-border bg-surface text-text-dimmer"
          : "border-accent/20 bg-accent/[0.03] text-text"
      }`}
    >
      <span className="flex h-4 w-4 items-center justify-center">{opt?.icon}</span>
      <span className="flex-1 font-medium">{opt?.label ?? p.type}</span>
      <span className="shrink-0 font-mono text-[10px]">
        {p.resolvedCorrect === true
          ? "+10 pts"
          : p.resolvedCorrect === false || expired
          ? "—"
          : timeAgo(p.ts, now)}
      </span>
    </div>
  );
}

/**
 * `view="arena"` renders the play surface (predict buttons + everyone's
 * live in-flight calls). `view="leaderboard"` renders just the ranking.
 * These used to be an in-component tab switcher; they're real routes now
 * (/app/play/[id]/arena, /app/play/[id]/leaderboard), each mounting this
 * component with a different view — fixtureId/latestKeyAction/matchEnded
 * come from the play layout's context instead of props since EventFeed
 * (which produces latestKeyAction) no longer lives on the same page as
 * this component.
 */
export function PredictionGame({ view }: { view: "arena" | "leaderboard" }) {
  const { fixtureId, latestKeyAction: latestAction, matchEnded } = usePlayContext();
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;
  const now = useNow();

  const [myPredictions, setMyPredictions] = useState<Prediction[]>([]);
  const [allPredictions, setAllPredictions] = useState<Prediction[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const lastResolvedAction = useRef<string | null>(null);

  // Fetch predictions on mount and on fixture change, then poll so the
  // Arena (everyone's live calls, not just mine) stays fresh.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch(`/api/txline/predictions?fixtureId=${fixtureId}`)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          const all = (data.predictions as Prediction[]) ?? [];
          setAllPredictions(all);
          setMyPredictions(all.filter((p) => p.wallet === wallet));
          setLeaderboard(data.leaderboard ?? []);
        })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 8_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fixtureId, wallet]);

  // Auto-resolve pending predictions when a matching event arrives
  useEffect(() => {
    if (!latestAction || latestAction === lastResolvedAction.current) return;
    lastResolvedAction.current = latestAction;
    const actionLower = latestAction.toLowerCase();

    setMyPredictions((prev) => {
      const updated = prev.map((p) => {
        if (p.resolvedCorrect != null) return p; // already resolved
        if (Date.now() - p.ts > PREDICTION_TTL_MS) return p; // expired
        const hit =
          (p.type === "goal" && actionLower.includes("goal")) ||
          (p.type === "card" && (actionLower.includes("card") || actionLower.includes("red") || actionLower.includes("yellow"))) ||
          (p.type === "corner" && actionLower.includes("corner")) ||
          (p.type === "penalty" && actionLower.includes("penalty"));
        if (!hit) return p;
        // Fire & forget resolve PATCH
        fetch("/api/txline/predictions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: p.id, correct: true }),
        })
          .then((r) => r.json())
          .then((data) => setLeaderboard(data.leaderboard ?? []))
          .catch(() => {});
        return { ...p, resolvedCorrect: true, resolvedAt: Date.now() };
      });
      return updated;
    });
  }, [latestAction]);

  const submit = async (type: PredictionType) => {
    if (!wallet || submitting || cooldown) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/txline/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, fixtureId, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMyPredictions((prev) => [data.prediction, ...prev].slice(0, 10));
      setLeaderboard(data.leaderboard ?? []);
      // 30 second cooldown between predictions
      setCooldown(true);
      setTimeout(() => setCooldown(false), 30_000);
    } catch {
      // silent fail — let user retry
    } finally {
      setSubmitting(false);
    }
  };

  const pending = myPredictions.filter(
    (p) => p.resolvedCorrect == null && now - p.ts <= PREDICTION_TTL_MS
  );
  const myPoints = myPredictions.reduce(
    (acc, p) => acc + (p.resolvedCorrect === true ? 10 : 0),
    0
  );
  // Arena — everyone's live in-flight calls right now, not just mine.
  const arena = allPredictions
    .filter((p) => p.resolvedCorrect == null && now - p.ts <= PREDICTION_TTL_MS)
    .sort((a, b) => b.ts - a.ts);

  if (view === "leaderboard") {
    return (
      <div>
        <div className="flex items-center justify-between border-b border-border bg-surface-2/60 px-4 py-3 sm:px-6">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-dim">
            Prediction Leaderboard
          </span>
          {wallet && myPoints > 0 && (
            <span className="font-mono text-[10px] font-semibold text-accent">{myPoints} pts</span>
          )}
        </div>
        <div className="px-4 py-4 sm:px-6">
          {leaderboard.length === 0 ? (
            <p className="text-center text-xs text-text-dim">No predictions yet — be the first!</p>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {leaderboard.map((entry, i) => {
                const isMe = entry.wallet === wallet;
                return (
                  <li
                    key={entry.wallet}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
                      isMe ? "border-accent/20 bg-accent-dim" : "border-border bg-surface"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold ${
                        i === 0 ? "bg-accent text-white"
                        : i === 1 ? "bg-white/20 text-text"
                        : i === 2 ? "bg-warning/30 text-warning"
                        : "bg-surface-2 text-text-dimmer"
                      }`}
                    >
                      {i === 0 ? <Icon icon={CrownIcon} size={12} color={i === 0 ? "#ffffff" : "currentColor"} />
                       : i === 1 ? <Icon icon={Medal01Icon} size={12} />
                       : i === 2 ? <Icon icon={Award01Icon} size={12} />
                       : <span className="font-mono text-[10px]">{i + 1}</span>}
                    </span>
                    <span className={`flex-1 truncate font-mono text-xs ${isMe ? "text-accent" : "text-text-dim"}`}>
                      {isMe ? "You" : truncate(entry.wallet)}
                    </span>
                    <span className={`shrink-0 font-mono text-xs font-semibold ${isMe ? "text-accent" : "text-text"}`}>
                      {entry.points} pts
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-text-dimmer">
                      {entry.predictions} pred.
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-surface-2/60 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-dim">Predict</span>
          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] text-text-dimmer">
            Free to play
          </span>
        </div>
        {wallet && myPoints > 0 && (
          <span className="font-mono text-[10px] font-semibold text-accent">{myPoints} pts</span>
        )}
      </div>

      <div className="px-4 py-4 sm:px-6">
        {!wallet ? (
          <p className="text-center text-xs text-text-dim">Connect your wallet to make predictions.</p>
        ) : matchEnded ? (
          <div className="rounded-xl border border-border bg-surface px-4 py-6 text-center">
            <p className="text-sm font-semibold text-text">Match finished</p>
            <p className="mt-1 text-xs text-text-dim">
              Predictions are locked — the game has ended.
              {myPoints > 0 && ` You scored ${myPoints} pts.`}
            </p>
            {myPredictions.length > 0 && (
              <div className="mt-4 text-left">
                <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-text-dimmer">
                  Your predictions
                </p>
                <div className="flex flex-col gap-1.5">
                  {myPredictions.slice(0, 5).map((p) => (
                    <PredictionBadge key={p.id} p={p} now={now} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Prediction buttons */}
            <p className="mb-3 text-xs text-text-dim">
              {cooldown
                ? "Prediction locked — wait 30s before your next guess."
                : pending.length > 0
                ? `Prediction active — waiting for a ${pending[0].type}…`
                : "What happens next?"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PREDICTION_OPTIONS.map((opt) => {
                const hasPending = pending.some((p) => p.type === opt.type);
                const disabled = submitting || cooldown || hasPending;
                return (
                  <button
                    key={opt.type}
                    onClick={() => submit(opt.type)}
                    disabled={disabled}
                    className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
                      hasPending
                        ? "border-accent/30 bg-accent-dim text-accent"
                        : disabled
                        ? "border-border bg-surface text-text-dimmer opacity-50"
                        : "border-border bg-surface text-text hover:border-accent/30 hover:bg-accent-dim hover:text-accent"
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center" aria-hidden>
                      {opt.icon}
                    </span>
                    <span>{opt.label}</span>
                    {hasPending && (
                      <span className="ml-auto h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Recent predictions */}
            {myPredictions.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-text-dimmer">
                  Your predictions
                </p>
                <div className="flex flex-col gap-1.5">
                  {myPredictions.slice(0, 5).map((p) => (
                    <PredictionBadge key={p.id} p={p} now={now} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Arena — everyone's live in-flight calls, wallet vs wallet */}
      <div className="border-t border-border">
        <div className="border-b border-border bg-surface-2/60 px-4 py-3 sm:px-6">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-dim">
            Arena{arena.length ? ` · ${arena.length} live` : ""}
          </span>
        </div>
        <div className="px-4 py-4 sm:px-6">
          {arena.length === 0 ? (
            <p className="text-center text-xs text-text-dim">
              No live calls right now — be the first to predict.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {arena.map((p) => {
                const opt = PREDICTION_OPTIONS.find((o) => o.type === p.type);
                const isMe = p.wallet === wallet;
                const secsLeft = Math.max(0, Math.ceil((PREDICTION_TTL_MS - (now - p.ts)) / 1000));
                return (
                  <li
                    key={p.id}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs ${
                      isMe ? "border-accent/25 bg-accent-dim" : "border-border bg-surface"
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center" aria-hidden>
                      {opt?.icon}
                    </span>
                    <span className={`flex-1 truncate font-mono ${isMe ? "text-accent" : "text-text-dim"}`}>
                      {isMe ? "You" : truncate(p.wallet)} called {opt?.label ?? p.type}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-text-dimmer">{secsLeft}s</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
