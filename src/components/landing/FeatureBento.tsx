import { Reveal } from "./Reveal";

const FEATURES = [
  {
    tag: "01",
    title: "Live verified match ticker",
    body: "Goals, cards, and substitutions stream in with a real check attached to every event. Verified the instant it happens.",
  },
  {
    tag: "02",
    title: "Shareable moment cards",
    body: "Download a PNG stamped with the proof hash and QR code the instant a goal lands.",
  },
  {
    tag: "03",
    title: "Crowd Pulse",
    body: "A live line showing which way the match is swinging, the momentum, not betting odds.",
  },
  {
    tag: "04",
    title: "Free-to-play prediction game",
    body: "Guess the next goal, card, corner, or penalty in a live window. Auto-resolves from the live stream. Points tracked with a real-time leaderboard with no gambling, no stakes.",
  },
];

export function FeatureBento() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-widest text-text-dim">
            What you get
          </p>
        </Reveal>

        <div className="mt-6 divide-y divide-border border-t border-border">
          {FEATURES.map((f, i) => (
            <Reveal key={f.tag} delayMs={i * 100}>
              <div
                className={`flex flex-col gap-4 py-10 sm:flex-row sm:items-center sm:gap-10 ${
                  i % 2 === 1 ? "sm:flex-row-reverse sm:text-right" : ""
                }`}
              >
                <span className="shrink-0 font-display text-6xl font-bold text-text-dimmer/30 sm:text-7xl">
                  {f.tag}
                </span>
                <div className="max-w-xl">
                  <h3 className="font-display text-2xl font-bold text-text">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-text-dim sm:text-base">
                    {f.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}