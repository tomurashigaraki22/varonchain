import Link from "next/link";
import { StadiumBackground } from "./StadiumBackground";
import { StartWatchingButton } from "./StartWatching";

export function CTABanner() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-bg">
      <StadiumBackground />
      <div className="relative mx-auto max-w-3xl px-6 py-24 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-accent">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" />
          Live now · World Cup 2026
        </span>
        <h2 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-text sm:text-5xl">
          What if every goal{" "}
          <span className="text-accent">came with proof?</span>
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-text-dim sm:text-base">
          Every goal, card, and big moment is checked and proven true the
          instant it happens. Free to follow, built on Solana.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <StartWatchingButton className="rounded-full bg-accent px-8 py-3.5 text-sm font-extrabold text-bg transition-shadow glow-accent-hover" />
        </div>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-text-dimmer">
          Free entry · One tap to start
        </p>
      </div>
    </section>
  );
}