import { NextRequest, NextResponse } from "next/server";
import {
  activateApiToken,
  API_TOKEN_COOKIE,
  cookieOptions,
  JWT_COOKIE,
} from "@/lib/txline/server";

export async function POST(req: NextRequest) {
  try {
    const { txSig, jwt, walletSignature, leagues } = await req.json();

    if (!txSig || !jwt || !walletSignature) {
      return NextResponse.json(
        { error: "txSig, jwt, and walletSignature are required" },
        { status: 400 }
      );
    }

    const apiToken = await activateApiToken({
      txSig,
      jwt,
      walletSignature,
      leagues: leagues ?? [],
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(JWT_COOKIE, jwt, cookieOptions);
    res.cookies.set(API_TOKEN_COOKIE, apiToken, cookieOptions);
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Activation failed" },
      { status: 502 }
    );
  }
}
