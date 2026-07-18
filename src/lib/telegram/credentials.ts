// TxLINE's jwt/apiToken pair is issued per-activation (see
// src/lib/txline/server.ts) and normally lives in the activating browser's
// cookies. The Telegram watcher runs outside any browser request, so it
// can't read cookies — instead we stash the credentials from the most
// recent successful in-app activation here and reuse them to poll TxLINE on
// the bot's behalf. TxLINE data isn't user-scoped (the token is a
// rate-limited access key, not a personal account), so sharing one
// activated session's credentials across the fan-out watcher is safe.
//
// Guarded on `globalThis` for the same HMR-safety reason as store.ts.

type Creds = { jwt: string; apiToken: string };

const g = globalThis as unknown as { __vcTxlineServiceCreds?: Creds };

export function setServiceCredentials(jwt: string, apiToken: string): void {
  g.__vcTxlineServiceCreds = { jwt, apiToken };
}

export function getServiceCredentials(): Creds | null {
  return g.__vcTxlineServiceCreds ?? null;
}
