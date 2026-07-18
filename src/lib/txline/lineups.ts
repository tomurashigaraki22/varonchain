"use client";

import { useEffect, useState } from "react";

type RawEvent = Record<string, unknown>;

export type PositionGroup = "GK" | "DEF" | "MID" | "FWD";

export type CardEvent = { type: "yellow" | "red"; minute?: string; ts?: number };
export type GoalEvent = { minute?: string; ts?: number; ownGoal?: boolean };

export type PlayerState = {
  fixturePlayerId: number;
  /** Global/persistent player id (player.normativeId in the lineup payload).
   * Confirmed against real data: score-event Data.PlayerId is ALWAYS this
   * id, never fixturePlayerId — matched against both in applyEvents purely
   * as defensive belt-and-braces, since the check costs nothing. */
  normativeId?: number;
  name: string;
  number?: string;
  positionGroup: PositionGroup;
  side: "home" | "away";
  isStarter: boolean;
  isOnPitch: boolean;
  subbedOffAt?: string;
  subbedInFor?: number; // fixturePlayerId of the player they replaced
  subbedInAt?: string;
  cards: CardEvent[];
  goals: GoalEvent[];
  assists: GoalEvent[];
  fouls: { minute?: string; ts?: number }[];
};

export type LineupData = {
  home: PlayerState[];
  away: PlayerState[];
  announced: boolean;
};

