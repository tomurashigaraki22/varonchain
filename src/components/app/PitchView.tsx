"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { FootballIcon, UserSwitchIcon } from "@hugeicons/core-free-icons";
import type { PlayerState, PositionGroup } from "@/lib/txline/lineups";

const ROW_ORDER: PositionGroup[] = ["GK", "DEF", "MID", "FWD"];

const TEAM_COLOR = {
  home: { fill: "#3b82f6", ring: "#60a5fa", label: "Home" },
  away: { fill: "#ef4444", ring: "#f87171", label: "Away" },
} as const;

/** A simple kit/jersey silhouette — reads as "a player" at a glance
 * without needing real photos, which the feed doesn't provide anyway. */
function Jersey({ color, size = 34 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path
        d="M10 4L4 8v5l3-1v14h18V12l3 1V8l-6-4-3 2.5h-6L10 4z"
        fill={color}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M12 4.5c1 1.4 2.4 2.2 4 2.2s3-.8 4-2.2" stroke="rgba(0,0,0,0.35)" strokeWidth="1" fill="none" />
    </svg>
  );
}

// x-position (%) per row, for the HOME side (left half). Away side mirrors
// (100 - x) so both teams face each other across the halfway line.
const HOME_ROW_X: Record<PositionGroup, number> = { GK: 6, DEF: 22, MID: 39, FWD: 47 };

type Slot = { player: PlayerState; x: number; y: number };

function computeSlots(players: PlayerState[], side: "home" | "away"): Slot[] {
  const onPitch = players.filter((p) => p.isOnPitch);
  const slots: Slot[] = [];

  for (const group of ROW_ORDER) {
    const rowPlayers = onPitch.filter((p) => p.positionGroup === group);
    if (rowPlayers.length === 0) continue;
    const x = side === "home" ? HOME_ROW_X[group] : 100 - HOME_ROW_X[group];
    rowPlayers.forEach((player, i) => {
      const y = ((i + 1) / (rowPlayers.length + 1)) * 100;
      slots.push({ player, x, y });
    });
  }
  return slots;
}

/** Players subbed off — rendered as dimmed "ghosts" near their old slot so
 * the substitution reads as a story instead of erasing history. */
function computeGhosts(players: PlayerState[], side: "home" | "away"): Slot[] {
  const ghosts = players.filter((p) => p.isStarter && !p.isOnPitch && p.subbedOffAt);
  return ghosts.map((player, i) => {
    const x = side === "home" ? HOME_ROW_X[player.positionGroup] : 100 - HOME_ROW_X[player.positionGroup];
    const y = 8 + i * 10;
    return { player, x, y };
  });
}

