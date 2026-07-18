// Hardcoded per explicit instruction (same precedent as the QuickNode RPC
// URL in ../txline/config.ts) — this is a bot token, not a user credential,
// and the bot only ever pushes World Cup event notifications; it has no
// access to funds or personal data.
export const TELEGRAM_BOT_TOKEN = "8905193217:AAHFSZEnVzK9vAoThIAfJdxDb1CHXJ-Roh0";
export const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export const WORLD_CUP_COMPETITION_ID = 72;
