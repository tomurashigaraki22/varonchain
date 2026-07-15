import { NextRequest, NextResponse } from "next/server";
import {
  API_TOKEN_COOKIE,
  cookieOptions,
  JWT_COOKIE,
  txlineDataFetch,
} from "@/lib/txline/server";

// Generic authenticated proxy for TxLINE snapshot/validation GET endpoints,
// e.g. /api/txline/proxy/fixtures/snapshot?competitionId=72&startEpochDay=...
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const jwt = req.cookies.get(JWT_COOKIE)?.value;
  const apiToken = req.cookies.get(API_TOKEN_COOKIE)?.value;

  if (!jwt || !apiToken) {
    return NextResponse.json(
      { error: "Not activated. Connect a wallet and activate the free tier first." },
      { status: 401 }
    );
  }

  const { path } = await params;
  const search = req.nextUrl.search;
  const upstreamPath = `/${path.join("/")}${search}`;

  try {
    const { status, body, renewedJwt } = await txlineDataFetch(
      upstreamPath,
      jwt,
      apiToken
    );

    const res = NextResponse.json(body, { status });
    if (renewedJwt) {
      res.cookies.set(JWT_COOKIE, renewedJwt, cookieOptions);
    }
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upstream request failed" },
      { status: 502 }
    );
  }
}
