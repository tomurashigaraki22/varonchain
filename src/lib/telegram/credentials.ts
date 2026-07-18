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

import fs from 'fs';
import path from 'path';

type Creds = { jwt: string; apiToken: string };

const CREDS_FILE = path.join(process.cwd(), '.telegram_creds.json');

export function setServiceCredentials(jwt: string, apiToken: string): void {
  try {
    fs.writeFileSync(CREDS_FILE, JSON.stringify({ jwt, apiToken }));
  } catch (err) {
    console.error("Failed to save telegram credentials:", err);
  }
}

export function getServiceCredentials(): Creds | null {
  try {
    if (fs.existsSync(CREDS_FILE)) {
      return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error("Failed to read telegram credentials:", err);
  }
  return null;
}
