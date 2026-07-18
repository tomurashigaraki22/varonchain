import { TELEGRAM_API_BASE } from "./config";

export type InlineButton = { text: string; callback_data?: string; url?: string };

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export { escapeHtml };

export async function sendTelegramMessage(
  chatId: number,
  text: string,
  opts?: { buttons?: InlineButton[][] }
): Promise<void> {
  const res = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(opts?.buttons ? { reply_markup: { inline_keyboard: opts.buttons } } : {}),
    }),
  });
  if (!res.ok) {
    // Telegram delivery failures (bot blocked, chat deleted, etc.) shouldn't
    // crash the watcher loop that's broadcasting to many chats at once.
    console.error("sendTelegramMessage failed", chatId, res.status, await res.text().catch(() => ""));
  }
}

export async function answerCallbackQuery(id: string, text?: string): Promise<void> {
  await fetch(`${TELEGRAM_API_BASE}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: id, text, show_alert: false }),
  }).catch(() => {});
}

export async function setTelegramWebhook(url: string): Promise<{ ok: boolean; description?: string }> {
  const res = await fetch(`${TELEGRAM_API_BASE}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return res.json();
}
