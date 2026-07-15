import { NextRequest, NextResponse } from "next/server";
import {
  API_TOKEN_COOKIE,
  cookieOptions,
  JWT_COOKIE,
  txlineDataFetch,
} from "@/lib/txline/server";

const MS_PER_INTERVAL = 5 * 60 * 1000;
// Scan at most 12 hours back in 5-min buckets for recent/live fixtures
const MAX_HOURS = 12;
const BATCH_SIZE = 8;

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

/**
 * GET /api/txline/history?fixtureId=X&hours=6
 *
 * Strategy (in order):
 * 1. Try /scores/historical/{fixtureId} — covers fixtures whose start time
 *    was between 2 weeks and 6 hours ago. This is the right path for all
 *    finished matches (quarter-finals, semis, etc.).
 * 2. Try /scores/snapshot/{fixtureId} — returns the latest state snapshot;
 *    useful for upcoming or very recently finished matches.
 * 3. Fall back to scanning /scores/updates/{epochDay}/{hour}/{interval}
 *    buckets backwards from now — covers the live/recent window.
 *
 * The first source that returns data wins. All three are tried concurrently
 * for the snapshot + bucket scan to keep latency low.
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

  const hours = Math.min(
    Number(req.nextUrl.searchParams.get("hours") ?? 6) || 6,
    MAX_HOURS
  );

  let currentJwt = jwt;

  // ── 1. Historical endpoint (finished matches, 6h–2wk window) ──────────────
  try {
    const { status, body, renewedJwt } = await txlineDataFetch(
      `/scores/historical/${fixtureId}`,
      currentJwt,
      apiToken
    );
    if (renewedJwt) currentJwt = renewedJwt;
    if (status === 200 && Array.isArray(body) && body.length > 0) {
      const events = dedupAndSort(body as RawUpdate[]);
      const res = NextResponse.json({ events, source: "historical" });
      if (currentJwt !== jwt) res.cookies.set(JWT_COOKIE, currentJwt, cookieOptions);
      return res;
    }
  } catch {
    // Fall through to next strategy
  }

  // ── 2. Scores snapshot (current/recent state) ────────────────────────────
  // The snapshot already reflects the final resolved state (discards applied
  // server-side). Use it alone for finished matches — skip the bucket scan
  // which would re-introduce stale intermediate events.
  const snapResult = await txlineDataFetch(
    `/scores/snapshot/${fixtureId}`,
    currentJwt,
    apiToken
  ).catch(() => null);

  if (snapResult) {
    if (snapResult.renewedJwt) currentJwt = snapResult.renewedJwt;
    if (snapResult.status === 200 && Array.isArray(snapResult.body) && snapResult.body.length > 0) {
      const events = dedupAndSort(snapResult.body as RawUpdate[]);
      const res = NextResponse.json({ events, source: "snapshot" });
      if (currentJwt !== jwt) res.cookies.set(JWT_COOKIE, currentJwt, cookieOptions);
      return res;
    }
  }

  // ── 3. Bucket scan fallback (live/very-recent matches only) ───────────────
  const intervalCount = hours * 12;
  const now = Date.now();
  const targets = Array.from({ length: intervalCount }, (_, i) => now - i * MS_PER_INTERVAL);
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

  const events = dedupAndSort(collected);
  const res = NextResponse.json({ events, source: "scan" });
  if (currentJwt !== jwt) res.cookies.set(JWT_COOKIE, currentJwt, cookieOptions);
  return res;
}
