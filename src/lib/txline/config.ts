import { PublicKey } from "@solana/web3.js";

export const TXLINE_NETWORK = "devnet" as const;

export const TXLINE_CONFIG = {
  rpcUrl: "https://greatest-black-haze.solana-devnet.quiknode.pro/c00e12cb798356f07aedfc698f2b1468a6b09ee6/",
  wsRpcUrl: "wss://greatest-black-haze.solana-devnet.quiknode.pro/c00e12cb798356f07aedfc698f2b1468a6b09ee6/",
  apiOrigin: "https://txline-dev.txodds.com",
  guestJwtUrl: "https://txline-dev.txodds.com/auth/guest/start",
  programId: new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"),
  txlTokenMint: new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG"),
} as const;

export const TXLINE_API_BASE = `${TXLINE_CONFIG.apiOrigin}/api`;

// Free World Cup / Int'l Friendlies tier: service level 1 (delayed on mainnet,
// samplingIntervalSec = 0 on the current devnet pricing matrix).
export const FREE_SERVICE_LEVEL_ID = 1;
export const SUBSCRIBE_DURATION_WEEKS = 4;
export const SELECTED_LEAGUES: number[] = [];
