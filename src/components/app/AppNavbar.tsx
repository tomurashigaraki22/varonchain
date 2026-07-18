"use client";

import Link from "next/link";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function AppNavbar() {
  const { publicKey, connected, disconnect } = useWallet();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-[rgba(8,8,8,0.85)] backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
        {/* Left: Live pill (mirrors landing Navbar) */}
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-text-dim sm:flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-accent" />
            </span>
            Live · TxLINE
          </span>
        </div>

        {/* Center: Brand */}
        <Link
          href="/"
          className="flex items-center gap-1.5 font-display text-sm font-bold tracking-tight text-text"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-accent">
            <path
              d="M12 2L4 5v6c0 5.2 3.4 9.4 8 11 4.6-1.6 8-5.8 8-11V5l-8-3z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M8.5 12l2.5 2.5 4.5-4.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          VAROnChain
        </Link>

        {/* Right: network badge + wallet */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-warning">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            Devnet
          </span>

          <WalletMultiButton style={{
            height: "28px",
            fontSize: "11px",
            fontFamily: "monospace",
            fontWeight: "bold",
            borderRadius: "9999px",
            padding: "0 12px",
            backgroundColor: "#818cf8",
            color: "#ffffff"
          }} />
        </div>
      </div>
    </header>
  );
}
