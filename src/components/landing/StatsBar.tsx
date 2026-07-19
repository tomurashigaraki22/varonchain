const STATS = [
  { value: "104 matches", label: "across the 2026 World Cup" },
  { value: "100% free", label: "no fees, ever" },
  { value: "Real-time", label: "goals the second they happen" },
  { value: "Every event verified", label: "not just claimed" },
  { value: "Built on Solana", label: "for real, checkable proof" },
  { value: "One tap", label: "to unlock the live feed" },
];

function StatsRow() {
  return (
    <div className="flex shrink-0 items-center gap-3 pr-3">
      {STATS.map((s, i) => (
        <span key={i} className="flex items-center gap-3 whitespace-nowrap">
          <span className="font-mono text-xs text-text-dim">
            <span className="font-semibold text-accent">{s.value}</span>{" "}
            {s.label}
          </span>
          <span className="text-border">·</span>
        </span>
      ))}
    </div>
  );
}

export function StatsBar() {
  return (
    <div className="overflow-hidden border-y border-border bg-surface py-3">
      <div className="flex w-max animate-marquee">
        <StatsRow />
        <StatsRow />
      </div>
    </div>
  );
}