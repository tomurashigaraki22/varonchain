import Link from "next/link";
import { StartWatchingButton } from "./StartWatching";

export function Navbar() {
  return (
    <header className="sticky top-0 py-5 z-50 border-b border-border bg-[rgba(8,8,8,0.85)] backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
        <Link
          href="/"
          className="flex items-center gap-1.5 font-display text-sm font-bold tracking-tight text-text"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            className="text-accent"
          >
            <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M12 6.2 15.4 8.7 14.1 12.7H9.9L8.6 8.7 12 6.2Z"
              stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"
            />
            <path d="M12 6.2V3.4M14.1 12.7l2.4 1.9M9.9 12.7l-2.4 1.9M8.6 8.7 5.9 7.9M15.4 8.7l2.7-.8"
              stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
            />
          </svg>
          VAROnChain
        </Link>

        <nav className="flex items-center gap-5 font-mono text-xs uppercase tracking-widest text-text-dim">
          <a href="#how" className="hidden transition-colors hover:text-text sm:inline">
            How it works
          </a>
         
          <a
            href="https://t.me/varonchainbot?start=sub_18237038"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 transition-colors hover:text-text sm:inline-flex"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M21.94 4.36 18.6 20.2c-.25 1.13-.9 1.4-1.83.87l-5.06-3.73-2.44 2.35c-.27.27-.5.5-1.02.5l.37-5.16 9.4-8.5c.41-.36-.09-.56-.63-.2L6.6 12.63l-5.02-1.57c-1.09-.34-1.11-1.09.23-1.6L20.5 3.05c.9-.34 1.7.2 1.44 1.31Z" />
            </svg>
            Telegram
          </a>
         <StartWatchingButton className="rounded-full bg-accent px-8 py-3.5 text-sm font-extrabold text-bg transition-shadow glow-accent-hover" />
        </nav>
      </div>
    </header>
  );
}