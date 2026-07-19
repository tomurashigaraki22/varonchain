"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PredictionGame } from "@/components/app/PredictionGame";
import { usePlayContext } from "@/lib/playContext";

type PulseLeaderboardEntry = { wallet: string; points: number; calls: number };

function truncate(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function PulseLeaderboard({ fixtureId }: { fixtureId: number }) {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;
  const [entries, setEntries] = useState<PulseLeaderboardEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(`/api/txline/pulse?fixtureId=${fixtureId}`)
        .then((r) => r.json())
        .then((d) => { if (!cancelled) setEntries(d.leaderboard ?? []); })
        .catch(() => {});
    load();
    const interval = setInterval(load, 8_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [fixtureId]);

  return (
    <div>
      <div className="border-b border-border bg-surface-2/60 px-4 py-3 sm:px-6">
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-dim">
          Crowd Pulse Trader Leaderboard
        </span>
      </div>
      <div className="px-4 py-4 sm:px-6">
        {entries.length === 0 ? (
          <p className="text-center text-xs text-text-dim">No calls yet — be the first trader.</p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {entries.map((e, i) => {
              const isMe = e.wallet === wallet;
              return (
                <li
                  key={e.wallet}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
                    isMe ? "border-accent/20 bg-accent-dim" : "border-border bg-surface"
                  }`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 font-mono text-[10px] font-bold text-text-dimmer">
                    {i + 1}
                  </span>
                  <span className={`flex-1 truncate font-mono text-xs ${isMe ? "text-accent" : "text-text-dim"}`}>
                    {isMe ? "You" : truncate(e.wallet)}
                  </span>
                  <span className={`shrink-0 font-mono text-xs font-semibold ${isMe ? "text-accent" : "text-text"}`}>
                    {e.points} pts
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-text-dimmer">{e.calls} calls</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const { fixtureId } = usePlayContext();

  return (
    <div className="divide-y divide-border">
      <PredictionGame view="leaderboard" />
      <PulseLeaderboard fixtureId={fixtureId} />
    </div>
  );
}
