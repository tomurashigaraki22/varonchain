"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AppNavbar } from "@/components/app/AppNavbar";
import { ActivationPanel } from "@/components/ActivationPanel";
import { FeaturedMatch } from "@/components/app/FeaturedMatch";
import { FixtureList } from "@/components/app/FixtureList";
import { StadiumBackground } from "@/components/landing/StadiumBackground";
import { useFixtures, type Fixture } from "@/lib/hooks/useFixtures";
import { useActivationStatus } from "@/lib/hooks/useActivationStatus";

export default function AppPage() {
  const router = useRouter();
  const serverStatus = useActivationStatus();
  const [localActivated, setLocalActivated] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [selectedFixtureId, setSelectedFixtureId] = useState<number | undefined>();

  const activated = serverStatus === "activated" || localActivated;
  const { fixtures, loading, error } = useFixtures(activated);

  // Tracking a fixture now opens a full page (/app/play/[fixtureId]) instead
  // of an in-page modal — label/kickoff time are passed via query params so
  // the play layout doesn't need a second fetch just to render the header.
  const handleSelectFixture = useCallback(
    (fixture: { id: number; label: string; raw: Fixture }) => {
      setSelectedFixtureId(fixture.id);
      const startTime = Number(fixture.raw.StartTime ?? 0);
      const params = new URLSearchParams({ label: fixture.label });
      if (startTime > 0) params.set("start", String(startTime));
      router.push(`/app/play/${fixture.id}?${params.toString()}`);
    },
    [router]
  );

  const isChecking = serverStatus === "checking";

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <AppNavbar />

      {/* Hero — stadium scene, matching the landing page, tighter rhythm, fan-first copy */}
      <div className="relative overflow-hidden">
        <StadiumBackground />
        <div className="relative mx-auto max-w-7xl px-6 pt-8 pb-8 sm:pt-10 sm:pb-10">
          <h1 className="font-display text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-tight tracking-tight text-text">
            Every goal. <span className="text-accent">Verified live.</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-dim">
            Follow every World Cup match as it happens — goals, cards, subs, all live. Tap any big
            moment to see the proof behind it, backed by real match data.
          </p>

          {/* Technical detail — present but no longer the headline */}
          <details className="mt-4 max-w-xl">
            <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-text-dimmer hover:text-text-dim">
              How the verification works ⓘ
            </summary>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-text-dimmer">
              Every match event is checked against a Solana-anchored Merkle root — a
              cryptographic proof, not a claim. Free to use, no crypto experience required.
            </p>
          </details>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 pb-16 pt-6">
        <div className="flex flex-col gap-6">

          {/* While checking cookies — show a subtle skeleton so no flash */}
          {isChecking && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-5 py-4">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="text-sm text-text-dim">Just a sec…</span>
            </div>
          )}

          {/* Activation — a compact, non-blocking strip. Fans can browse matches
              below without connecting anything; a wallet is only needed to
              unlock the live feed + verify moments, and it's introduced right
              where that value actually shows up rather than as a gate up front.
              (Most fans will already be activated via the landing page's
              Start Watching modal — this is the fallback for anyone who lands
              here directly.) */}
          {!isChecking && !activated && (
            <div className="animate-fade-up rounded-xl border border-border bg-surface px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-text">Want live scores + verified moments?</p>
                  <p className="mt-0.5 text-xs text-text-dim">One free tap unlocks the live feed — no crypto knowledge needed.</p>
                </div>
                <ActivationPanel
                  onActivated={() => setLocalActivated(true)}
                  onTxSig={setTxSig}
                />
              </div>
            </div>
          )}

          {/* Activated confirmation strip */}
          {activated && (
            <div className="flex items-center justify-between rounded-xl border border-accent/20 bg-accent-dim px-5 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent font-mono text-[10px] font-bold text-bg">
                  ✓
                </span>
                <span className="text-sm font-medium text-accent">Live feed unlocked</span>
              </div>
              {txSig && (
                <a
                  href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden font-mono text-xs text-accent underline-offset-4 hover:underline sm:inline"
                >
                  Proof of unlock ↗
                </a>
              )}
            </div>
          )}

          {/* Match of the day / favourite upcoming match */}
          {activated && <FeaturedMatch fixtures={fixtures} onSelect={handleSelectFixture} />}

          {/* Fixtures — always shown so fans can see what's on, even before unlocking */}
          <FixtureList
            active={true}
            fixtures={fixtures}
            loading={activated ? loading : false}
            error={activated ? error : null}
            selectedFixtureId={selectedFixtureId}
            onSelect={handleSelectFixture}
          />
        </div>
      </main>
    </div>
  );
}
