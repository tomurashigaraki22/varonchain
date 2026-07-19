"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ActivationPanel } from "@/components/ActivationPanel";

export function WalletGateModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  // Portal to document.body: this button lives inside Hero's
  // `.animate-fade-up` wrapper, whose keyframe ends on `transform:
  // translateY(0)` with fill-mode `both` — a non-`none` transform on an
  // ancestor creates a new CSS containing block for any descendant
  // `position: fixed` element, so without a portal this modal was
  // positioning itself relative to that div instead of the viewport
  // (rendering pinned near the top instead of centered full-screen).
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-up"
      onClick={(e) => {
        if (!dialogRef.current?.contains(e.target as Node)) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Connect wallet to start watching"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-4 shadow-2xl shadow-black/80"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-lg font-bold text-text">
            One tap to start watching
          </p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full text-text-dim transition-colors hover:bg-surface-2 hover:text-text"
          >
            ✕
          </button>
        </div>
        <ActivationPanel onActivated={() => router.push("/app")} />
      </div>
    </div>,
    document.body
  );
}