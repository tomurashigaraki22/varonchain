import { Reveal } from "./Reveal";

const STEPS = [
  {
    tag: "01",
    title: "Connect your wallet",
    body: "One free tap with no payment and no signup form. you need just a wallet, so we know where will send your feed to.",
    icon: (
      <path
        d="M4 8a2 2 0 012-2h11a2 2 0 012 2v1h-3a3 3 0 000 6h3v1a2 2 0 01-2 2H6a2 2 0 01-2-2V8zM16 12h1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    tag: "02",
    title: "We check every event",
    body: "The moment a goal, card, or sub happens, it's checked and locked so nothing can be faked or changed after the fact.",
    icon: (
      <path
        d="M9 12a3 3 0 106 0 3 3 0 00-6 0zM4 7l3 2m10-2l-3 2M4 17l3-2m10 2l-3-2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    tag: "03",
    title: "You see it live",
    body: "A verified event lands in your feed with proof attached, not promised. Share it, or just watch the match unfold.",
    icon: (
      <path
        d="M7 3h10a1 1 0 011 1v16a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM10 18h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    tag: "04",
    title: "Or predict what's next",
    body: "Guess the next goal, card, corner, or penalty before it happens. Free to play, points tracked on a live leaderboard.",
    icon: (
      <path
        d="M12 3v4M12 17v4M3 12h4M17 12h4M7 7l2.5 2.5M17 7l-2.5 2.5M7 17l2.5-2.5M17 17l-2.5-2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-b border-border">
      <div
        className="mx-auto max-w-7xl px-6 py-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "100% 88px",
          backgroundPosition: "top",
        }}
      >
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-widest text-text-dim">
            How it works
          </p>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4 lg:gap-4">
          {STEPS.map((step, i) => (
            <Reveal key={step.tag} delayMs={i * 120} className="relative">
              {i < STEPS.length - 1 && (
                <div className="absolute top-6 left-full hidden w-8 border-t border-dashed border-border sm:block" />
              )}
              <div className="group rounded-lg border border-border bg-surface p-6 transition-all duration-300 hover:-translate-y-1 hover:border-border-hover">
                <span className="font-mono text-[10px] text-text-dim">
                  {step.tag}
                </span>
                <div className="mt-3 flex h-12 w-12 items-center justify-center rounded-md bg-accent-dim text-accent">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    {step.icon}
                  </svg>
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-text">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-text-dim">
                  {step.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}