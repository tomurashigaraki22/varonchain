import Link from "next/link";
import { GoalMoment } from "./GoalMoment";
import { StadiumBackground } from "./StadiumBackground";
import { StartWatchingButton } from "./StartWatching";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <StadiumBackground />
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 pt-16 pb-20 lg:grid-cols-[60%_40%] lg:items-center lg:pt-20 lg:pb-24">
        <div className="animate-fade-up">
          
          <h1 className="mt-5 max-w-2xl font-display text-[clamp(2.75rem,7vw,5.5rem)] font-bold leading-[1.02] tracking-[-0.04em] text-text">
            Don&rsquo;t just watch.
            <br />
            Know it&rsquo;s <span className="text-accent">real.</span>
          </h1>

          <p className="mt-5 max-w-[480px] text-base leading-[1.7] text-text-dim sm:text-lg">
            Every goal, card, and big moment — checked and proven true the
            instant it happens. Free to follow, verified on Solana.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <StartWatchingButton className="rounded-full bg-accent px-8 py-3.5 text-sm font-extrabold text-bg transition-shadow glow-accent-hover" />
            <a
              href="#how"
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-text transition-colors hover:text-accent"
            >
              How it works
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </a>
          </div>

          <div className="mt-10 flex max-w-md items-center gap-8">
            <div>
              <p className="font-display text-2xl font-bold text-text">Free</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-text-dimmer">Entry</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-text">Proven</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-text-dimmer">Results</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-text">104</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-text-dimmer">Matches</p>
            </div>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <GoalMoment />
        </div>
      </div>
    </section>
  );
}