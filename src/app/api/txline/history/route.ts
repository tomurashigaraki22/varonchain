import { NextRequest, NextResponse } from "next/server";
import {
  API_TOKEN_COOKIE,
  cookieOptions,
  JWT_COOKIE,
  txlineDataFetch,
} from "@/lib/txline/server";

const MS_PER_INTERVAL = 5 * 60 * 1000;
// Regulation (90) + half time (15) + extra time (30) + stoppage buffer
const MATCH_WINDOW_HOURS = 3.5;
const MAX_SCAN_HOURS = 12;
const BATCH_SIZE = 8;
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

type RawUpdate = Record<string, unknown>;

/**
 * Deduplicate and sort score events.
 *
 * TxLINE event identity rules (from schema):
 *
 *   action_amend:
 *     - Top-level `Id` is the amend's own new Id (ignore it for dedup).
 *     - `Data.Id` is the Id of the original action being amended.
 *     - `Data.Action` is the original action type.
 *     - We resolve these by patching the original event in-place with the
 *       amend's Score/Ts/Data.New, preserving the original Action type.
 *
 *   action_discarded:
 *     - `Id` field IS the Id of the action to void (per schema description).
 *     - Remove the event with that Id from the output.
 *
 * After resolving, sort by Ts ascending.
 */
function dedupAndSort(collected: RawUpdate[]): RawUpdate[] {
  // Sort by Seq ascending so amendments always come after their originals
  const bySeq = [...collected].sort(
    (a, b) => Number(a.Seq ?? a.seq ?? 0) - Number(b.Seq ?? b.seq ?? 0)
  );

  // First pass: collect all discarded Ids so we can filter regardless of order
  const discarded = new Set<number>();
  for (const r of bySeq) {
    const action = String(r.Action ?? r.action ?? "").toLowerCase();
    if (action === "action_discarded") {
      const id = Number(r.Id ?? r.id ?? NaN);
      if (!isNaN(id)) discarded.add(id);
    }
  }

  // Second pass: build canonical event map, skip discards and amend meta-events
  const byId = new Map<number, RawUpdate>();

  for (const r of bySeq) {
    const action = String(r.Action ?? r.action ?? "").toLowerCase();
    const id = Number(r.Id ?? r.id ?? NaN);

    // Skip discard notices — they are not real events
    if (action === "action_discarded") continue;

    // Skip action_amend meta-events — patch the original instead
    if (action === "action_amend") {
      const data = r.Data as Record<string, unknown> | undefined;
      const origId = Number(data?.Id ?? NaN);
      if (!isNaN(origId) && byId.has(origId)) {
        const orig = byId.get(origId)!;
        byId.set(origId, {
          ...orig,
          ...(r.Score !== undefined ? { Score: r.Score } : {}),
          ...(r.Ts !== undefined ? { Ts: r.Ts } : {}),
          Data: data?.New
            ? { ...(orig.Data as object ?? {}), ...(data.New as object) }
            : orig.Data,
        });
      }
      continue;
    }

    if (isNaN(id)) continue;

    // Skip events that were discarded
    if (discarded.has(id)) continue;

    byId.set(id, r);
  }

  const result = Array.from(byId.values());
  result.sort((a, b) => Number(a.Ts ?? a.ts ?? 0) - Number(b.Ts ?? b.ts ?? 0));
  return result;
}

/** Scan 5-minute update buckets across [fromMs, fromMs + windowHours). */
async function scanBuckets(
  fixtureId: string,
  fromMs: number,
  windowHours: number,
  jwt: string,
  apiToken: string
): Promise<{ events: RawUpdate[]; jwt: string }> {
  let currentJwt = jwt;
  const intervalCount = Math.ceil((windowHours * 60) / 5);
  const targets = Array.from({ length: intervalCount }, (_, i) => fromMs + i * MS_PER_INTERVAL);
  const collected: RawUpdate[] = [];

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (ts) => {
        const d = new Date(ts);
        const epochDay = Math.floor(ts / 86400000);
        const hourOfDay = d.getUTCHours();
        const interval = Math.floor(d.getUTCMinutes() / 5);
        const path = `/scores/updates/${epochDay}/${hourOfDay}/${interval}?fixtureId=${fixtureId}`;
        try {
          const { status, body, renewedJwt } = await txlineDataFetch(path, currentJwt, apiToken);
          if (renewedJwt) currentJwt = renewedJwt;
          if (status === 200 && Array.isArray(body)) return body as RawUpdate[];
        } catch { /* ignore */ }
        return [] as RawUpdate[];
      })
    );
    results.forEach((arr) => collected.push(...arr));
  }

  return { events: collected, jwt: currentJwt };
}

