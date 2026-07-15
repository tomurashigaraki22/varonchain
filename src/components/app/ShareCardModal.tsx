"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import { Icon } from "@/components/ui/Icon";
import {
  Download01Icon,
  LinkCircleIcon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";

export type ShareableMoment = {
  label: string;
  fixtureLabel: string;
  minuteLabel?: string;
  dailyScoresPda: string;
  epochDay: number;
};

export function ShareCardModal({
  moment,
  onClose,
}: {
  moment: ShareableMoment;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const proofUrl = `https://explorer.solana.com/address/${moment.dailyScoresPda}?cluster=devnet`;
  const shortHash = `${moment.dailyScoresPda.slice(0, 8)}…${moment.dailyScoresPda.slice(-6)}`;

  useEffect(() => {
    QRCode.toDataURL(proofUrl, {
      width: 160,
      margin: 1,
      color: { dark: "#080808", light: "#cdfe00" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [proofUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const download = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `varonchain-${moment.label.toLowerCase().replace(/\s+/g, "-")}.png`;
      a.click();
    } catch {
      // best-effort
    } finally {
      setDownloading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(proofUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full animate-slide-in-up overflow-hidden rounded-t-2xl border border-border bg-surface shadow-2xl shadow-black/70 sm:max-w-md sm:rounded-2xl"
        style={{ animationDuration: "0.25s" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-surface-2/80 px-5 py-3">
          <span className="font-mono text-[11px] uppercase tracking-widest text-accent">
            Share this moment
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-text-dim transition-colors hover:border-border-hover hover:text-text"
          >
            <Icon icon={Cancel01Icon} size={14} aria-hidden={false} aria-label="Close" />
          </button>
        </div>

        <div className="p-5">
          {/* The actual shareable card */}
          <div
            ref={cardRef}
            className="relative overflow-hidden rounded-xl border border-border bg-bg p-5"
            style={{ background: "linear-gradient(135deg, #0f0f0f 0%, #080808 100%)" }}
          >
            <div
              className="pointer-events-none absolute inset-0 rounded-xl"
              style={{
                background:
                  "radial-gradient(ellipse 80% 60% at 30% 80%, rgba(205,254,0,0.06), transparent 70%)",
              }}
              aria-hidden
            />
            <div className="relative">
              {/* Brand mark */}
              <div className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2L4 5v6c0 5.2 3.4 9.4 8 11 4.6-1.6 8-5.8 8-11V5l-8-3z"
                    stroke="#cdfe00"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8.5 12l2.5 2.5 4.5-4.5"
                    stroke="#cdfe00"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-accent">
                  VAROnChain
                </span>
              </div>

              {/* Event content */}
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-dim text-accent">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 2L4 5v6c0 5.2 3.4 9.4 8 11 4.6-1.6 8-5.8 8-11V5l-8-3z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <h3 className="mt-3 font-display text-xl font-bold text-text">
                    {moment.label}
                  </h3>
                  <p className="mt-0.5 text-sm text-text-dim">
                    {moment.fixtureLabel}
                    {moment.minuteLabel && (
                      <span className="text-text-dimmer"> · {moment.minuteLabel}</span>
                    )}
                  </p>
                </div>
                {qrDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt="QR code to on-chain proof"
                    width={72}
                    height={72}
                    className="shrink-0 rounded-lg"
                  />
                )}
              </div>

              {/* Proof strip */}
              <div className="mt-4 rounded-lg border border-verified/20 bg-verified/[0.05] px-3 py-2.5">
                <p className="flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-verified">
                  <Icon icon={CheckmarkCircle01Icon} size={12} />
                  Verified on Solana
                </p>
                <p
                  className="mt-0.5 font-mono text-[10px] text-text-dim"
                  title={moment.dailyScoresPda}
                >
                  {shortHash}
                </p>
                <p className="font-mono text-[10px] text-text-dimmer">
                  Epoch day {moment.epochDay}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 flex gap-2.5">
            <button
              onClick={download}
              disabled={downloading}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-accent py-2.5 text-sm font-extrabold text-bg transition-shadow glow-accent-hover disabled:opacity-50"
            >
              <Icon icon={Download01Icon} size={15} color="#080808" />
              {downloading ? "Generating…" : "Download PNG"}
            </button>
            <button
              onClick={copyLink}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-border py-2.5 text-sm text-text-dim transition-colors hover:border-border-hover hover:text-text"
            >
              <Icon icon={copied ? CheckmarkCircle01Icon : LinkCircleIcon} size={15} />
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
