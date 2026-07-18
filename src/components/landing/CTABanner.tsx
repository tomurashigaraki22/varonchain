import Link from "next/link";

export function CTABanner() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-bg">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 700px 400px at 50% 50%, rgba(129,140,248,0.06), transparent 70%)",
        }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-3xl px-6 py-24 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-accent">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" />
          Live now · World Cup 2026
        </span>
        <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
          Your fans deserve the truth{" "}
          <span className="text-accent">in real time.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-text-dim sm:text-base">
          Built on TxODDS verified data. Every event cryptographically proven
          against a Solana Merkle root. Ready for the World Cup.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
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
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-text-dim transition-colors hover:text-text"
          >
            TxLINE docs
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </a>
        </div>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-text-dimmer">
          Free World Cup tier · Devnet wallet · No TxL required
        </p>
      </div>
    </section>
  );
}
