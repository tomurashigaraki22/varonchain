"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { fixtureId, fixtureLabel, type Fixture } from "@/lib/hooks/useFixtures";

type Step = "connect" | "select" | "live";

function truncate(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function StepRow({
  step,
  current,
  label,
  index,
}: {
  step: Step;
  current: Step | "done";
  label: string;
  index: string;
}) {
  const order: Step[] = ["connect", "select", "live"];
  const currentIndex = current === "done" ? 3 : order.indexOf(current);
  const stepIndex = order.indexOf(step);
  const isDone = stepIndex < currentIndex || current === "done";
  const isActive = stepIndex === currentIndex;

  return (
    <div className="flex items-center gap-2.5 py-1 text-sm">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-bold transition-colors ${
          isDone
            ? "bg-accent text-bg"
            : isActive
            ? "border border-accent text-accent"
            : "border border-border text-text-dimmer"
        }`}
      >
        {isDone ? "✓" : index}
      </span>
      <span
        className={`text-xs transition-colors ${
          isDone ? "text-text" : isActive ? "text-accent" : "text-text-dimmer"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export function Rail({
  activated,
  txSig,
  fixtures,
  selectedFixtureId,
  onSelectFixture,
}: {
  activated: boolean;
  txSig: string | null;
  fixtures: Fixture[] | null;
  selectedFixtureId?: number;
  onSelectFixture?: (fixture: { id: number; label: string }) => void;
}) {
  const { publicKey, connected } = useWallet();

  const currentStep: Step | "done" = !activated
    ? "connect"
    : selectedFixtureId == null
    ? "select"
    : "live";

  return (
    <aside className="hidden w-[260px] shrink-0 border-r border-border bg-[#080808] lg:flex lg:flex-col">
      <div className="flex-1 overflow-y-auto p-5">
        {/* Wallet section */}
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-text-dimmer">
            Wallet
          </p>
          {connected && publicKey ? (
            <>
              <p className="mt-1.5 font-mono text-xs text-text">
                {truncate(publicKey.toBase58())}
              </p>
              <p className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-text-dim">
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" />
                Connected · Devnet
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-xs text-text-dimmer">Not connected</p>
          )}
        </div>

        <div className="my-4 h-px bg-border" />

        {/* Steps */}
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-text-dimmer">
            Progress
          </p>
          <div className="mt-2 flex flex-col gap-0.5">
            <StepRow step="connect" current={currentStep} label="Connect wallet" index="01" />
            <StepRow step="select" current={currentStep} label="Select fixture" index="02" />
            <StepRow step="live" current={currentStep} label="Live feed" index="03" />
          </div>
        </div>

        <div className="my-4 h-px bg-border" />

        {/* Tier */}
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-text-dimmer">
            TxLINE tier
          </p>
          <p className="mt-1.5 text-xs text-text">Free · World Cup</p>
          {txSig && (
            <a
              href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block font-mono text-[10px] text-accent hover:underline"
            >
              ↗ View on Explorer
            </a>
          )}
        </div>

        {/* Fixtures quick-nav */}
        {fixtures && fixtures.length > 0 && (
          <>
            <div className="my-4 h-px bg-border" />
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-text-dimmer">
                Fixtures
              </p>
              <div className="mt-2 flex flex-col gap-0.5">
                {fixtures.slice(0, 8).map((fx, i) => {
                  const id = fixtureId(fx, i);
                  const { home, away } = fixtureLabel(fx);
                  const isSelected = selectedFixtureId === id;
                  return (
                    <button
                      key={id}
                      onClick={() => onSelectFixture?.({ id, label: `${home} vs ${away}` })}
                      className={`truncate rounded-md px-2 py-1.5 text-left text-xs transition-all ${
                        isSelected
                          ? "border-l-2 border-accent bg-accent-dim text-accent"
                          : "border-l-2 border-transparent text-text-dim hover:border-border hover:bg-surface hover:text-text"
                      }`}
                    >
                      {home} vs {away}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
