import { NextRequest, NextResponse } from "next/server";
import {
  API_TOKEN_COOKIE,
  cookieOptions,
  JWT_COOKIE,
  txlineDataFetch,
} from "@/lib/txline/server";

/**
 * Fetches the Merkle proof for a stat validation from TxLINE. The actual
 * on-chain `validateStatV2` simulation runs client-side (see
 * src/lib/txline/verify.ts) using the user's own connected wallet as fee
 * payer — Solana's simulator requires a fee payer that actually exists
 * on-chain, which a server-generated throwaway keypair never does.
 */
export async function POST(req: NextRequest) {
  const jwt = req.cookies.get(JWT_COOKIE)?.value;
  const apiToken = req.cookies.get(API_TOKEN_COOKIE)?.value;

  if (!jwt || !apiToken) {
    return NextResponse.json(
      { error: "Not activated. Connect a wallet and activate the free tier first." },
      { status: 401 }
    );
  }

  const { fixtureId, seq, statKeys } = await req.json();
  if (fixtureId == null || seq == null || !Array.isArray(statKeys) || statKeys.length === 0) {
    return NextResponse.json(
      { error: "fixtureId, seq, and a non-empty statKeys array are required" },
      { status: 400 }
    );
  }

  try {
    const path = `/scores/stat-validation?fixtureId=${fixtureId}&seq=${seq}&statKeys=${statKeys.join(",")}`;
    const { status, body, renewedJwt } = await txlineDataFetch(path, jwt, apiToken);

    const res = NextResponse.json(
      status >= 200 && status < 300
        ? { proof: body }
        : { error: "Failed to fetch validation proof from TxLINE", detail: body },
      { status }
    );
    if (renewedJwt) res.cookies.set(JWT_COOKIE, renewedJwt, cookieOptions);
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch validation proof" },
      { status: 502 }
    );
  }
}
