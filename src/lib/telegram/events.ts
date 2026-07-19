import { scoreFromEvent } from "../txline/scoreSoccer";
import { txlineDataFetch } from "../txline/server";
import type { FixtureMeta } from "./store";

type RawEvent = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}
function num(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

function actionOf(raw: RawEvent): string {
  return String(raw.Action ?? raw.action ?? "").toLowerCase();
}
function dataOf(raw: RawEvent): RawEvent {
  return (raw.Data ?? raw.data ?? {}) as RawEvent;
}

/** "Rice, Declan" -> "Declan Rice" */
function formatPlayerName(raw: string): string {
  const parts = raw.split(",").map((p) => p.trim());
  if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
  return raw;
}

// Per-fixture PlayerId -> display name, resolved once from the lineup
// snapshot and cached for the process lifetime (same fixture never changes
// its roster mid-match).
const rosterCache = new Map<number, Map<number, string>>();

export async function getRoster(
  fixtureId: number,
  jwt: string,
  apiToken: string
): Promise<Map<number, string>> {
  const cached = rosterCache.get(fixtureId);
  if (cached) return cached;

  const roster = new Map<number, string>();
  try {
    const { body } = await txlineDataFetch(`/scores/snapshot/${fixtureId}`, jwt, apiToken);
    const items: RawEvent[] = Array.isArray(body) ? (body as RawEvent[]) : [];
    for (const item of items) {
      const teams = (item.lineups ?? item.Lineups) as RawEvent[] | undefined;
      if (!Array.isArray(teams)) continue;
      for (const team of teams) {
        const players = (team.lineups ?? team.Lineups) as RawEvent[] | undefined;
        if (!Array.isArray(players)) continue;
        for (const p of players) {
          const name = str(p.preferredName ?? p.PreferredName);
          if (!name) continue;
          const formatted = formatPlayerName(name);
          const fixturePlayerId = num(p.fixturePlayerId ?? p.FixturePlayerId);
          const normativeId = num(p.normativeId ?? p.NormativeId);
          if (fixturePlayerId != null) roster.set(fixturePlayerId, formatted);
          if (normativeId != null) roster.set(normativeId, formatted);
        }
      }
      break;
    }
  } catch {
    // Best-effort — notifications still go out without a resolved name.
  }
  // Only cache a non-empty roster. A card/goal can arrive right at kickoff,
  // before TxLINE's snapshot has lineups populated yet — caching an empty
  // result here would permanently lock every notification for the rest of
  // the match onto "A player" even once the roster becomes available
  // seconds later. An empty result just means "try again next event."
  if (roster.size > 0) rosterCache.set(fixtureId, roster);
  return roster;
}

function playerName(roster: Map<number, string>, id: unknown): string | undefined {
  const n = num(id);
  if (n == null) return undefined;
  return roster.get(n);
}

export type FormattedEvent = { emoji: string; text: string };

/**
 * Turns one raw TxLINE score event into a Telegram message, or null if it's
 * not something worth pushing a notification for. Only the actions a fan
 * actually wants to be interrupted for are covered — everything else (subs,
 * fouls, throw-ins) stays in-app only.
 */
export function formatEvent(
  raw: RawEvent,
  meta: FixtureMeta,
  roster: Map<number, string>
): FormattedEvent | null {
  const action = actionOf(raw);
  const data = dataOf(raw);
  const score = scoreFromEvent(raw);
  const scoreLine =
    score.home != null && score.away != null
      ? `\n<b>${meta.home} ${score.home} - ${score.away} ${meta.away}</b>`
      : "";

  switch (action) {
    case "goal": {
      const scorer = playerName(roster, data.PlayerId);
      const assist = playerName(roster, data.AssistPlayerId);
      const who = scorer ? ` — ${scorer}` : "";
      const withAssist = assist ? ` (assist: ${assist})` : "";
      return { emoji: "⚽", text: `GOAL!${who}${withAssist}${scoreLine}` };
    }
    case "own_goal": {
      const scorer = playerName(roster, data.PlayerId);
      const who = scorer ? ` — ${scorer}` : "";
      return { emoji: "⚽", text: `OWN GOAL!${who}${scoreLine}` };
    }
    case "yellow_card": {
      const who = playerName(roster, data.PlayerId) ?? "A player";
      return { emoji: "🟨", text: `Yellow card — ${who}` };
    }
    case "red_card": {
      const who = playerName(roster, data.PlayerId) ?? "A player";
      return { emoji: "🟥", text: `RED CARD — ${who}` };
    }
    // Confirmed real action name from EventFeed.tsx's own live-data
    // classification is "penalty" (award), not "penalty_awarded" — that
    // guessed name meant this case never matched a real event.
    case "penalty":
      return { emoji: "🎯", text: "Penalty awarded!" };
    case "penalty_outcome": {
      const outcome = str(data.Outcome) ?? "resolved";
      const who = playerName(roster, data.PlayerId);
      const whoText = who ? ` — ${who}` : "";
      return { emoji: outcome === "Scored" ? "⚽" : "🎯", text: `Penalty ${outcome.toLowerCase()}${whoText}${scoreLine}` };
    }
    case "var":
      return { emoji: "📺", text: `VAR review in progress — ${str(data.Type) ?? "checking"}` };
    case "var_end": {
      const outcome = str(data.Outcome) ?? "resolved";
      return { emoji: "📺", text: `VAR review: ${outcome}` };
    }
    case "halftime_finalised":
      return { emoji: "⏸️", text: `Half time${scoreLine}` };
    case "game_finalised":
      return { emoji: "🏁", text: `Full time${scoreLine}` };
    default:
      return null;
  }
}
