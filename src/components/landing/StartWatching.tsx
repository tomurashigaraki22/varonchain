"use client";

import { useState } from "react";
import { WalletGateModal } from "./GateModal";

export function StartWatchingButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>
        Start watching
      </button>
      {open && <WalletGateModal onClose={() => setOpen(false)} />}
    </>
  );
}