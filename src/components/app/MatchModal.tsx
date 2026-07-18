"use client";

import { useEffect } from "react";

export function MatchModal({
  title,
  isLive = false,
  onClose,
  header,
  children,
}: {
  title: string;
  /** Whether the match is currently in progress — controls the pulsing dot. */
  isLive?: boolean;
  onClose: () => void;
  /** Pinned score header — rendered above the scroll body, never scrolls away */
  header?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        /* Mobile: full-width sheet that slides up from bottom.
           Desktop (sm+): centred card with max dimensions. */
        className="
          flex w-full flex-col overflow-hidden
          rounded-t-2xl border border-border bg-surface shadow-2xl shadow-black/80
          animate-slide-in-up
          sm:max-h-[90vh] sm:max-w-5xl sm:rounded-2xl
          max-h-[88vh]
        "
        style={{ animationDuration: "0.28s" }}
      >
        {/* Header bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface-2/80 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* Live pulse dot — only pulses while the match is actually in progress */}
            <span className="relative flex h-2 w-2 shrink-0">
              {isLive && (
                <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-accent opacity-75" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  isLive ? "bg-accent" : "bg-text-dimmer"
                }`}
              />
            </span>
            <span className="truncate font-mono text-[11px] uppercase tracking-widest text-accent">
              {title}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-sm text-text-dim transition-colors hover:border-border-hover hover:text-text"
          >
            ✕
          </button>
        </div>

        {/* Pinned score header — sits between title bar and scroll body */}
        {header && <div className="shrink-0">{header}</div>}

        {/* Scrollable body */}
        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}
