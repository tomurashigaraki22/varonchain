export function Footer() {
  return (
    <footer className="border-t border-border bg-bg">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent">
                <path
                  d="M12 2L4 5v6c0 5.2 3.4 9.4 8 11 4.6-1.6 8-5.8 8-11V5l-8-3z"
                  stroke="currentColor" strokeWidth="2" strokeLinejoin="round"
                />
                <path
                  d="M8.5 12l2.5 2.5 4.5-4.5"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
              <span className="font-display text-sm font-bold tracking-tight text-text">
                VAROnChain
              </span>
            </div>
            <p className="mt-2 max-w-xs text-sm leading-6 text-text-dim">
              Cryptographically verified World Cup fan experience powered by TxODDS TxLINE on Solana.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-2 font-mono text-xs uppercase tracking-widest text-text-dim">
            <a href="#how" className="transition-colors hover:text-text">
              How it works
            </a>
            <a href="#proof" className="transition-colors hover:text-text">
              Live demo
            </a>
            <a
              href="https://txline.txodds.com/documentation/quickstart"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-text"
            >
              TxLINE docs
            </a>
            <a
              href="https://earn.superteam.fun"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-text"
            >
              Superteam Earn
            </a>
          </div>

          {/* Badges */}
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <span className="rounded-full border border-accent/40 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-accent">
              World Cup Hackathon 2026
            </span>
            <span className="rounded-full border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-text-dimmer">
              Consumer &amp; Fan Experiences
            </span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-dimmer">
              Powered by Solana · TxODDS
            </span>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6">
          <p className="font-mono text-[11px] uppercase tracking-widest text-text-dimmer">
            © 2026 VAROnChain · Built for the Superteam Earn × TxODDS World Cup Hackathon
          </p>
        </div>
      </div>
    </footer>
  );
}
