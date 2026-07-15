import { NextRequest } from "next/server";
import {
  API_TOKEN_COOKIE,
  fetchGuestJwt,
  JWT_COOKIE,
  openTxlineStream,
} from "@/lib/txline/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const jwt = req.cookies.get(JWT_COOKIE)?.value;
  const apiToken = req.cookies.get(API_TOKEN_COOKIE)?.value;

  if (!jwt || !apiToken) {
    return new Response(
      JSON.stringify({ error: "Not activated. Connect a wallet and activate the free tier first." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  let upstream = await openTxlineStream("/scores/stream", jwt, apiToken);

  if (upstream.status === 401 || upstream.status === 403) {
    const renewedJwt = await fetchGuestJwt();
    upstream = await openTxlineStream("/scores/stream", renewedJwt, apiToken);
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(
      JSON.stringify({ error: `Upstream scores stream failed: ${upstream.status}` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
