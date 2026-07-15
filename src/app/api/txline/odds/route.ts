import { NextRequest, NextResponse } from "next/server";
import {
  API_TOKEN_COOKIE,
  cookieOptions,
  JWT_COOKIE,
  txlineDataFetch,
} from "@/lib/txline/server";

/**
 * GET /api/txline/odds?fixtureId=123
 * Returns the match-winner odds snapshot for a single fixture so the UI
 * can show home/draw/away win percentages on fixture cards without
 * exposing raw betting markets to the client.
 */
export async function GET(req: NextRequest) {
  const jwt = req.cookies.get(JWT_COOKIE)?.value;
  const apiToken = req.cookies.get(API_TOKEN_COOKIE)?.value;

  if (!jwt || !apiToken) {
    return NextResponse.json(
      { error: "Not activated." },
      { status: 401 }
    );
  }

  const fixtureId = req.nextUrl.searchParams.get("fixtureId");
  if (!fixtureId) {
    return NextResponse.json({ error: "fixtureId is required" }, { status: 400 });
  }

  try {
    const { status, body, renewedJwt } = await txlineDataFetch(
      `/odds/snapshot/${fixtureId}`,
      jwt,
      apiToken
    );

    const res = NextResponse.json(body, { status });
    if (renewedJwt) res.cookies.set(JWT_COOKIE, renewedJwt, cookieOptions);
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Odds fetch failed" },
      { status: 502 }
    );
  }
}
