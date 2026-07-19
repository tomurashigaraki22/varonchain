"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ActivationPanel } from "@/components/ActivationPanel";

export function WalletGateModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-up"
      onClick={(e) => {
        if (!dialogRef.current?.contains(e.target as Node)) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Connect wallet to start watching"
    >
      <div ref={dialogRef} className="w-full max-w-sm">
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
    </div>
  );
}