"use client";

import { Icon } from "@/components/ui/Icon";
import { FootballIcon, UserSwitchIcon } from "@hugeicons/core-free-icons";
import type { PlayerState } from "@/lib/txline/lineups";

function PlayerRow({ player }: { player: PlayerState }) {
  const hasRed = player.cards.some((c) => c.type === "red");
  const hasYellow = player.cards.some((c) => c.type === "yellow");

  return (
    <li className={`flex items-center gap-2.5 px-3 py-2 text-xs ${!player.isOnPitch && player.isStarter ? "opacity-50" : ""}`}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border font-mono text-[10px] font-bold text-text-dim">
        {player.number ?? "?"}
      </span>
      <span className="min-w-0 flex-1 truncate text-text">{player.name}</span>
      <span className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-text-dimmer">
        {player.positionGroup}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        {player.goals.map((_, i) => (
          <Icon key={i} icon={FootballIcon} size={11} color="#cdfe00" />
        ))}
        {hasYellow && <span className="h-2.5 w-2 rounded-[1px] bg-yellow-400" />}
        {hasRed && <span className="h-2.5 w-2 rounded-[1px] bg-red-500" />}
        {!player.isOnPitch && player.isStarter && <Icon icon={UserSwitchIcon} size={11} color="#666" />}
      </div>
    </li>
  );
}

export function LineupStatsTable({ home, away }: { home: PlayerState[]; away: PlayerState[] }) {
  return (
    <div className="grid grid-cols-1 divide-y divide-border rounded-xl border border-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
      {[
        { label: "Home", players: home },
        { label: "Away", players: away },
      ].map(({ label, players }) => (
        <div key={label}>
          <p className="border-b border-border bg-surface-2/60 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-text-dim">
            {label}
          </p>
          <ul className="divide-y divide-border/60">
            {players
              .slice()
              .sort((a, b) => (b.isStarter ? 1 : 0) - (a.isStarter ? 1 : 0))
              .map((p) => (
                <PlayerRow key={p.fixturePlayerId} player={p} />
              ))}
            {players.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-text-dimmer">No lineup data yet.</li>
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}
