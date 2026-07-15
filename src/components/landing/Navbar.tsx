import Link from "next/link";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-[rgba(8,8,8,0.85)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-text-dim sm:flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-accent" />
            </span>
            Live · TxLINE
          </span>
        </div>

        <Link
          href="/"
          className="flex items-center gap-1.5 font-display text-sm font-bold tracking-tight text-text"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            className="text-accent"
          >
            <path
              d="M12 2L4 5v6c0 5.2 3.4 9.4 8 11 4.6-1.6 8-5.8 8-11V5l-8-3z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M8.5 12l2.5 2.5 4.5-4.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          VAROnChain
        </Link>

        <nav className="flex items-center gap-5 font-mono text-xs uppercase tracking-widest text-text-dim">
          <a href="#how" className="hidden transition-colors hover:text-text sm:inline">
            How it works
          </a>
          <a href="#proof" className="hidden transition-colors hover:text-text md:inline">
            Live Demo
          </a>
          <a
            href="https://txline.txodds.com/documentation/quickstart"
            target="_blank"
            rel="noreferrer"
            className="hidden transition-colors hover:text-text md:inline"
          >
            Docs
          </a>
          <Link
            href="/app"
            className="rounded-md bg-accent px-4 py-2 font-sans text-xs font-extrabold text-bg normal-case tracking-normal transition-shadow glow-accent-hover"
          >
            Launch App
          </Link>
        </nav>
      </div>
    </header>
  );
}
