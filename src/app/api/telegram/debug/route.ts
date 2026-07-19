import { NextResponse } from "next/server";
import { getServiceCredentials } from "@/lib/telegram/credentials";
import { getWatcherDebugState, ensureWatcherStarted } from "@/lib/telegram/watcher";

// Hit this in a browser (on whichever deployment your Telegram webhook
// actually points at) to see what the watcher is really doing instead of
// guessing from logs: is it started, does it have credentials, is the SSE
// stream connected, is the poll fallback running, has it ever handled a
// real event, and which fixtures does it think are being watched.
export async function GET() {
  ensureWatcherStarted();
  const creds = getServiceCredentials();
  return NextResponse.json({
    ...getWatcherDebugState(),
    hasCredentials: creds != null,
  });
}
