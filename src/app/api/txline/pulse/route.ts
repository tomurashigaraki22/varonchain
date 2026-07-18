/**
 * "Crowd Pulse Trader" — call whether the live home-win implied probability
 * (from TxLINE's StablePrice odds feed) will be higher or lower 60 seconds
 * from now. Resolved server-side by comparing the recorded baseline against
 * the pct supplied at resolve time — a real value comparison, unlike the
 * other prediction game's client-trusted "an action arrived" check.
 *
 * Same in-memory-Map approach as /api/txline/predictions: fine for a
 * hackathon, would move to Postgres/Supabase for production.
 */
import { NextRequest, NextResponse } from "next/server";

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

const store = new Map<string, PulseCall>();

function score(c: PulseCall): number {
  if (c.resolvedCorrect == null) return 0;
  return c.resolvedCorrect ? 10 : 0;
}

function leaderboard(): { wallet: string; points: number; calls: number }[] {
  const byWallet = new Map<string, { points: number; calls: number }>();
  for (const c of store.values()) {
    const entry = byWallet.get(c.wallet) ?? { points: 0, calls: 0 };
    entry.calls += 1;
    entry.points += score(c);
    byWallet.set(c.wallet, entry);
  }
  return [...byWallet.entries()]
    .map(([wallet, v]) => ({ wallet, ...v }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 20);
}

// GET — list calls for a fixture + leaderboard
export async function GET(req: NextRequest) {
  const fixtureId = Number(req.nextUrl.searchParams.get("fixtureId"));
  const calls = fixtureId
    ? [...store.values()].filter((c) => c.fixtureId === fixtureId)
    : [];

  return NextResponse.json({ calls, leaderboard: leaderboard() });
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
  const existingPending = [...store.values()].some(
    (c) => c.wallet === body.wallet && c.fixtureId === Number(body.fixtureId) && c.resolvedCorrect == null
  );
  if (existingPending) {
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
  store.set(id, call);

  return NextResponse.json({ call, leaderboard: leaderboard() });
}

// PATCH — resolve a call by supplying the current pct
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.id || body.currentPct == null) {
    return NextResponse.json({ error: "id and currentPct required" }, { status: 400 });
  }

  const call = store.get(body.id);
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });
  if (call.resolvedCorrect != null) {
    return NextResponse.json({ call, leaderboard: leaderboard() });
  }

  const currentPct = Number(body.currentPct);
  const correct =
    call.direction === "up" ? currentPct > call.baselinePct : currentPct < call.baselinePct;

  const updated: PulseCall = {
    ...call,
    resolvedCorrect: correct,
    resolvedPct: currentPct,
    resolvedAt: Date.now(),
  };
  store.set(body.id, updated);

  return NextResponse.json({ call: updated, leaderboard: leaderboard() });
}
