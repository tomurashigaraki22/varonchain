"use client";

import { useCallback, useState } from "react";
import { AppNavbar } from "@/components/app/AppNavbar";
import { ActivationPanel } from "@/components/ActivationPanel";
import { FixtureList } from "@/components/app/FixtureList";
import { MatchHeader } from "@/components/app/MatchHeader";
import { EventFeed } from "@/components/app/EventFeed";
import { OddsSparkline } from "@/components/app/OddsSparkline";
import { MatchModal } from "@/components/app/MatchModal";
import { PredictionGame } from "@/components/app/PredictionGame";
import { useFixtures, type Fixture } from "@/lib/hooks/useFixtures";
import { useActivationStatus } from "@/lib/hooks/useActivationStatus";

type RawScoreEvent = Record<string, unknown>;

export default function AppPage() {
  const serverStatus = useActivationStatus();
  const [localActivated, setLocalActivated] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [selectedFixture, setSelectedFixture] = useState<{
    id: number;
    label: string;
    raw: Fixture;
  } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [matchEvents, setMatchEvents] = useState<RawScoreEvent[]>([]);
  const [latestKeyAction, setLatestKeyAction] = useState<string | undefined>();
  const [matchEnded, setMatchEnded] = useState(false);

  const activated = serverStatus === "activated" || localActivated;
  const { fixtures, loading, error } = useFixtures(activated);

  const handleSelectFixture = useCallback((fixture: { id: number; label: string; raw: Fixture }) => {
    setSelectedFixture(fixture);
    setMatchEvents([]);
    setLatestKeyAction(undefined);
    // Immediately mark as ended if the fixture GameState is already finished
    const gs = Number(fixture.raw.GameState ?? 1);
    setMatchEnded([5, 10, 13].includes(gs));
    setModalOpen(true);
  }, []);

  const handleEventsChange = useCallback((events: RawScoreEvent[]) => {
    setMatchEvents((prev) => [...prev, ...events]);
  }, []);

  const isChecking = serverStatus === "checking";

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <AppNavbar />

      {/* Hero — dot grid + glow */}
      <div className="relative overflow-hidden bg-dot-grid">
        <div className="absolute inset-0 bg-hero-glow" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-6 pt-12 pb-14 sm:pt-16 sm:pb-18">
          <span className="inline-flex items-center rounded-full border border-accent/30 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-accent">
            {activated ? "02 — Select fixture" : "01 — Connect"}
          </span>
          <h1 className="mt-4 font-display text-[clamp(1.75rem,5vw,3rem)] font-bold leading-tight tracking-tight text-text">
            {activated ? (
              <>World Cup <span className="text-accent">Live Data</span></>
            ) : (
              <>Activate the free <span className="text-accent">World Cup</span> data feed</>
            )}
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-text-dim">
            {activated
              ? "Select a fixture below to open the live verified feed — every goal and card checked against a Solana-anchored Merkle root."
              : "Connect a devnet wallet and subscribe on-chain. No payment, no KYC — just the Solana fee for the one-time subscribe transaction."}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] uppercase tracking-wide text-text-dim">
            <span>Solana-anchored</span>
            <span className="text-border">·</span>
            <span>Merkle verified</span>
            <span className="text-border">·</span>
            <span>Real-time stream</span>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 pb-16 pt-8">
        <div className="flex flex-col gap-8">

          {/* While checking cookies — show a subtle skeleton so no flash */}
          {isChecking && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-5 py-4">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="text-sm text-text-dim">Checking session…</span>
            </div>
          )}

          {/* Activation panel — only show once we know they are NOT activated */}
          {!isChecking && !activated && (
            <div className="animate-fade-up">
              <ActivationPanel
                onActivated={() => setLocalActivated(true)}
                onTxSig={setTxSig}
              />
            </div>
          )}

          {/* Activated confirmation strip */}
          {activated && (
            <div className="flex items-center justify-between rounded-xl border border-accent/20 bg-accent-dim px-5 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent font-mono text-[10px] font-bold text-bg">
                  ✓
                </span>
                <span className="text-sm font-medium text-accent">TxLINE active</span>
                <span className="text-sm text-text-dim">— Free World Cup tier</span>
              </div>
              {txSig && (
                <a
                  href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden font-mono text-xs text-accent underline-offset-4 hover:underline sm:inline"
                >
                  View tx ↗
                </a>
              )}
            </div>
          )}

          {/* Fixtures */}
          <FixtureList
            active={activated}
            fixtures={fixtures}
            loading={loading}
            error={error}
            selectedFixtureId={selectedFixture?.id}
            onSelect={handleSelectFixture}
          />
        </div>
      </main>

      {/* Match modal */}
      {modalOpen && selectedFixture && (
        <MatchModal
          title={selectedFixture.label}
          onClose={() => setModalOpen(false)}
          header={
            <MatchHeader
              label={selectedFixture.label}
              fixtureId={selectedFixture.id}
              fixture={selectedFixture.raw as Record<string, unknown>}
              events={matchEvents}
            />
          }
        >
          <OddsSparkline fixtureId={selectedFixture.id} />
          <EventFeed
            fixtureId={selectedFixture.id}
            fixtureLabel={selectedFixture.label}
            matchStartTime={Number(selectedFixture.raw.StartTime ?? 0) || undefined}
            onEventsChange={handleEventsChange}
            onLatestKeyAction={setLatestKeyAction}
            onMatchEnd={() => setMatchEnded(true)}
          />
          <PredictionGame
            fixtureId={selectedFixture.id}
            latestAction={latestKeyAction}
            matchEnded={matchEnded}
          />
        </MatchModal>
      )}
    </div>
  );
}
