/**
 * "Crowd Pulse Trader" — call whether the live home-win implied probability
 * (from TxLINE's StablePrice odds feed) will be higher or lower 60 seconds
 * from now. Resolved server-side by comparing the recorded baseline against
 * the pct supplied at resolve time.
 *
 * Backed by MySQL (see schema.sql / lib/db.ts) — persists across restarts,
 * same as /api/txline/predictions.
 */
import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";

const RESOLVE_WINDOW_MS = 60_000;

type PulseCall = {
  id: string;
  wallet: string;
  fixtureId: number;
  direction: "up" | "down";
  baselinePct: number;
  ts: number;
  resolveAt: number;
  resolvedCorrect?: boolean;
  resolvedPct?: number;
  resolvedAt?: number;
};

type PulseRow = RowDataPacket & {
  id: string;
  wallet: string;
  fixture_id: number;
  direction: "up" | "down";
  baseline_pct: number;
  ts: number;
  resolve_at: number;
  resolved_correct: number | null;
  resolved_pct: number | null;
  resolved_at: number | null;
};

type LeaderboardRow = RowDataPacket & { wallet: string; points: number; calls: number };

function toCall(row: PulseRow): PulseCall {
  return {
    id: row.id,
    wallet: row.wallet,
    fixtureId: Number(row.fixture_id),
    direction: row.direction,
    baselinePct: Number(row.baseline_pct),
    ts: Number(row.ts),
    resolveAt: Number(row.resolve_at),
    resolvedCorrect: row.resolved_correct == null ? undefined : !!row.resolved_correct,
    resolvedPct: row.resolved_pct == null ? undefined : Number(row.resolved_pct),
    resolvedAt: row.resolved_at == null ? undefined : Number(row.resolved_at),
  };
}

async function leaderboard(): Promise<{ wallet: string; points: number; calls: number }[]> {
  const [rows] = await getPool().query<LeaderboardRow[]>(
    `SELECT wallet,
            SUM(CASE WHEN resolved_correct = 1 THEN 10 ELSE 0 END) AS points,
            COUNT(*) AS calls
     FROM pulse_calls
     GROUP BY wallet
     ORDER BY points DESC
     LIMIT 20`
  );
  return rows.map((r) => ({ wallet: r.wallet, points: Number(r.points), calls: Number(r.calls) }));
}

// GET — list calls for a fixture + leaderboard
export async function GET(req: NextRequest) {
  const fixtureId = Number(req.nextUrl.searchParams.get("fixtureId"));

  let calls: PulseCall[] = [];
  if (fixtureId) {
    const [rows] = await getPool().query<PulseRow[]>(
      "SELECT * FROM pulse_calls WHERE fixture_id = ? ORDER BY ts DESC",
      [fixtureId]
    );
    calls = rows.map(toCall);
  }

  return NextResponse.json({ calls, leaderboard: await leaderboard() });
}

// POST — lock in a call
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !body.wallet || !body.fixtureId || !body.direction || body.baselinePct == null) {
    return NextResponse.json(
      { error: "wallet, fixtureId, direction, baselinePct required" },
      { status: 400 }
    );
  }
  if (body.direction !== "up" && body.direction !== "down") {
    return NextResponse.json({ error: "direction must be up | down" }, { status: 400 });
  }

  // One pending call per wallet per fixture at a time
  const [pendingRows] = await getPool().query<RowDataPacket[]>(
    "SELECT id FROM pulse_calls WHERE wallet = ? AND fixture_id = ? AND resolved_correct IS NULL LIMIT 1",
    [body.wallet, Number(body.fixtureId)]
  );
  if (pendingRows.length > 0) {
    return NextResponse.json({ error: "You already have a pending call on this fixture" }, { status: 409 });
  }

  const id = `${body.wallet}-${body.fixtureId}-${Date.now()}`;
  const now = Date.now();
  const call: PulseCall = {
    id,
    wallet: String(body.wallet),
    fixtureId: Number(body.fixtureId),
    direction: body.direction,
    baselinePct: Number(body.baselinePct),
    ts: now,
    resolveAt: now + RESOLVE_WINDOW_MS,
  };

  await getPool().execute(
    "INSERT INTO pulse_calls (id, wallet, fixture_id, direction, baseline_pct, ts, resolve_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [call.id, call.wallet, call.fixtureId, call.direction, call.baselinePct, call.ts, call.resolveAt]
  );

  return NextResponse.json({ call, leaderboard: await leaderboard() });
}

// PATCH — resolve a call by supplying the current pct
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.id || body.currentPct == null) {
    return NextResponse.json({ error: "id and currentPct required" }, { status: 400 });
  }

  const [rows] = await getPool().query<PulseRow[]>("SELECT * FROM pulse_calls WHERE id = ?", [body.id]);
  if (rows.length === 0) return NextResponse.json({ error: "Call not found" }, { status: 404 });
  const call = toCall(rows[0]);

  if (call.resolvedCorrect != null) {
    return NextResponse.json({ call, leaderboard: await leaderboard() });
  }

  const currentPct = Number(body.currentPct);
  const correct = call.direction === "up" ? currentPct > call.baselinePct : currentPct < call.baselinePct;
  const resolvedAt = Date.now();

  await getPool().execute(
    "UPDATE pulse_calls SET resolved_correct = ?, resolved_pct = ?, resolved_at = ? WHERE id = ?",
    [correct ? 1 : 0, currentPct, resolvedAt, call.id]
  );

  const updated: PulseCall = { ...call, resolvedCorrect: correct, resolvedPct: currentPct, resolvedAt };
  return NextResponse.json({ call: updated, leaderboard: await leaderboard() });
}
