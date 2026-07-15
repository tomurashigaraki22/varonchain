"use client";

import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { TXLINE_CONFIG } from "@/lib/txline/config";

import "@solana/wallet-adapter-react-ui/styles.css";

export function SolanaProviders({ children }: { children: React.ReactNode }) {
  // Pass an empty wallets array — Phantom (and other modern wallets) register
  // themselves automatically via the Wallet Standard. Explicitly adding
  // PhantomWalletAdapter causes it to register twice and logs a warning.
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={TXLINE_CONFIG.rpcUrl}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
