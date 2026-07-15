import { Reveal } from "./Reveal";

export function FeatureBento() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-widest text-text-dim">
            What you get
          </p>
        </Reveal>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-2">
          {/* 01 — big card spans 2 rows */}
          <Reveal className="md:col-span-2 md:row-span-2">
            <div className="glass flex h-full flex-col justify-between rounded-xl p-7">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-dim font-mono text-xs font-bold text-accent">
                01
              </span>
              <div>
                <h3 className="font-display text-xl font-bold text-text">
                  Live verified match ticker
                </h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-text-dim">
                  Goals, cards, and substitutions stream in with a real
                  on-chain proof check attached to every event — not a badge
                  slapped on after the fact. Powered by{" "}
                  <span className="text-text">validateStatV2</span> on the
                  TxLINE Anchor program.
                </p>
              </div>
            </div>
          </Reveal>

          {/* 02 */}
          <Reveal delayMs={100}>
            <div className="glass flex h-full flex-col justify-between rounded-xl p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-dim font-mono text-xs font-bold text-accent">
                02
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-text">
                  Shareable moment cards
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-text-dim">
                  Download a PNG stamped with the proof hash and QR code the
                  instant a goal lands.
                </p>
              </div>
            </div>
          </Reveal>

          {/* 03 */}
          <Reveal delayMs={160}>
            <div className="glass flex h-full flex-col justify-between rounded-xl p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-dim font-mono text-xs font-bold text-accent">
                03
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-text">
                  Crowd Pulse
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-text-dim">
                  Live match-momentum sparkline built from TxODDS&rsquo;
                  StablePrice odds feed — no betting interface, just the
                  signal.
                </p>
              </div>
            </div>
          </Reveal>

          {/* 04 — full-width bottom */}
          <Reveal delayMs={220} className="md:col-span-3">
            <div className="glass flex flex-col gap-3 rounded-xl p-6 sm:flex-row sm:items-center sm:gap-8">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-dim font-mono text-xs font-bold text-accent">
                04
              </span>
              <div className="flex-1">
                <h3 className="font-display text-base font-bold text-text">
                  Free-to-play prediction game
                </h3>
                <p className="mt-1 text-sm leading-6 text-text-dim">
                  Guess the next goal, card, corner, or penalty in a live
                  window. Auto-resolves from the live stream. Points tracked
                  with a real-time leaderboard — no gambling, no stakes.
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-accent/30 bg-accent-dim px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-accent">
                Free to play
              </span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
