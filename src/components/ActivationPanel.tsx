"use client";

import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { activateFreeTier } from "@/lib/txline/subscribeClient";

type Status = "idle" | "checking" | "activating" | "activated" | "error";

function truncate(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

const STEPS = [
  { id: "connect", label: "Connect wallet" },
  { id: "subscribe", label: "Subscribe on-chain" },
  { id: "activate", label: "Activate API access" },
] as const;

export function ActivationPanel({
  onActivated,
  onTxSig,
}: {
  onActivated?: () => void;
  onTxSig?: (sig: string) => void;
}) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/txline/status")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setStatus(data.activated ? "activated" : "idle");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (status === "activated") onActivated?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleActivate = async () => {
    setError(null);
    if (!wallet.connected) { setVisible(true); return; }
    setStatus("activating");
    try {
      const result = await activateFreeTier(connection, wallet);
      setTxSig(result.txSig);
      onTxSig?.(result.txSig);
      setStatus("activated");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Activation failed");
    }
  };

  const copyAddress = () => {
    if (!wallet.publicKey) return;
    navigator.clipboard?.writeText(wallet.publicKey.toBase58());
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const isActive = status === "activated";
  const isActivating = status === "activating";

  // Determine which step is active for the progress indicator
  const activeStep = isActive ? null : !wallet.connected ? 0 : 1;

  return (
    <div className="glass w-full overflow-hidden rounded-xl">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border bg-surface-2/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-accent">
            <path
              d="M12 2L4 5v6c0 5.2 3.4 9.4 8 11 4.6-1.6 8-5.8 8-11V5l-8-3z"
              stroke="currentColor" strokeWidth="2" strokeLinejoin="round"
            />
          </svg>
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-dim">
            TxLINE · Free World Cup Tier
          </h2>
        </div>
        <span
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest transition-colors ${
            isActive
              ? "border-accent/30 bg-accent-dim text-accent"
              : status === "error"
              ? "border-danger/30 bg-danger/10 text-danger"
              : "border-border text-text-dimmer"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isActive ? "animate-pulse-dot bg-accent" : status === "error" ? "bg-danger" : "bg-text-dimmer"
            }`}
          />
          {isActive ? "Active" : status === "error" ? "Error" : status === "checking" ? "Checking…" : "Inactive"}
        </span>
      </div>

      <div className="px-5 py-5">
        {isActive ? (
          /* ── Activated state ── */
          <div className="animate-fade-up">
            <p className="text-sm leading-6 text-text-dim">
              Connected — pulling cryptographically verified live World Cup data.
            </p>
            {wallet.publicKey && (
              <div className="mt-4 overflow-hidden rounded-lg border border-border">
                <InfoRow label="Wallet">
                  <button
                    onClick={copyAddress}
                    className="font-mono text-xs text-text transition-colors hover:text-accent"
                  >
                    {copied ? "Copied ✓" : truncate(wallet.publicKey.toBase58())}
                  </button>
                </InfoRow>
                <InfoRow label="Network">
                  <span className="flex items-center gap-1.5 text-xs text-text">
                    <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" />
                    Connected · Devnet
                  </span>
                </InfoRow>
                <InfoRow label="Tier" last>
                  <span className="text-xs text-text">Free · World Cup</span>
                </InfoRow>
              </div>
            )}
            {txSig && (
              <a
                href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1 font-mono text-xs text-accent underline-offset-4 hover:underline"
              >
                ↗ View subscribe tx on Explorer
              </a>
            )}
          </div>
        ) : (
          /* ── Inactive / activating state ── */
          <>
            {/* Step progress */}
            {status !== "checking" && (
              <div className="mb-5 flex items-center gap-0">
                {STEPS.map((step, i) => {
                  const done = activeStep != null && i < activeStep;
                  const active = activeStep === i && isActivating && i === 1;
                  return (
                    <div key={step.id} className="flex flex-1 items-center">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] font-bold transition-colors ${
                            done
                              ? "bg-accent text-bg"
                              : active
                              ? "border border-accent/50 bg-accent-dim text-accent"
                              : i === activeStep
                              ? "border border-accent text-accent"
                              : "border border-border text-text-dimmer"
                          }`}
                        >
                          {done ? "✓" : i + 1}
                        </span>
                        <span className="whitespace-nowrap font-mono text-[9px] text-text-dimmer">
                          {step.label}
                        </span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div
                          className={`mx-1 mb-4 h-px flex-1 transition-colors ${
                            done ? "bg-accent/40" : "bg-border"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-sm leading-6 text-text-dim">
              {status === "checking"
                ? "Checking activation status…"
                : "Connect a devnet wallet and subscribe on-chain. No payment — just the Solana fee for one transaction."}
            </p>

            <div className="mt-5">
              {status === "checking" ? (
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  <span className="text-sm text-text-dim">Checking…</span>
                </div>
              ) : !wallet.connected ? (
                <button
                  onClick={() => setVisible(true)}
                  className="rounded-full bg-accent px-7 py-2.5 text-sm font-extrabold text-bg transition-shadow glow-accent-hover"
                >
                  Connect Wallet
                </button>
              ) : (
                <button
                  onClick={handleActivate}
                  disabled={isActivating}
                  className="rounded-full bg-accent px-7 py-2.5 text-sm font-extrabold text-bg transition-shadow glow-accent-hover disabled:opacity-50"
                >
                  {isActivating ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-bg border-t-transparent" />
                      Subscribing on-chain…
                    </span>
                  ) : (
                    "Subscribe & Activate (Free)"
                  )}
                </button>
              )}
            </div>
          </>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2">
            <p className="text-xs text-danger">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2.5 ${
        last ? "" : "border-b border-white/[0.04]"
      }`}
    >
      <span className="font-mono text-[10px] uppercase tracking-widest text-text-dim">{label}</span>
      {children}
    </div>
  );
}
