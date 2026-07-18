// Client-safe: only the bot's public @username, never the token. Keep this
// file separate from config.ts (which holds TELEGRAM_BOT_TOKEN) so nothing
// client-side can accidentally import the secret into the browser bundle.
export const TELEGRAM_BOT_USERNAME = "varonchainbot";
