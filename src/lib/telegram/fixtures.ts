import { txlineDataFetch } from "../txline/server";
import { WORLD_CUP_COMPETITION_ID } from "./config";
import { setFixtureMeta, type FixtureMeta } from "./store";

type RawFixture = Record<string, unknown>;

function todayEpochDay(): number {
  return Math.floor(Date.now() / 86400000);
}

function fixtureIdOf(fx: RawFixture): number | undefined {
  const v = fx.FixtureId ?? fx.Id;
  return typeof v === "number" ? v : Number(v) || undefined;
}

function labelOf(fx: RawFixture): FixtureMeta {
  const home = String(fx.Participant1 ?? fx.HomeTeam ?? fx.Home ?? "?");
  const away = String(fx.Participant2 ?? fx.AwayTeam ?? fx.Away ?? "?");
  return { home, away, label: `${home} vs ${away}` };
}

export type FixtureListItem = FixtureMeta & { fixtureId: number; startTime?: number };

/**
 * Fetches fixtures in a window around "now" (yesterday through 14 days out
 * — matches the app's own useFixtures window) and caches each one's
 * home/away meta in the shared store so later subscribe/callback flows
 * don't need to refetch just to render a label.
 */
export async function listFixtures(jwt: string, apiToken: string): Promise<FixtureListItem[]> {
  const startEpochDay = todayEpochDay() - 1;
  const endEpochDay = todayEpochDay() + 14;
  const { body } = await txlineDataFetch(
    `/fixtures/snapshot?competitionId=${WORLD_CUP_COMPETITION_ID}&startEpochDay=${startEpochDay}&endEpochDay=${endEpochDay}`,
    jwt,
    apiToken
  );
  const raw: RawFixture[] = Array.isArray(body) ? (body as RawFixture[]) : ((body as { fixtures?: RawFixture[] })?.fixtures ?? []);

  const items: FixtureListItem[] = [];
  for (const fx of raw) {
    const fixtureId = fixtureIdOf(fx);
    if (fixtureId == null) continue;
    const meta = labelOf(fx);
    setFixtureMeta(fixtureId, meta);
    const startTime = Number(fx.StartTime ?? 0) || undefined;
    items.push({ fixtureId, startTime, ...meta });
  }

  items.sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0));
  return items;
}

export async function resolveFixtureMeta(
  fixtureId: number,
  jwt: string,
  apiToken: string
): Promise<FixtureMeta | undefined> {
  const items = await listFixtures(jwt, apiToken);
  return items.find((f) => f.fixtureId === fixtureId);
}
