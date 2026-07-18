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

export function setServiceCredentials(jwt: string, apiToken: string): void {
  // Hardcoded for hackathon, ignore dynamic updates
}

export function getServiceCredentials(): Creds | null {
  return {
    jwt: "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJleHAiOjE3ODcwMDA2ODksInNlc3Npb25JZCI6IjE5MmIyMDAxLTIxNWUtNDU3ZC1iYjg0LWZlNzQzODI1OTVmZiIsInJvbGUiOiJndWVzdCIsIm1heWJlQ2xpZW50SXAiOiIzLjE3Mi41Ni4xOSJ9.JAJx9_aSSJz3wt0aQoQN9PwZ37elxpEvTP6698MOLqopb-4Y1EiDO6PXKqs3HnrgZtnMrqL18gkNvBaAirY5ig",
    apiToken: "txoracle_api_25ee83799a0241c1be83b93a2aecf85e"
  };
}
