/**
 * Simple server-side prediction store using an in-process Map.
 * For a hackathon this is perfectly fine — no DB needed.
 * In production this would go to Supabase/Postgres.
 *
 * Each prediction: { walletAddress, fixtureId, type, ts, correct? }
 * Leaderboard: aggregate points per wallet across all fixtures.
 */

import { NextRequest, NextResponse } from "next/server";

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

// In-memory store — survives the process lifetime
const store = new Map<string, Prediction>();

function score(p: Prediction): number {
  if (p.resolvedCorrect == null) return 0; // pending
  return p.resolvedCorrect ? 10 : 0;
}

function leaderboard(): { wallet: string; points: number; predictions: number }[] {
  const byWallet = new Map<string, { points: number; predictions: number }>();
  for (const p of store.values()) {
    const entry = byWallet.get(p.wallet) ?? { points: 0, predictions: 0 };
    entry.predictions += 1;
    entry.points += score(p);
    byWallet.set(p.wallet, entry);
  }
  return [...byWallet.entries()]
    .map(([wallet, v]) => ({ wallet, ...v }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 20);
}

// GET — list predictions for a fixture + leaderboard
export async function GET(req: NextRequest) {
  const fixtureId = Number(req.nextUrl.searchParams.get("fixtureId"));
  const fixturePredictions = fixtureId
    ? [...store.values()].filter((p) => p.fixtureId === fixtureId)
    : [];

  return NextResponse.json({
    predictions: fixturePredictions,
    leaderboard: leaderboard(),
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
  store.set(id, prediction);

  return NextResponse.json({ prediction, leaderboard: leaderboard() }, { status: 201 });
}

// PATCH — resolve a prediction (called internally when a matching event arrives)
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !body.id || body.correct == null) {
    return NextResponse.json({ error: "id and correct required" }, { status: 400 });
  }
  const p = store.get(String(body.id));
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });

  p.resolvedCorrect = Boolean(body.correct);
  p.resolvedAt = Date.now();
  store.set(p.id, p);

  return NextResponse.json({ prediction: p, leaderboard: leaderboard() });
}
