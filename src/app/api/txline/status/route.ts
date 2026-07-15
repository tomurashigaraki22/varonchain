import { NextRequest, NextResponse } from "next/server";
import { API_TOKEN_COOKIE, JWT_COOKIE } from "@/lib/txline/server";

export async function GET(req: NextRequest) {
  const activated = Boolean(
    req.cookies.get(JWT_COOKIE)?.value && req.cookies.get(API_TOKEN_COOKIE)?.value
  );
  return NextResponse.json({ activated });
}
