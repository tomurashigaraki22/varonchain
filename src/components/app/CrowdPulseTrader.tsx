"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Icon } from "@/components/ui/Icon";
import { ArrowUp01Icon, ArrowDown01Icon, ChartLineData01Icon } from "@hugeicons/core-free-icons";

type RawOddsEvent = Record<string, unknown>;

type PendingCall = {
  id: string;
  direction: "up" | "down";
  baselinePct: number;
  resolveAt: number;
};

type ResolvedCall = {
  direction: "up" | "down";
  baselinePct: number;
  resolvedPct: number;
  correct: boolean;
};

type LeaderboardEntry = { wallet: string; points: number; calls: number };

function num(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

function truncate(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function CrowdPulseTrader({ fixtureId }: { fixtureId: number }) {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;

  const [currentPct, setCurrentPct] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [pending, setPending] = useState<PendingCall | null>(null);
  const [lastResult, setLastResult] = useState<ResolvedCall | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const lockedName = useRef<string | null>(null);
  const currentPctRef = useRef<number | null>(null);
  useEffect(() => {
    currentPctRef.current = currentPct;
  }, [currentPct]);

  // Tick for the countdown display
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Track the live home-win implied probability from the odds stream
  useEffect(() => {
    lockedName.current = null;
    const es = new EventSource("/api/txline/stream/odds");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (evt) => {
      let data: RawOddsEvent;
      try {
        data = JSON.parse(evt.data);
      } catch {
        return;
      }
      if (num(data.FixtureId ?? data.fixtureId) !== fixtureId) return;
      const names = (data.PriceNames as string[] | undefined) ?? [];
      const pct = (data.Pct as string[] | undefined) ?? [];
      if (names.length < 2 || pct.length < 2) return;

      if (!lockedName.current) lockedName.current = names[0];
      if (names[0] !== lockedName.current) return;

      const home = Number(pct[0]);
      if (!Number.isNaN(home)) setCurrentPct(home);
    };
    return () => es.close();
  }, [fixtureId]);

  // Fetch leaderboard on mount / fixture change
  useEffect(() => {
    fetch(`/api/txline/pulse?fixtureId=${fixtureId}`)
      .then((r) => r.json())
      .then((d) => setLeaderboard(d.leaderboard ?? []))
      .catch(() => {});
  }, [fixtureId]);

  // Auto-resolve once the window elapses and we have a fresh pct
  useEffect(() => {
    if (!pending) return;
    if (now < pending.resolveAt) return;
    if (currentPctRef.current == null) return;

    const resolvePct = currentPctRef.current;
    fetch("/api/txline/pulse", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pending.id, currentPct: resolvePct }),
    })
      .then((r) => r.json())
      .then((d) => {
        setLeaderboard(d.leaderboard ?? []);
        setLastResult({
          direction: pending.direction,
          baselinePct: pending.baselinePct,
          resolvedPct: resolvePct,
          correct: !!d.call?.resolvedCorrect,
        });
        setPending(null);
      })
      .catch(() => setPending(null));
  }, [now, pending]);

  const call = async (direction: "up" | "down") => {
    if (!wallet || currentPct == null || submitting || pending) return;
    setSubmitting(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/txline/pulse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, fixtureId, direction, baselinePct: currentPct }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error ?? "Failed");
      setPending({ id: d.call.id, direction, baselinePct: currentPct, resolveAt: d.call.resolveAt });
    } catch {
      // silent — button re-enables, user can retry
    } finally {
      setSubmitting(false);
    }
  };

  const secondsLeft = pending ? Math.max(0, Math.ceil((pending.resolveAt - now) / 1000)) : 0;
  const myRank = leaderboard.findIndex((e) => e.wallet === wallet);

  return (
    <div className="border-t border-border">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-surface-2/60 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <Icon icon={ChartLineData01Icon} size={14} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-dim">
            Crowd Pulse Trader
          </span>
        </div>
        <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${connected ? "border-accent/30 bg-accent-dim text-accent" : "border-border text-text-dimmer"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-accent animate-pulse-dot" : "bg-text-dimmer"}`} />
          {connected ? "Live" : "Connecting"}
        </span>
      </div>

      <div className="px-4 py-4 sm:px-6">
        <p className="text-xs leading-5 text-text-dim">
          Call whether the home team&rsquo;s live win probability will be higher or lower{" "}
          <span className="text-text">60 seconds</span> from now — resolved from TxLINE&rsquo;s
          real StablePrice odds feed, not a guess.
        </p>

        <div className="mt-4 flex items-center justify-center">
          <span className="font-display text-4xl font-extrabold tabular-nums text-text">
            {currentPct != null ? `${currentPct.toFixed(1)}%` : "–"}
          </span>
        </div>
        <p className="mt-1 text-center font-mono text-[10px] uppercase tracking-widest text-text-dimmer">
          Home win probability
        </p>

        {!pending ? (
          <div className="mt-4 flex gap-2.5">
            <button
              onClick={() => call("up")}
              disabled={!wallet || currentPct == null || submitting}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-verified/30 bg-verified/10 py-2.5 text-sm font-bold text-verified transition-colors hover:bg-verified/20 disabled:opacity-40"
            >
              <Icon icon={ArrowUp01Icon} size={15} />
              Call UP
            </button>
            <button
              onClick={() => call("down")}
              disabled={!wallet || currentPct == null || submitting}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-danger/30 bg-danger/10 py-2.5 text-sm font-bold text-danger transition-colors hover:bg-danger/20 disabled:opacity-40"
            >
              <Icon icon={ArrowDown01Icon} size={15} />
              Call DOWN
            </button>
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-accent/25 bg-accent-dim px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-accent">
              <Icon icon={pending.direction === "up" ? ArrowUp01Icon : ArrowDown01Icon} size={15} />
              Called {pending.direction.toUpperCase()} from {pending.baselinePct.toFixed(1)}%
            </span>
            <span className="font-mono text-xs text-accent">{secondsLeft}s</span>
          </div>
        )}

        {!wallet && (
          <p className="mt-3 text-center text-[11px] text-text-dimmer">Connect your wallet to make a call.</p>
        )}

        {lastResult && (
          <div className={`mt-3 rounded-xl border px-4 py-2.5 text-center text-sm font-semibold ${lastResult.correct ? "border-verified/30 bg-verified/10 text-verified" : "border-border bg-surface text-text-dim"}`}>
            {lastResult.correct ? "✓ Called it — " : "✗ Missed — "}
            {lastResult.baselinePct.toFixed(1)}% → {lastResult.resolvedPct.toFixed(1)}%
          </div>
        )}

        {leaderboard.length > 0 && (
          <div className="mt-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-dim">Top traders</p>
            <ul className="mt-2 flex flex-col gap-1">
              {leaderboard.slice(0, 5).map((e, i) => (
                <li
                  key={e.wallet}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs ${e.wallet === wallet ? "bg-accent-dim text-accent" : "text-text-dim"}`}
                >
                  <span className="font-mono">
                    #{i + 1} {truncate(e.wallet)}
                  </span>
                  <span className="font-mono font-semibold">{e.points} pts</span>
                </li>
              ))}
            </ul>
            {myRank >= 5 && wallet && (
              <p className="mt-1.5 text-center font-mono text-[10px] text-text-dimmer">
                You&rsquo;re #{myRank + 1}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
