import { fetchGuestJwt, openTxlineStream } from "../txline/server";
import { getServiceCredentials } from "./credentials";
import { sendTelegramMessage } from "./api";
import { formatEvent, getRoster } from "./events";
import { chatsForFixture, fixtureMeta, hasSeenEvent, markEventSeen } from "./store";

type RawEvent = Record<string, unknown>;

function num(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

function fixtureIdOf(raw: RawEvent): number | undefined {
  return num(raw.FixtureId ?? raw.fixtureId);
}

function eventKeyOf(raw: RawEvent, fixtureId: number): string {
  const seq = raw.Seq ?? raw.seq ?? raw.Id ?? raw.id;
  return `${fixtureId}-${String(seq ?? raw.Action ?? raw.action ?? Math.random())}`;
}

async function handleRawEvent(raw: RawEvent) {
  const fixtureId = fixtureIdOf(raw);
  if (fixtureId == null) return;

  const chats = chatsForFixture(fixtureId);
  if (chats.length === 0) return; // nobody's watching this match — skip entirely

  const key = eventKeyOf(raw, fixtureId);
  if (hasSeenEvent(fixtureId, key)) return;
  markEventSeen(fixtureId, key);

  const meta = fixtureMeta(fixtureId);
  if (!meta) return;

  const creds = getServiceCredentials();
  const roster = creds ? await getRoster(fixtureId, creds.jwt, creds.apiToken) : new Map<number, string>();

  const formatted = formatEvent(raw, meta, roster);
  if (!formatted) return;

  const text = `${formatted.emoji} <b>${meta.home} vs ${meta.away}</b>\n${formatted.text}`;
  await Promise.all(chats.map((chatId) => sendTelegramMessage(chatId, text)));
}

function parseSseBlock(block: string): RawEvent | null {
  const lines = block.split("\n").filter((l) => l.startsWith("data:"));
  if (lines.length === 0) return null;
  const payload = lines.map((l) => l.slice(5).trim()).join("\n");
  if (!payload || payload === "[DONE]") return null;
  try {
    return JSON.parse(payload) as RawEvent;
  } catch {
    return null;
  }
}

async function runStreamOnce(): Promise<void> {
  const creds = getServiceCredentials();
  if (!creds) return;

  let upstream = await openTxlineStream("/scores/stream", creds.jwt, creds.apiToken);
  if (upstream.status === 401 || upstream.status === 403) {
    const renewedJwt = await fetchGuestJwt();
    upstream = await openTxlineStream("/scores/stream", renewedJwt, creds.apiToken);
  }
  if (!upstream.ok || !upstream.body) {
    console.error("telegram watcher: upstream scores stream failed", upstream.status);
    return;
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIndex: number;
    while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);
      const raw = parseSseBlock(block);
      if (raw) handleRawEvent(raw).catch((err) => console.error("telegram watcher: event handling failed", err));
    }
  }
}

const g = globalThis as unknown as { __vcTelegramWatcherStarted?: boolean };

/**
 * Starts (once per process) a persistent read loop over TxLINE's
 * `/scores/stream` SSE feed and fans out notify-worthy events to whichever
 * Telegram chats are subscribed to that fixture. Safe to call repeatedly —
 * only the first call has any effect. Reconnects with backoff on drop, and
 * simply idles (retrying every 10s) until an app activation supplies
 * service credentials via setServiceCredentials().
 */
export function ensureWatcherStarted(): void {
  if (g.__vcTelegramWatcherStarted) return;
  g.__vcTelegramWatcherStarted = true;

  (async () => {
    for (;;) {
      try {
        await runStreamOnce();
      } catch (err) {
        console.error("telegram watcher: stream loop error", err);
      }
      await new Promise((r) => setTimeout(r, 10_000));
    }
  })();
}
