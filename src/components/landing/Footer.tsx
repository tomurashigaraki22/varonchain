export function Footer() {
  return (
    <footer className="border-t border-border bg-bg">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          {/* Brand */}
          <div>
            <div className="flex items-center justify-center w-[100%] gap-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-accent">
                <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.6" />
                <path
                  d="M12 6.2 15.4 8.7 14.1 12.7H9.9L8.6 8.7 12 6.2Z"
                  stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"
                />
                <path d="M12 6.2V3.4M14.1 12.7l2.4 1.9M9.9 12.7l-2.4 1.9M8.6 8.7 5.9 7.9M15.4 8.7l2.7-.8"
                  stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
                />
              </svg>
              <span className="font-display text-sm font-bold tracking-tight text-text">
                VAROnChain
              </span>
            </div>
            <p className="mt-2 max-w-xs  text-sm leading-6 text-text-dim">
              Every goal, verified live. Powered by Solana.
            </p>
          </div>

         
        </div>

       
      </div>
    </footer>
  );
}