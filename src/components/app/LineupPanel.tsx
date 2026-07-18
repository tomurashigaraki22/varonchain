"use client";

import { useState } from "react";
import type { PlayerState } from "@/lib/txline/lineups";
import { PitchView } from "./PitchView";
import { LineupStatsTable } from "./LineupStatsTable";

export function LineupPanel({
  home,
  away,
  announced,
}: {
  home: PlayerState[];
  away: PlayerState[];
  announced: boolean;
}) {
  const [view, setView] = useState<"pitch" | "stats">("pitch");

  return (
    <div className="border-b border-border lg:border-b-0">
      <div className="flex items-center justify-between border-b border-border bg-surface-2/60 px-4 py-3 sm:px-6">
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-dim">Lineups</span>
        <div className="flex rounded-full border border-border p-0.5">
          {(["pitch", "stats"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-full px-3 py-1 font-mono text-[9px] font-semibold uppercase tracking-widest transition-colors ${
                view === v ? "bg-accent text-bg" : "text-text-dimmer hover:text-text-dim"
              }`}
            >
              {v === "pitch" ? "Pitch" : "Stats"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 sm:px-6">
        {!announced ? (
          <div className="rounded-xl border border-border bg-surface px-5 py-8 text-center">
            <p className="text-sm font-medium text-text">Lineups not announced yet</p>
            <p className="mt-1 text-xs text-text-dim">
              Starting XIs typically drop about an hour before kickoff.
            </p>
          </div>
        ) : view === "pitch" ? (
          <PitchView home={home} away={away} />
        ) : (
          <LineupStatsTable home={home} away={away} />
        )}
      </div>
    </div>
  );
}
