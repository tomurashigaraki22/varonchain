const STATS = [
  { value: "2026 FIFA", label: "World Cup covered" },
  { value: "validateStatV2", label: "on-chain proof" },
  { value: "Solana devnet", label: "anchored" },
  { value: "Free tier", label: "no TxL required" },
  { value: "SSE stream", label: "real-time events" },
  { value: "Merkle root", label: "per match batch" },
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
