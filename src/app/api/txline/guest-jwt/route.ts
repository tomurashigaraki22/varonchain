import { NextResponse } from "next/server";
import { fetchGuestJwt } from "@/lib/txline/server";

export async function POST() {
  try {
    const jwt = await fetchGuestJwt();
    return NextResponse.json({ jwt });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get guest JWT" },
      { status: 502 }
    );
  }
}
