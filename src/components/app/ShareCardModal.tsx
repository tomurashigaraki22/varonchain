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
  FootballIcon,
} from "@hugeicons/core-free-icons";

export type ShareAccent = "goal" | "red" | "yellow" | "var" | "none";

export type ShareableMoment = {
  title: string;
  detail?: string;
  accent: ShareAccent;
  fixtureLabel: string;
  minuteLabel?: string;
  verified: boolean;
  dailyScoresPda?: string;
  epochDay?: number;
};

const ACCENT_THEME: Record<
  ShareAccent,
  { glow: string; ring: string; text: string; badgeBorder: string; badgeBg: string; icon: string }
> = {
  goal: {
    glow: "rgba(129,140,248,0.16)",
    ring: "border-accent/30",
    text: "text-accent",
    badgeBorder: "border-accent/30",
    badgeBg: "bg-accent-dim",
    icon: "#818cf8",
  },
  red: {
    glow: "rgba(248,113,113,0.16)",
    ring: "border-red-500/30",
    text: "text-red-400",
    badgeBorder: "border-red-500/30",
    badgeBg: "bg-red-500/10",
    icon: "#f87171",
  },
  yellow: {
    glow: "rgba(250,204,21,0.14)",
    ring: "border-yellow-400/30",
    text: "text-yellow-400",
    badgeBorder: "border-yellow-400/30",
    badgeBg: "bg-yellow-400/10",
    icon: "#facc15",
  },
  var: {
    glow: "rgba(148,163,184,0.14)",
    ring: "border-border",
    text: "text-text",
    badgeBorder: "border-border",
    badgeBg: "bg-surface-2",
    icon: "#e5e5e5",
  },
  none: {
    glow: "rgba(129,140,248,0.08)",
    ring: "border-border",
    text: "text-text",
    badgeBorder: "border-border",
    badgeBg: "bg-surface-2",
    icon: "#e5e5e5",
  },
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

  const theme = ACCENT_THEME[moment.accent];
  const proofUrl = moment.dailyScoresPda
    ? `https://explorer.solana.com/address/${moment.dailyScoresPda}?cluster=devnet`
    : "https://varonchain.app";
  const shortHash = moment.dailyScoresPda
    ? `${moment.dailyScoresPda.slice(0, 8)}…${moment.dailyScoresPda.slice(-6)}`
    : null;

  useEffect(() => {
    QRCode.toDataURL(proofUrl, {
      width: 200,
      margin: 1,
      color: { dark: "#121214", light: "#818cf8" },
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
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 3,
        width: 300,
        height: 533,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `varonchain-${moment.title.toLowerCase().replace(/\s+/g, "-")}.png`;
      a.click();
    } catch {
      // best-effort — user can still screenshot manually
    } finally {
      setDownloading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(proofUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const [home, away] = moment.fixtureLabel.split(" vs ");

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/85 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full animate-slide-in-up flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-2xl shadow-black/70 sm:max-w-sm sm:rounded-2xl"
        style={{ animationDuration: "0.25s" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface-2/80 px-5 py-3">
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

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {/* The actual shareable card — vertical "story" format (9:16),
              built for saving/reposting to WhatsApp / IG / Snap status. */}
          <div className="flex justify-center">
            <div
              ref={cardRef}
              className="relative overflow-hidden rounded-2xl border border-border"
              style={{
                width: 300,
                height: 533,
              }}
            >
            {/* Base background moved to inner element so html-to-image respects border-radius */}
            <div
              className="pointer-events-none absolute inset-0 -z-10"
              style={{
                background: "radial-gradient(ellipse 120% 80% at 50% 0%, #27272a 0%, #121214 55%)",
              }}
              aria-hidden
            />
            {/* Glow wash */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(ellipse 90% 50% at 50% 22%, ${theme.glow}, transparent 65%)`,
              }}
              aria-hidden
            />
            {/* Dot grid texture */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)",
                backgroundSize: "14px 14px",
              }}
              aria-hidden
            />
            {/* Watermark icon — kept fully inside the card's own box so
                html-to-image doesn't size the exported canvas around an
                overflowing descendant (it clips visually, but "capture the
                node's full extent including offscreen children" is a known
                foreignObject-serialization quirk). */}
            <div
              className="pointer-events-none absolute right-2 top-2 opacity-[0.06]"
              aria-hidden
            >
              <Icon icon={FootballIcon} size={120} color={theme.icon} />
            </div>

            <div className="relative flex h-full flex-col px-5 py-6">
              {/* Brand mark */}
              <div className="flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2L4 5v6c0 5.2 3.4 9.4 8 11 4.6-1.6 8-5.8 8-11V5l-8-3z"
                    stroke="#818cf8" strokeWidth="2" strokeLinejoin="round"
                  />
                  <path
                    d="M8.5 12l2.5 2.5 4.5-4.5"
                    stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  />
                </svg>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-accent">
                  VAROnChain
                </span>
              </div>

              {/* Fixture context */}
              <p className="mt-4 truncate text-center font-mono text-[10px] uppercase tracking-widest text-text-dimmer">
                {home?.trim()} <span className="text-text-dimmer">vs</span> {away?.trim()}
              </p>

              {/* Center: event badge + huge title */}
              <div className="mt-auto flex flex-1 flex-col items-center justify-center text-center">
                <span
                  className={`flex h-16 w-16 items-center justify-center rounded-full border ${theme.badgeBorder} ${theme.badgeBg}`}
                >
                  <Icon icon={FootballIcon} size={30} color={theme.icon} />
                </span>
                <h3 className={`mt-4 font-display text-[2.1rem] font-extrabold leading-none tracking-tight ${theme.text}`}>
                  {moment.title}
                </h3>
                {moment.detail && (
                  <p className="mt-2 text-sm font-medium text-text">{moment.detail}</p>
                )}
                {moment.minuteLabel && (
                  <p className="mt-1 font-mono text-xs text-text-dimmer">{moment.minuteLabel}</p>
                )}
              </div>

              {/* Bottom: proof strip or live badge */}
              <div className="mt-auto">
                {moment.verified && shortHash ? (
                  <div className="flex items-end justify-between gap-3 rounded-xl border border-verified/25 bg-verified/[0.06] px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-verified">
                        <Icon icon={CheckmarkCircle01Icon} size={10} />
                        Verified on Solana
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[9px] text-text-dim" title={moment.dailyScoresPda}>
                        {shortHash}
                      </p>
                      {moment.epochDay != null && (
                        <p className="font-mono text-[9px] text-text-dimmer">Epoch day {moment.epochDay}</p>
                      )}
                    </div>
                    {qrDataUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qrDataUrl} alt="QR to on-chain proof" width={56} height={56} className="shrink-0 rounded-md" />
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-surface-2/60 px-3 py-2.5 text-center">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-text-dimmer">
                      Live from TxLINE · varonchain.app
                    </p>
                  </div>
                )}
              </div>
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
              <Icon icon={Download01Icon} size={15} color="#ffffff" />
              {downloading ? "Generating…" : "Save image"}
            </button>
            <button
              onClick={copyLink}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-border py-2.5 text-sm text-text-dim transition-colors hover:border-border-hover hover:text-text"
            >
              <Icon icon={copied ? CheckmarkCircle01Icon : LinkCircleIcon} size={15} />
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <p className="mt-3 text-center text-[11px] leading-4 text-text-dimmer">
            Sized for WhatsApp / Instagram / Snapchat status — save the image and post it straight from your gallery.
          </p>
        </div>
      </div>
    </div>
  );
}