function num(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/**
 * Confirmed against a real England vs Argentina lineup: positionId runs
 * 34 (GK) / 35 (DEF) / 36 (MID) / 37 (FWD) — cross-checked player-by-player
 * against their real-world positions (Guehi/Burn/Chalobah at 35 are all
 * center-backs, Bellingham/Anderson/Eze at 36 are all midfielders, Gordon
 * at 37 is a forward/winger). Not a documented enum, so anything outside
 * this tight range falls back to MID rather than guessing further.
 */
function positionGroupFromId(positionId: number | undefined): PositionGroup {
  if (positionId === 34) return "GK";
  if (positionId === 35) return "DEF";
  if (positionId === 37) return "FWD";
  return "MID"; // 36, and anything unrecognized
}

type RawLineupPlayer = {
  fixturePlayerId?: unknown;
  statusId?: unknown;
  positionId?: unknown;
  unitId?: unknown;
  rosterNumber?: unknown;
  starter?: unknown;
  starred?: unknown;
  player?: { preferredName?: unknown; team?: unknown; id?: unknown; normativeId?: unknown };
};

/**
 * The docs' lineups schema is a nested `lineups: [{ ..., lineups: [player] }]`
 * shape — outer entries appear to be per-team groups, inner is the roster.
 * Confirmed shape: team-grouped, `[{ preferredName: "England", lineups:
 * [player, ...] }, { preferredName: "Argentina", lineups: [...] }]` — the
 * outer `preferredName` is a real team name, so we match it against the
 * fixture's home/away labels for a robust assignment. Falls back to array
 * order (first group = home) only when the name can't be matched, which
 * mirrors the Participant1IsHome convention used elsewhere in the app.
 *
 * Note: `player.team` (nested, per-player) turned out to be a comma-
 * separated list of team UUIDs, not a name — confirmed unusable for
 * disambiguation, so it's not used here at all.
 */
function splitHomeAway(
  raw: unknown,
  homeTeamName: string,
  awayTeamName: string
): { home: RawLineupPlayer[]; away: RawLineupPlayer[] } {
  if (!Array.isArray(raw) || raw.length === 0) return { home: [], away: [] };

  // Team-grouped shape: [{ preferredName, lineups: [player, ...] }, ...]
  const isGrouped = raw.every((g) => g && typeof g === "object" && Array.isArray((g as Record<string, unknown>).lineups));
  if (isGrouped) {
    const groups = raw as { preferredName?: unknown; lineups: RawLineupPlayer[] }[];
    if (groups.length >= 2) {
      const homeLower = homeTeamName.toLowerCase();
      const awayLower = awayTeamName.toLowerCase();
      const named = groups.map((g) => str(g.preferredName)?.toLowerCase());
      const homeIdx = named.findIndex((n) => n && (homeLower.includes(n) || n.includes(homeLower)));
      const awayIdx = named.findIndex((n) => n && (awayLower.includes(n) || n.includes(awayLower)));
      if (homeIdx !== -1 && awayIdx !== -1 && homeIdx !== awayIdx) {
        return { home: groups[homeIdx].lineups ?? [], away: groups[awayIdx].lineups ?? [] };
      }
      return { home: groups[0].lineups ?? [], away: groups[1].lineups ?? [] };
    }
    if (groups.length === 1) return { home: groups[0].lineups ?? [], away: [] };
    return { home: [], away: [] };
  }

  // Flat shape fallback — unconfirmed for this provider, kept only in case
  // a different fixture/competition ever returns players without the
  // team-grouping wrapper.
  const flat = raw as RawLineupPlayer[];
  const home: RawLineupPlayer[] = [];
  const away: RawLineupPlayer[] = [];
  for (const p of flat) {
    const teamName = str(p.player?.team)?.toLowerCase();
    if (teamName && homeTeamName.toLowerCase().includes(teamName)) home.push(p);
    else if (teamName && awayTeamName.toLowerCase().includes(teamName)) away.push(p);
    else home.push(p); // unresolvable — default to home rather than drop
  }
  return { home, away };
}

/** preferredName arrives as "Last, First Middle" (e.g. "Romero, Cristian
 * Gabriel") — flip to "First Middle Last" for display. */
function formatPlayerName(raw: string): string {
  const commaIdx = raw.indexOf(",");
  if (commaIdx === -1) return raw;
  const last = raw.slice(0, commaIdx).trim();
  const first = raw.slice(commaIdx + 1).trim();
  return first ? `${first} ${last}` : last;
}

function toPlayerState(p: RawLineupPlayer, side: "home" | "away"): PlayerState | null {
  const fixturePlayerId = num(p.fixturePlayerId);
  if (fixturePlayerId == null) return null;
  const rawName = str(p.player?.preferredName) ?? "Unknown";
  return {
    fixturePlayerId,
    normativeId: num(p.player?.normativeId),
    name: formatPlayerName(rawName),
    number: str(p.rosterNumber),
    positionGroup: positionGroupFromId(num(p.positionId)),
    side,
    isStarter: p.starter === true,
    isOnPitch: p.starter === true,
    cards: [],
    goals: [],
    assists: [],
    fouls: [],
  };
}

/**
 * Field names for the player(s) involved in a score event. PlayerId is
 * confirmed (against a real goal + card event) to be the player's global
 * normativeId, not fixturePlayerId. AssistPlayerId is still an unconfirmed
 * best-effort guess — no assist field is documented anywhere in the docs.
 */
function eventPlayerIds(raw: RawEvent): {
  scorer?: number;
  assister?: number;
  carded?: number;
  subOut?: number;
  subIn?: number;
  fouler?: number;
} {
  const data = (raw.Data ?? raw.data) as Record<string, unknown> | undefined;
  return {
    scorer: num(data?.PlayerId ?? data?.playerId),
    assister: num(data?.AssistPlayerId ?? data?.assistPlayerId ?? data?.AssistId ?? data?.assistId),
    carded: num(data?.PlayerId ?? data?.playerId),
    subOut: num(data?.PlayerOutId ?? data?.playerOutId),
    subIn: num(data?.PlayerInId ?? data?.playerInId),
    fouler: num(data?.PlayerId ?? data?.playerId),
  };
}

function tsMinuteLabel(raw: RawEvent): string | undefined {
  const clk = (raw.Clock ?? raw.clock) as Record<string, unknown> | undefined;
  const secs = num(clk?.Seconds ?? clk?.seconds);
  if (secs == null || secs < 0) return undefined;
  return `${Math.floor(secs / 60) + 1}'`;
}

/** Cross-reference the fetched roster with the live/history event stream to
 * mark cards, goals, assists, fouls, and substitutions on the right player.
 * Matches event player ids against BOTH fixturePlayerId and normativeId
 * (see eventPlayerIds) since it's unconfirmed which one the feed uses. */
function applyEvents(players: PlayerState[], events: RawEvent[]): PlayerState[] {
  const cloned = players.map((p) => ({
    ...p,
    cards: [...p.cards],
    goals: [...p.goals],
    assists: [...p.assists],
    fouls: [...p.fouls],
  }));
  const byId = new Map<number, (typeof cloned)[number]>();
  for (const p of cloned) {
    byId.set(p.fixturePlayerId, p);
    if (p.normativeId != null) byId.set(p.normativeId, p);
  }

  for (const raw of events) {
    const action = String(raw.Action ?? raw.action ?? "").toLowerCase();
    const ids = eventPlayerIds(raw);
    const minute = tsMinuteLabel(raw);
    const ts = num(raw.Ts ?? raw.ts);

    if (action === "goal" || action === "penalty_goal") {
      const p = ids.scorer != null ? byId.get(ids.scorer) : undefined;
      p?.goals.push({ minute, ts });
      const assister = ids.assister != null ? byId.get(ids.assister) : undefined;
      assister?.assists.push({ minute, ts });
    } else if (action === "own_goal") {
      const p = ids.scorer != null ? byId.get(ids.scorer) : undefined;
      p?.goals.push({ minute, ts, ownGoal: true });
    } else if (action === "yellow_card") {
      const p = ids.carded != null ? byId.get(ids.carded) : undefined;
      p?.cards.push({ type: "yellow", minute, ts });
    } else if (action === "red_card") {
      const p = ids.carded != null ? byId.get(ids.carded) : undefined;
      p?.cards.push({ type: "red", minute, ts });
    } else if (action === "substitution") {
      const off = ids.subOut != null ? byId.get(ids.subOut) : undefined;
      const on = ids.subIn != null ? byId.get(ids.subIn) : undefined;
      if (off) {
        off.isOnPitch = false;
        off.subbedOffAt = minute;
      }
      if (on) {
        on.isOnPitch = true;
        on.subbedInFor = ids.subOut;
        on.subbedInAt = minute;
      }
    } else if (action === "free_kick") {
      // Docs: fouls aren't a separate action — a free_kick whose
      // FreeKickType isn't "Offside" is the foul.
      const data = (raw.Data ?? raw.data) as Record<string, unknown> | undefined;
      const kickType = str(data?.FreeKickType ?? data?.freeKickType)?.toLowerCase();
      if (kickType && kickType !== "offside") {
        const p = ids.fouler != null ? byId.get(ids.fouler) : undefined;
        p?.fouls.push({ minute, ts });
      }
    }
  }

  return cloned;
}

export function usePlayerLineups(
  fixtureId: number,
  fixtureLabel: string,
  events: RawEvent[]
): LineupData {
  const [rawLineups, setRawLineups] = useState<unknown>(null);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!fixtureId) return;
    let cancelled = false;

    Promise.resolve().then(() => {
      if (!cancelled) {
        setRawLineups(null);
        setAttempted(false);
      }
    });

    // Lineups are announced ~1h before kickoff and don't change after that
    // (substitutions are derived from the event stream, not re-fetched), so
    // a couple of retries covers "not announced yet" without hammering.
    let attempt = 0;
    const MAX_ATTEMPTS = 3;

    const load = () => {
      fetch(`/api/txline/proxy/scores/snapshot/${fixtureId}`)
        .then((r) => r.json())
        .then((data: unknown) => {
          if (cancelled) return;
          const items = Array.isArray(data) ? data : [data];
          const withLineups = (items as RawEvent[]).find(
            (item) => Array.isArray(item.lineups) || Array.isArray(item.Lineups)
          );
          const found = withLineups?.lineups ?? withLineups?.Lineups ?? null;
          if (found) {
            setRawLineups(found);
          } else if (attempt < MAX_ATTEMPTS - 1) {
            attempt += 1;
            setTimeout(load, 4000);
          }
          setAttempted(true);
        })
        .catch(() => {
          if (!cancelled) setAttempted(true);
        });
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [fixtureId]);

  const [home, away] = fixtureLabel.split(" vs ").map((s) => s.trim());
  const { home: rawHome, away: rawAway } = splitHomeAway(rawLineups, home ?? "", away ?? "");

  const homePlayers = rawHome.map((p) => toPlayerState(p, "home")).filter((p): p is PlayerState => p != null);
  const awayPlayers = rawAway.map((p) => toPlayerState(p, "away")).filter((p): p is PlayerState => p != null);

  const enriched = applyEvents([...homePlayers, ...awayPlayers], events);

  return {
    home: enriched.filter((p) => p.side === "home"),
    away: enriched.filter((p) => p.side === "away"),
    announced: attempted && (homePlayers.length > 0 || awayPlayers.length > 0),
  };
}
