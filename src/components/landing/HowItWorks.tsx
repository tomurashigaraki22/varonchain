import { Reveal } from "./Reveal";

const STEPS = [
  {
    tag: "01",
    title: "Data in",
    body: "TxODDS feeds live match events straight from the stadium — no broadcast lag.",
    icon: (
      <path
        d="M4 12a8 8 0 0116 0M7 12a5 5 0 0110 0M12 12v8m0 0l-3-3m3 3l3-3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    tag: "02",
    title: "On-chain proof",
    body: "Every batch is hashed into a Merkle root and anchored to Solana in real time.",
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
    title: "Fan sees it",
    body: "A verified event card lands in your feed — proof attached, not promised.",
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
];

export function HowItWorks() {
  return (
    <section id="how" className="border-b border-border">
      <div
        className="mx-auto max-w-6xl px-6 py-20"
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

        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-4">
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
