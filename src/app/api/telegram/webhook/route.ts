import { NextRequest, NextResponse } from "next/server";
import { answerCallbackQuery, sendTelegramMessage, type InlineButton } from "@/lib/telegram/api";
import { getServiceCredentials } from "@/lib/telegram/credentials";
import { listFixtures, resolveFixtureMeta } from "@/lib/telegram/fixtures";
import {
  fixtureMeta,
  fixturesForChat,
  subscribe,
  unsubscribe,
  unsubscribeAll,
} from "@/lib/telegram/store";
import { ensureWatcherStarted } from "@/lib/telegram/watcher";

// Telegram callback_data is capped at 64 bytes — keep it to action + id.
function subButton(fixtureId: number): InlineButton {
  return { text: "🔔 Notify me", callback_data: `sub:${fixtureId}` };
}
function unsubButton(fixtureId: number): InlineButton {
  return { text: "🔕 Stop notifying", callback_data: `unsub:${fixtureId}` };
}

const WELCOME = [
  "⚽ <b>VAROnChain alerts</b>",
  "",
  "I'll ping you here the moment something happens in a match: goals, cards, penalties, VAR calls, half-time, full-time.",
  "",
  "Use /matches to pick a fixture, or tap \"🔔 Get Telegram alerts\" on any match inside the app.",
].join("\n");

async function handleStart(chatId: number, payload: string | undefined) {
  await sendTelegramMessage(chatId, WELCOME);

  if (!payload?.startsWith("sub_")) return;
  const fixtureId = Number(payload.slice(4));
  if (!Number.isFinite(fixtureId)) return;

  const creds = getServiceCredentials();
  if (!creds) {
    await sendTelegramMessage(chatId, "The app hasn't finished activating yet — try again in a minute.");
    return;
  }

  const meta = fixtureMeta(fixtureId) ?? (await resolveFixtureMeta(fixtureId, creds.jwt, creds.apiToken));
  if (!meta) {
    await sendTelegramMessage(chatId, "Couldn't find that match — try /matches instead.");
    return;
  }

  subscribe(chatId, fixtureId, meta);
  ensureWatcherStarted();
  await sendTelegramMessage(chatId, `✅ Subscribed to <b>${meta.home} vs ${meta.away}</b>. I'll message you here on key events.`);
}

async function handleMatches(chatId: number) {
  const creds = getServiceCredentials();
  if (!creds) {
    await sendTelegramMessage(chatId, "The app hasn't finished activating yet — open VAROnChain and connect a wallet first.");
    return;
  }
  const fixtures = await listFixtures(creds.jwt, creds.apiToken);
  if (fixtures.length === 0) {
    await sendTelegramMessage(chatId, "No matches found right now.");
    return;
  }
  const subscribed = new Set(fixturesForChat(chatId));
  const buttons = fixtures.slice(0, 20).map((f) => [
    subscribed.has(f.fixtureId) ? unsubButton(f.fixtureId) : subButton(f.fixtureId),
  ].map((btn) => ({ ...btn, text: `${btn.text} · ${f.home} vs ${f.away}` })));

  await sendTelegramMessage(chatId, "Pick a match to get live alerts for:", { buttons });
}

async function handleMySubs(chatId: number) {
  const ids = fixturesForChat(chatId);
  if (ids.length === 0) {
    await sendTelegramMessage(chatId, "You're not subscribed to any matches yet. Try /matches.");
    return;
  }
  const buttons = ids.map((id) => {
    const meta = fixtureMeta(id);
    return [{ ...unsubButton(id), text: `🔕 ${meta ? `${meta.home} vs ${meta.away}` : `Match ${id}` }` }];
  });
  await sendTelegramMessage(chatId, "Your subscriptions:", { buttons });
}

async function handleCallback(chatId: number, data: string, callbackId: string) {
  const [action, idStr] = data.split(":");
  const fixtureId = Number(idStr);
  if (!Number.isFinite(fixtureId)) {
    await answerCallbackQuery(callbackId);
    return;
  }

  if (action === "sub") {
    const creds = getServiceCredentials();
    const meta = fixtureMeta(fixtureId) ?? (creds ? await resolveFixtureMeta(fixtureId, creds.jwt, creds.apiToken) : undefined);
    if (!meta) {
      await answerCallbackQuery(callbackId, "Couldn't find that match.");
      return;
    }
    subscribe(chatId, fixtureId, meta);
    ensureWatcherStarted();
    await answerCallbackQuery(callbackId, `Subscribed to ${meta.home} vs ${meta.away}`);
    await sendTelegramMessage(chatId, `✅ Subscribed to <b>${meta.home} vs ${meta.away}</b>.`);
  } else if (action === "unsub") {
    unsubscribe(chatId, fixtureId);
    await answerCallbackQuery(callbackId, "Unsubscribed");
    await sendTelegramMessage(chatId, "🔕 Unsubscribed.");
  } else {
    await answerCallbackQuery(callbackId);
  }
}

export async function POST(req: NextRequest) {
  ensureWatcherStarted();

  const update = await req.json().catch(() => null);
  if (!update) return NextResponse.json({ ok: true });

  try {
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat?.id;
      if (typeof chatId === "number" && typeof cq.data === "string") {
        await handleCallback(chatId, cq.data, cq.id);
      } else if (cq.id) {
        await answerCallbackQuery(cq.id);
      }
      return NextResponse.json({ ok: true });
    }

    const message = update.message;
    const chatId = message?.chat?.id;
    const text = typeof message?.text === "string" ? message.text.trim() : "";
    if (typeof chatId !== "number" || !text) return NextResponse.json({ ok: true });

    if (text.startsWith("/start")) {
      const payload = text.split(" ")[1];
      await handleStart(chatId, payload);
    } else if (text.startsWith("/matches")) {
      await handleMatches(chatId);
    } else if (text.startsWith("/mysubs") || text.startsWith("/subscriptions")) {
      await handleMySubs(chatId);
    } else if (text.startsWith("/stop")) {
      unsubscribeAll(chatId);
      await sendTelegramMessage(chatId, "🔕 Unsubscribed from everything.");
    } else {
      await sendTelegramMessage(chatId, "Try /matches to pick a match, or /mysubs to see what you're subscribed to.");
    }
  } catch (err) {
    console.error("telegram webhook error", err);
  }

  return NextResponse.json({ ok: true });
}
