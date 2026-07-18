import { NextRequest, NextResponse } from "next/server";
import { setTelegramWebhook } from "@/lib/telegram/api";

// One-time (idempotent) setup: hit this once after deploying to point
// Telegram's webhook at this deployment. Requires a public HTTPS origin —
// won't work against localhost, since Telegram calls this URL directly.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const webhookUrl = `${origin}/api/telegram/webhook`;
  const result = await setTelegramWebhook(webhookUrl);
  return NextResponse.json({ webhookUrl, result });
}
