// In-memory subscription store — mirrors the pattern already used by
// src/app/api/txline/pulse/route.ts. Lives for the process lifetime; on a
// long-lived Node server (this app already relies on that for SSE streaming)
// that's fine for a hackathon demo, but subscriptions are lost on restart.
//
// Guarded on `globalThis` so Next.js's dev-mode module reloading (HMR)
// doesn't spawn a second, disconnected store.

export type FixtureMeta = { home: string; away: string; label: string };

type TelegramStoreState = {
  chatToFixtures: Map<number, Set<number>>;
  fixtureToChats: Map<number, Set<number>>;
  fixtureMeta: Map<number, FixtureMeta>;
  seenEventKeys: Map<number, Set<string>>;
};

const g = globalThis as unknown as { __vcTelegramStore?: TelegramStoreState };

function state(): TelegramStoreState {
  if (!g.__vcTelegramStore) {
    g.__vcTelegramStore = {
      chatToFixtures: new Map(),
      fixtureToChats: new Map(),
      fixtureMeta: new Map(),
      seenEventKeys: new Map(),
    };
  }
  return g.__vcTelegramStore;
}

export function subscribe(chatId: number, fixtureId: number, meta?: FixtureMeta): void {
  const s = state();
  if (!s.chatToFixtures.has(chatId)) s.chatToFixtures.set(chatId, new Set());
  s.chatToFixtures.get(chatId)!.add(fixtureId);

  if (!s.fixtureToChats.has(fixtureId)) s.fixtureToChats.set(fixtureId, new Set());
  s.fixtureToChats.get(fixtureId)!.add(chatId);

  if (meta) s.fixtureMeta.set(fixtureId, meta);
}

export function unsubscribe(chatId: number, fixtureId: number): void {
  const s = state();
  s.chatToFixtures.get(chatId)?.delete(fixtureId);
  s.fixtureToChats.get(fixtureId)?.delete(chatId);
}

export function unsubscribeAll(chatId: number): void {
  const s = state();
  const fixtures = s.chatToFixtures.get(chatId);
  if (fixtures) {
    for (const fixtureId of fixtures) s.fixtureToChats.get(fixtureId)?.delete(chatId);
  }
  s.chatToFixtures.delete(chatId);
}

export function fixturesForChat(chatId: number): number[] {
  return Array.from(state().chatToFixtures.get(chatId) ?? []);
}

export function chatsForFixture(fixtureId: number): number[] {
  return Array.from(state().fixtureToChats.get(fixtureId) ?? []);
}

export function watchedFixtureIds(): number[] {
  const s = state();
  return Array.from(s.fixtureToChats.entries())
    .filter(([, chats]) => chats.size > 0)
    .map(([fixtureId]) => fixtureId);
}

export function fixtureMeta(fixtureId: number): FixtureMeta | undefined {
  return state().fixtureMeta.get(fixtureId);
}

export function setFixtureMeta(fixtureId: number, meta: FixtureMeta): void {
  state().fixtureMeta.set(fixtureId, meta);
}

// Composite-key dedup (fixtureId-seq), same strategy EventFeed uses
// client-side — safer than a numeric high-watermark since Seq isn't
// guaranteed strictly increasing across every action type.
export function hasSeenEvent(fixtureId: number, key: string): boolean {
  return state().seenEventKeys.get(fixtureId)?.has(key) ?? false;
}

export function markEventSeen(fixtureId: number, key: string): void {
  const s = state();
  if (!s.seenEventKeys.has(fixtureId)) s.seenEventKeys.set(fixtureId, new Set());
  const set = s.seenEventKeys.get(fixtureId)!;
  set.add(key);
  // Bound memory for very long-running matches/processes.
  if (set.size > 1000) {
    const first = set.values().next().value;
    if (first !== undefined) set.delete(first);
  }
}