function PlayerBadge({
  slot,
  ghost = false,
  isSelected,
  onSelect,
}: {
  slot: Slot;
  ghost?: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { player } = slot;
  const hasRed = player.cards.some((c) => c.type === "red");
  const hasYellow = player.cards.some((c) => c.type === "yellow");
  const hasGoal = player.goals.length > 0;
  const hasAssist = player.assists.length > 0;
  const team = TEAM_COLOR[player.side];

  return (
    <button
      onClick={onSelect}
      className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
    >
      <span
        className={`relative flex items-center justify-center transition-transform ${
          ghost ? "opacity-45 grayscale" : isSelected ? "scale-115" : "hover:scale-110"
        }`}
        style={
          isSelected && !ghost
            ? { filter: `drop-shadow(0 0 8px ${team.ring})` }
            : undefined
        }
      >
        <Jersey color={team.fill} />
        <span
          className="absolute font-display text-[11px] font-extrabold text-white"
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
        >
          {player.number ?? "?"}
        </span>
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 ${
            isSelected ? "border-accent" : "border-bg"
          }`}
          style={{ background: team.ring }}
        />
        {hasRed && (
          <span className="absolute -right-1.5 -top-1 h-2.5 w-2 rounded-[1px] bg-red-500 shadow-sm" />
        )}
        {!hasRed && hasYellow && (
          <span className="absolute -right-1.5 -top-1 h-2.5 w-2 rounded-[1px] bg-yellow-400 shadow-sm" />
        )}
        {hasGoal && (
          <span className="absolute -bottom-1.5 -left-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent shadow-sm">
            <Icon icon={FootballIcon} size={9} color="#080808" />
          </span>
        )}
        {hasAssist && !hasGoal && (
          <span className="absolute -bottom-1.5 -left-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-accent/50 bg-surface text-[8px] font-bold text-accent shadow-sm">
            A
          </span>
        )}
        {ghost && (
          <span className="absolute -bottom-1.5 -left-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-surface-2 text-text-dimmer shadow-sm">
            <Icon icon={UserSwitchIcon} size={9} />
          </span>
        )}
      </span>
      <span className="mt-1 max-w-[56px] truncate font-mono text-[8px] text-text-dimmer group-hover:text-text-dim">
        {player.name.split(" ").pop()}
      </span>
    </button>
  );
}

function PlayerDetail({ player, onClose }: { player: PlayerState; onClose: () => void }) {
  return (
    <div className="absolute inset-x-3 bottom-3 z-10 rounded-xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-text">{player.name}</p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-dimmer">
            {player.side === "home" ? "Home" : "Away"} · {player.positionGroup}
            {player.number ? ` · #${player.number}` : ""}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border text-text-dimmer hover:text-text"
        >
          ✕
        </button>
      </div>

      {(player.goals.length > 0 || player.assists.length > 0 || player.cards.length > 0 || player.fouls.length > 0 || player.subbedOffAt || player.subbedInAt) ? (
        <ul className="mt-2 flex flex-col gap-1">
          {player.goals.map((g, i) => (
            <li key={`g${i}`} className="flex items-center gap-1.5 font-mono text-[11px] text-accent">
              <Icon icon={FootballIcon} size={11} /> {g.ownGoal ? "Own goal" : "Goal"} {g.minute}
            </li>
          ))}
          {player.assists.map((g, i) => (
            <li key={`a${i}`} className="flex items-center gap-1.5 font-mono text-[11px] text-text">
              <Icon icon={FootballIcon} size={11} color="#666" /> Assist {g.minute}
            </li>
          ))}
          {player.cards.map((c, i) => (
            <li
              key={`c${i}`}
              className={`flex items-center gap-1.5 font-mono text-[11px] ${c.type === "red" ? "text-red-400" : "text-yellow-400"}`}
            >
              <span className={`h-2.5 w-2 rounded-[1px] ${c.type === "red" ? "bg-red-500" : "bg-yellow-400"}`} />
              {c.type === "red" ? "Red card" : "Yellow card"} {c.minute}
            </li>
          ))}
          {player.fouls.map((f, i) => (
            <li key={`f${i}`} className="flex items-center gap-1.5 font-mono text-[11px] text-text-dim">
              Foul {f.minute}
            </li>
          ))}
          {player.subbedOffAt && (
            <li className="flex items-center gap-1.5 font-mono text-[11px] text-text-dim">
              <Icon icon={UserSwitchIcon} size={11} /> Subbed off {player.subbedOffAt}
            </li>
          )}
          {player.subbedInAt && (
            <li className="flex items-center gap-1.5 font-mono text-[11px] text-text-dim">
              <Icon icon={UserSwitchIcon} size={11} /> Subbed on {player.subbedInAt}
            </li>
          )}
        </ul>
      ) : (
        <p className="mt-2 font-mono text-[11px] text-text-dimmer">No events yet.</p>
      )}
    </div>
  );
}

export function PitchView({ home, away }: { home: PlayerState[]; away: PlayerState[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const homeSlots = computeSlots(home, "home");
  const awaySlots = computeSlots(away, "away");
  const homeGhosts = computeGhosts(home, "home");
  const awayGhosts = computeGhosts(away, "away");
  const allPlayers = [...home, ...away];
  const selected = allPlayers.find((p) => p.fixturePlayerId === selectedId) ?? null;

  return (
    <div>
      {/* Legend */}
      <div className="mb-2 flex items-center justify-center gap-4">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-dim">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: TEAM_COLOR.home.fill }} />
          Home
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-dim">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: TEAM_COLOR.away.fill }} />
          Away
        </span>
      </div>

      <div
        className="relative mx-auto w-full overflow-hidden rounded-xl border border-border lg:max-h-[56vh]"
        style={{ aspectRatio: "16 / 10", background: "radial-gradient(ellipse 90% 70% at 50% 50%, #10130f 0%, #0a0c09 70%)" }}
      >
      {/* Pitch markings */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-40" viewBox="0 0 100 62.5" preserveAspectRatio="none">
        <rect x="1" y="1" width="98" height="60.5" fill="none" stroke="#ffffff" strokeWidth="0.3" />
        <line x1="50" y1="1" x2="50" y2="61.5" stroke="#ffffff" strokeWidth="0.3" />
        <circle cx="50" cy="31.25" r="8" fill="none" stroke="#ffffff" strokeWidth="0.3" />
        <rect x="1" y="16" width="14" height="30.5" fill="none" stroke="#ffffff" strokeWidth="0.3" />
        <rect x="85" y="16" width="14" height="30.5" fill="none" stroke="#ffffff" strokeWidth="0.3" />
      </svg>

      {/* Ghosts (subbed off) */}
      {[...homeGhosts, ...awayGhosts].map((slot) => (
        <PlayerBadge
          key={`ghost-${slot.player.fixturePlayerId}`}
          slot={slot}
          ghost
          isSelected={selected?.fixturePlayerId === slot.player.fixturePlayerId}
          onSelect={() => setSelectedId(slot.player.fixturePlayerId)}
        />
      ))}

      {/* On-pitch players */}
      {[...homeSlots, ...awaySlots].map((slot) => (
        <PlayerBadge
          key={slot.player.fixturePlayerId}
          slot={slot}
          isSelected={selected?.fixturePlayerId === slot.player.fixturePlayerId}
          onSelect={() => setSelectedId(slot.player.fixturePlayerId)}
        />
      ))}

      {selected && <PlayerDetail player={selected} onClose={() => setSelectedId(null)} />}
      </div>
    </div>
  );
}
