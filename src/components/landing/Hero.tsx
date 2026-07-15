import Link from "next/link";
import { LiveTickerWidget } from "./LiveTickerWidget";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-dot-grid">
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 pt-16 pb-20 lg:grid-cols-[60%_40%] lg:items-center lg:pt-20 lg:pb-24">
        <div className="animate-fade-up">
          <span className="inline-flex items-center rounded-full border border-accent/40 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-accent">
            World Cup Hackathon · Consumer &amp; Fan Experiences
          </span>

          <h1 className="mt-5 max-w-2xl font-display text-[clamp(2.75rem,7vw,5.5rem)] font-bold leading-[1.02] tracking-[-0.04em] text-text">
            Every goal.
            <br />
            Verified <span className="text-accent">on-chain.</span>
          </h1>

          <p className="mt-5 max-w-[500px] text-base leading-[1.7] text-text-dim sm:text-lg">
            VAROnChain turns TxODDS&rsquo; cryptographically verified live
            match data into a real-time fan companion — every score update
            checked against a Solana-anchored Merkle root before it hits
            your screen.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/app"
              className="rounded-full bg-accent px-8 py-3.5 text-sm font-extrabold text-bg transition-shadow glow-accent-hover"
            >
              Launch App
            </Link>
            <a
              href="https://txline.txodds.com/documentation/quickstart"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-text transition-colors hover:text-accent"
            >
              Read the TxLINE docs
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] uppercase tracking-wide text-text-dim">
            <span>Solana-anchored</span>
            <span className="text-border">·</span>
            <span>Merkle verified</span>
            <span className="text-border">·</span>
            <span>Real-time stream</span>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <LiveTickerWidget />
        </div>
      </div>
    </section>
  );
}
