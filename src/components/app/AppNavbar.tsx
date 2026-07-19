"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

import { useWallet } from "@solana/wallet-adapter-react";

// WalletMultiButton detects installed wallet extensions client-side, so its
// rendered output (icon + label) differs from the server's first pass. Load
// it client-only to avoid a hydration mismatch instead of SSR-ing a stale shell.
const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

export function AppNavbar() {
  const { publicKey, connected, disconnect } = useWallet();

  return (
    <header className="sticky py-5 top-0 z-50 border-b border-border bg-[rgba(8,8,8,0.85)] backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-3.5">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-1.5 font-display text-sm font-bold tracking-tight text-text"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-accent">
            <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M12 6.2 15.4 8.7 14.1 12.7H9.9L8.6 8.7 12 6.2Z"
              stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"
            />
            <path d="M12 6.2V3.4M14.1 12.7l2.4 1.9M9.9 12.7l-2.4 1.9M8.6 8.7 5.9 7.9M15.4 8.7l2.7-.8"
              stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
            />
          </svg>
          VAROnChain
        </Link>

        {/* Right: network badge + wallet */}
        <div className="flex items-center justify-end gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-6 py-3 font-mono text-[10px] font-semibold uppercase tracking-widest text-warning">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            Devnet
          </span>

          <WalletMultiButton style={{
            height: "28px",
            fontSize: "11px",
            fontFamily: "monospace",
            fontWeight: "bold",
            borderRadius: "9999px",
            padding: "20px 15px",
            backgroundColor: "var(--accent)",
            color: "var(--bg)"
          }} />
        </div>
      </div>
    </header>
  );
}