/**
 * GET /api/txline/history?fixtureId=X&startTime=<epochMs>&hours=6
 *
 * The bucket-scan endpoint (/scores/updates/{epochDay}/{hour}/{interval}) is
 * the ONLY source that returns a true chronological event log. The
 * "historical"/"snapshot" endpoints instead return one row per DISTINCT
 * ACTION TYPE (its latest occurrence) — a 3-goal match's snapshot has
 * exactly one "goal" row, not three — so they cannot represent a full
 * timeline and are only used as a last-resort fallback (at least shows
 * *something*) when the bucket scan comes back empty (e.g. a match old
 * enough to be outside the update-bucket retention window).
 *
 * Strategy:
 * 1. If `startTime` (fixture kickoff) is known, scan buckets across the
 *    actual match window [kickoff, kickoff + ~3.5h) — covers the real
 *    match regardless of how long ago it was played.
 * 2. If `startTime` is unknown (e.g. manual fixture-ID entry), scan
 *    backwards from now for `hours` — best effort for a presumed-live match.
 * 3. If the scan returns nothing, fall back to /scores/historical or
 *    /scores/snapshot so at least the current state is shown.
 */
export async function GET(req: NextRequest) {
  const jwt = req.cookies.get(JWT_COOKIE)?.value;
  const apiToken = req.cookies.get(API_TOKEN_COOKIE)?.value;

  if (!jwt || !apiToken) {
    return NextResponse.json(
      { error: "Not activated. Connect a wallet and activate the free tier first." },
      { status: 401 }
    );
  }

  const fixtureId = req.nextUrl.searchParams.get("fixtureId");
  if (!fixtureId) {
    return NextResponse.json({ error: "fixtureId is required" }, { status: 400 });
  }

  const startTimeParam = Number(req.nextUrl.searchParams.get("startTime") ?? NaN);
  const hasStartTime = !isNaN(startTimeParam) && startTimeParam > 0;
  const now = Date.now();

  const hours = Math.min(
    Number(req.nextUrl.searchParams.get("hours") ?? 6) || 6,
    MAX_SCAN_HOURS
  );

  let currentJwt = jwt;
  let events: RawUpdate[] = [];
  let source: string;

  if (hasStartTime && now - startTimeParam < TWO_WEEKS_MS + MATCH_WINDOW_HOURS * 3_600_000) {
    // Known kickoff, within retention — scan the real match window.
    const scan = await scanBuckets(fixtureId, startTimeParam, MATCH_WINDOW_HOURS, currentJwt, apiToken);
    currentJwt = scan.jwt;
    events = dedupAndSort(scan.events);
    source = "scan:kickoff";
  } else {
    // Unknown kickoff — best effort, scan backwards from now (live match assumption).
    const scan = await scanBuckets(fixtureId, now - hours * 3_600_000, hours, currentJwt, apiToken);
    currentJwt = scan.jwt;
    events = dedupAndSort(scan.events);
    source = "scan:recent";
  }

  if (events.length === 0) {
    // Fallback: at least surface current state via the per-action snapshots.
    try {
      const { status, body, renewedJwt } = await txlineDataFetch(
        `/scores/historical/${fixtureId}`,
        currentJwt,
        apiToken
      );
      if (renewedJwt) currentJwt = renewedJwt;
      if (status === 200 && Array.isArray(body) && body.length > 0) {
        events = dedupAndSort(body as RawUpdate[]);
        source = "historical";
      }
    } catch { /* fall through */ }
  }

  if (events.length === 0) {
    const snapResult = await txlineDataFetch(`/scores/snapshot/${fixtureId}`, currentJwt, apiToken).catch(
      () => null
    );
    if (snapResult) {
      if (snapResult.renewedJwt) currentJwt = snapResult.renewedJwt;
      if (snapResult.status === 200 && Array.isArray(snapResult.body) && snapResult.body.length > 0) {
        events = dedupAndSort(snapResult.body as RawUpdate[]);
        source = "snapshot";
      }
    }
  }

  const res = NextResponse.json({ events, source });
  if (currentJwt !== jwt) res.cookies.set(JWT_COOKIE, currentJwt, cookieOptions);
  return res;
}
