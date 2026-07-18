/**
 * Pattern-matches common Solana/wallet-adapter error messages into plain
 * language. Raw errors here are things like "Attempt to debit an account
 * but found no record of a prior credit" (insufficient balance) or
 * "Receiving end does not exist" (Phantom's background worker was asleep) —
 * technically accurate, not remotely useful to someone who isn't reading
 * the RPC logs.
 */
export function friendlyWalletError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (
    lower.includes("insufficient") ||
    lower.includes("debit an account") ||
    lower.includes("no record of a prior credit") ||
    lower.includes("custom program error: 0x1")
  ) {
    return "Your wallet doesn't have enough devnet SOL to cover the network fee. Get free devnet SOL from a faucet (e.g. faucet.solana.com) and try again.";
  }
  if (lower.includes("user rejected") || lower.includes("rejected the request")) {
    return "You declined the request in your wallet — nothing was changed.";
  }
  if (
    lower.includes("receiving end does not exist") ||
    lower.includes("could not establish connection")
  ) {
    return "Your wallet extension lost connection. Try refreshing the page, or reopening your wallet, then try again.";
  }
  if (lower.includes("wallet not connected") || lower.includes("connect a wallet")) {
    return "Connect your wallet to continue.";
  }
  if (lower.includes("blockhash not found") || lower.includes("block height exceeded")) {
    return "The transaction took too long and expired. Please try again.";
  }
  if (lower.includes("account not found") || lower.includes("accountnotfound")) {
    return "An account needed for this action doesn't exist on-chain yet. Please try again in a moment.";
  }

  return msg;
}
