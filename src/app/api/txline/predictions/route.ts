/**
 * Prediction store backed by MySQL (see schema.sql / lib/db.ts) — persists
 * across restarts and deploys, unlike the earlier in-memory Map version.
 *
 * Each prediction: { walletAddress, fixtureId, type, ts, correct? }
 * Leaderboard: aggregate points per wallet across all fixtures.
 */

import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";

type PredictionType = "goal" | "card" | "corner" | "penalty";

type Prediction = {
  id: string;
  wallet: string;
  fixtureId: number;
  type: PredictionType;
  ts: number;
  resolvedCorrect?: boolean;
  resolvedAt?: number;
};

type PredictionRow = RowDataPacket & {
  id: string;
  wallet: string;
  fixture_id: number;
  type: PredictionType;
  ts: number;
  resolved_correct: number | null;
  resolved_at: number | null;
};

type LeaderboardRow = RowDataPacket & { wallet: string; points: number; predictions: number };

function toPrediction(row: PredictionRow): Prediction {
  return {
    id: row.id,
    wallet: row.wallet,
    fixtureId: Number(row.fixture_id),
    type: row.type,
    ts: Number(row.ts),
    resolvedCorrect: row.resolved_correct == null ? undefined : !!row.resolved_correct,
    resolvedAt: row.resolved_at == null ? undefined : Number(row.resolved_at),
  };
}

async function leaderboard(): Promise<{ wallet: string; points: number; predictions: number }[]> {
  const [rows] = await getPool().query<LeaderboardRow[]>(
    `SELECT wallet,
            SUM(CASE WHEN resolved_correct = 1 THEN 10 ELSE 0 END) AS points,
            COUNT(*) AS predictions
     FROM predictions
     GROUP BY wallet
     ORDER BY points DESC
     LIMIT 20`
  );
  return rows.map((r) => ({ wallet: r.wallet, points: Number(r.points), predictions: Number(r.predictions) }));
}

// GET — list predictions for a fixture + leaderboard
export async function GET(req: NextRequest) {
  const fixtureId = Number(req.nextUrl.searchParams.get("fixtureId"));

  let fixturePredictions: Prediction[] = [];
  if (fixtureId) {
    const [rows] = await getPool().query<PredictionRow[]>(
      "SELECT * FROM predictions WHERE fixture_id = ? ORDER BY ts DESC",
      [fixtureId]
    );
    fixturePredictions = rows.map(toPrediction);
  }

  return NextResponse.json({
    predictions: fixturePredictions,
    leaderboard: await leaderboard(),
  });
}

// POST — submit a prediction
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !body.wallet || !body.fixtureId || !body.type) {
    return NextResponse.json({ error: "wallet, fixtureId, type required" }, { status: 400 });
  }

  const valid: PredictionType[] = ["goal", "card", "corner", "penalty"];
  if (!valid.includes(body.type)) {
    return NextResponse.json({ error: "type must be goal | card | corner | penalty" }, { status: 400 });
  }

  const id = `${body.wallet}-${body.fixtureId}-${Date.now()}`;
  const prediction: Prediction = {
    id,
    wallet: String(body.wallet),
    fixtureId: Number(body.fixtureId),
    type: body.type as PredictionType,
    ts: Date.now(),
  };

  await getPool().execute(
    "INSERT INTO predictions (id, wallet, fixture_id, type, ts) VALUES (?, ?, ?, ?, ?)",
    [prediction.id, prediction.wallet, prediction.fixtureId, prediction.type, prediction.ts]
  );

  return NextResponse.json({ prediction, leaderboard: await leaderboard() }, { status: 201 });
}

// PATCH — resolve a prediction (called internally when a matching event arrives)
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !body.id || body.correct == null) {
    return NextResponse.json({ error: "id and correct required" }, { status: 400 });
  }

  const resolvedAt = Date.now();
  const [result] = await getPool().execute(
    "UPDATE predictions SET resolved_correct = ?, resolved_at = ? WHERE id = ?",
    [body.correct ? 1 : 0, resolvedAt, String(body.id)]
  );
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const [rows] = await getPool().query<PredictionRow[]>("SELECT * FROM predictions WHERE id = ?", [body.id]);
  return NextResponse.json({ prediction: toPrediction(rows[0]), leaderboard: await leaderboard() });
}
