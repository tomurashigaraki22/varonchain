import { NextRequest, NextResponse } from "next/server";
import {
  API_TOKEN_COOKIE,
  cookieOptions,
  JWT_COOKIE,
  txlineDataFetch,
} from "@/lib/txline/server";
import { validateStatsOnChain, type StatValidationApiResponse } from "@/lib/txline/verify";

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

    if (status < 200 || status >= 300) {
      const res = NextResponse.json(
        { error: "Failed to fetch validation proof from TxLINE", detail: body },
        { status }
      );
      if (renewedJwt) res.cookies.set(JWT_COOKIE, renewedJwt, cookieOptions);
      return res;
    }

    // Race on-chain verification against a 12s timeout so we don't hang forever
    const verifyPromise = validateStatsOnChain(body as StatValidationApiResponse);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("On-chain RPC timed out (>12s) — devnet may be congested")), 12_000)
    );

    const result = await Promise.race([verifyPromise, timeoutPromise]);

    const res = NextResponse.json(result);
    if (renewedJwt) res.cookies.set(JWT_COOKIE, renewedJwt, cookieOptions);
    return res;
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : "On-chain verification failed — devnet RPC may be unavailable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
