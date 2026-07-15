import { TXLINE_API_BASE, TXLINE_CONFIG } from "./config";

export const JWT_COOKIE = "txline_jwt";
export const API_TOKEN_COOKIE = "txline_api_token";

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  // Guest JWTs and free-tier tokens are short-lived; keep the cookie around
  // for a day so a demo session survives page reloads.
  maxAge: 60 * 60 * 24,
};

export async function fetchGuestJwt(): Promise<string> {
  const res = await fetch(TXLINE_CONFIG.guestJwtUrl, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Guest JWT request failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.token as string;
}

export async function activateApiToken(params: {
  txSig: string;
  jwt: string;
  walletSignature: string;
  leagues: number[];
}): Promise<string> {
  const res = await fetch(`${TXLINE_API_BASE}/token/activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.jwt}`,
    },
    body: JSON.stringify({
      txSig: params.txSig,
      walletSignature: params.walletSignature,
      leagues: params.leagues,
    }),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Activation failed: ${res.status} ${text}`);
  }

  // The activation endpoint returns the API token as plain text on success
  // (not JSON), despite the docs' snippet implying a `{ token }` shape.
  try {
    const data = JSON.parse(text);
    return (data.token ?? data) as string;
  } catch {
    return text.trim();
  }
}

/**
 * Proxies an authenticated GET to the TxLINE data API, transparently
 * renewing the guest JWT once on a 401/403 as the docs recommend.
 */
export async function txlineDataFetch(
  path: string,
  jwt: string,
  apiToken: string
): Promise<{ status: number; body: unknown; renewedJwt?: string }> {
  const doFetch = async (token: string) =>
    fetch(`${TXLINE_API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Api-Token": apiToken,
      },
    });

  let res = await doFetch(jwt);
  let renewedJwt: string | undefined;

  if (res.status === 401 || res.status === 403) {
    renewedJwt = await fetchGuestJwt();
    res = await doFetch(renewedJwt);
  }

  const body = await res.json().catch(() => null);
  return { status: res.status, body, renewedJwt };
}

/**
 * Opens an upstream TxLINE SSE stream (`/scores/stream` or `/odds/stream`)
 * and returns the raw response so a route handler can pipe its body
 * straight through to the browser.
 */
export async function openTxlineStream(
  streamPath: "/scores/stream" | "/odds/stream",
  jwt: string,
  apiToken: string
): Promise<Response> {
  return fetch(`${TXLINE_API_BASE}${streamPath}`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      "X-Api-Token": apiToken,
      "Accept-Encoding": "deflate",
    },
  });
}
