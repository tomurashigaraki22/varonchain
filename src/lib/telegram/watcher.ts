import { fetchGuestJwt, openTxlineStream, txlineDataFetch } from "../txline/server";
import { getServiceCredentials } from "./credentials";
import { sendTelegramMessage } from "./api";
import { formatEvent, getRoster } from "./events";
import { chatsForFixture, fixtureMeta, hasSeenEvent, markEventSeen, watchedFixtureIds } from "./store";

type RawEvent = Record<string, unknown>;

const POLL_MS = 5000;

type WatcherState = {
  startedAt: number | null;
  hasCredentials: boolean;
  streamConnectedAt: number | null;
  streamLastError: string | null;
  pollLastRunAt: number | null;
  pollLastError: string | null;
  eventsHandled: number;
  lastEventAt: number | null;
};

const g2 = globalThis as unknown as { __vcTelegramWatcherState?: WatcherState };
function watcherState(): WatcherState {
  if (!g2.__vcTelegramWatcherState) {
    g2.__vcTelegramWatcherState = {
      startedAt: null,
      hasCredentials: false,
      streamConnectedAt: null,
      streamLastError: null,
      pollLastRunAt: null,
      pollLastError: null,
      eventsHandled: 0,
      lastEventAt: null,
    };
  }
  return g2.__vcTelegramWatcherState;
}

/** For /api/telegram/debug — lets you see what the watcher is actually doing instead of guessing from logs. */
export function getWatcherDebugState() {
  return {
    ...watcherState(),
    watchedFixtureIds: watchedFixtureIds(),
  };
}

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

  const s = watcherState();
  s.eventsHandled += 1;
  s.lastEventAt = Date.now();
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
    const msg = `upstream scores stream failed: ${upstream.status}`;
    console.error("telegram watcher:", msg);
    watcherState().streamLastError = msg;
    return;
  }

  watcherState().streamConnectedAt = Date.now();
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

/**
 * Polling fallback — proven necessary elsewhere in this app (EventFeed, the
 * Arena engine): TxLINE's devnet SSE stream can connect successfully and
 * then sit silently empty without ever erroring, so relying on the raw
 * stream alone is exactly the kind of thing that "no alerts ever arrive"
 * bugs come from. Every 5s, re-pull each watched fixture's current snapshot
 * and feed it through the same handleRawEvent path — hasSeenEvent/
 * markEventSeen already dedupe against whatever the stream also delivered,
 * so running both concurrently is safe.
 */
async function pollOnce(): Promise<void> {
  const creds = getServiceCredentials();
  if (!creds) return;

  const fixtureIds = watchedFixtureIds();
  if (fixtureIds.length === 0) return;

  await Promise.all(
    fixtureIds.map(async (fixtureId) => {
      try {
        const { body } = await txlineDataFetch(`/scores/snapshot/${fixtureId}`, creds.jwt, creds.apiToken);
        if (Array.isArray(body)) {
          for (const row of body as RawEvent[]) {
            await handleRawEvent(row);
          }
        }
      } catch (err) {
        watcherState().pollLastError = err instanceof Error ? err.message : String(err);
        console.error("telegram watcher: poll failed for fixture", fixtureId, err);
      }
    })
  );

  watcherState().pollLastRunAt = Date.now();
}

const g = globalThis as unknown as { __vcTelegramWatcherStarted?: boolean };

/**
 * Starts (once per process) a persistent read loop over TxLINE's
 * `/scores/stream` SSE feed PLUS a polling fallback, fanning out
 * notify-worthy events to whichever Telegram chats are subscribed to that
 * fixture. Safe to call repeatedly — only the first call has any effect.
 * Reconnects with backoff on drop, and simply idles until an app activation
 * supplies service credentials via setServiceCredentials().
 */
export function ensureWatcherStarted(): void {
  if (g.__vcTelegramWatcherStarted) return;
  g.__vcTelegramWatcherStarted = true;

  const s = watcherState();
  s.startedAt = Date.now();
  s.hasCredentials = getServiceCredentials() != null;

  (async () => {
    for (;;) {
      try {
        await runStreamOnce();
      } catch (err) {
        watcherState().streamLastError = err instanceof Error ? err.message : String(err);
        console.error("telegram watcher: stream loop error", err);
      }
      await new Promise((r) => setTimeout(r, 10_000));
    }
  })();

  (async () => {
    for (;;) {
      try {
        await pollOnce();
      } catch (err) {
        console.error("telegram watcher: poll loop error", err);
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  })();
}
