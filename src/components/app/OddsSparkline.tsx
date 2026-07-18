"use client";

import { useEffect, useRef, useState } from "react";

type RawOddsEvent = Record<string, unknown>;

type Series = {
  name: string;
  color: string;
  points: number[];
};

const MAX_POINTS = 40;
const LINE_COLORS = ["var(--accent)", "rgba(255,255,255,0.3)", "var(--warning)"];

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

function parsePct(pct: unknown): number[] {
  if (!Array.isArray(pct)) return [];
  return pct
    .map((p) => (typeof p === "string" && p !== "NA" ? Number(p) : undefined))
    .filter((n): n is number => n != null && !Number.isNaN(n));
}

function sparkPath(points: number[], width: number, height: number, min: number, max: number) {
  if (points.length < 2) return "";
  const range = Math.max(max - min, 1);
  const step = width / (MAX_POINTS - 1);
  const offset = MAX_POINTS - points.length;
  return points
    .map((p, i) => {
      const x = (offset + i) * step;
      const y = height - ((p - min) / range) * (height * 0.85) - height * 0.075;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function OddsSparkline({ fixtureId }: { fixtureId: number }) {
  const [series, setSeries] = useState<Series[]>([]);
  const [connected, setConnected] = useState(false);
  const [marketLabel, setMarketLabel] = useState<string | null>(null);
  const lockedNamesRef = useRef<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    lockedNamesRef.current = null;

    Promise.resolve().then(() => {
      if (!cancelled) {
        setSeries([]);
        setMarketLabel(null);
      }
    });

    const es = new EventSource("/api/txline/stream/odds");
    es.onopen = () => { if (!cancelled) setConnected(true); };
    es.onerror = () => { if (!cancelled) setConnected(false); };

    es.onmessage = (evt) => {
      let data: RawOddsEvent;
      try { data = JSON.parse(evt.data); } catch { return; }

      const evtFixtureId = asNumber(data.FixtureId ?? data.fixtureId);
      if (evtFixtureId !== fixtureId) return;

      const priceNames = (data.PriceNames as string[] | undefined) ?? [];
      const pct = parsePct(data.Pct);
      if (priceNames.length === 0 || pct.length === 0) return;

      if (!lockedNamesRef.current) {
        lockedNamesRef.current = priceNames.slice(0, 3);
        setMarketLabel(String(data.MarketPeriod ?? data.SuperOddsType ?? "Match odds"));
      }
      const names = lockedNamesRef.current;
      if (names.some((n, i) => n !== priceNames[i])) return;

      setSeries((prev) => {
        const next: Series[] =
          prev.length > 0
            ? prev
            : names.map((name, i) => ({ name, color: LINE_COLORS[i % LINE_COLORS.length], points: [] }));
        return next.map((s, i) => ({ ...s, points: [...s.points, pct[i]].slice(-MAX_POINTS) }));
      });
    };

    return () => { cancelled = true; es.close(); };
  }, [fixtureId]);

  const allPoints = series.flatMap((s) => s.points);
  const min = allPoints.length ? Math.min(...allPoints) : 0;
  const max = allPoints.length ? Math.max(...allPoints) : 100;
  const W = 100;
  const H = 40;

  // Latest values for the probability bar
  const latest = series.map((s) => s.points[s.points.length - 1] ?? 0);
  const total = latest.reduce((a, b) => a + b, 0);

  return (
    <div className="border-b border-border px-4 py-4 sm:px-6 sm:py-5">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-dim">
            Crowd pulse
          </span>
          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-text-dimmer">
            StablePrice
          </span>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-text-dimmer">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              connected ? "animate-pulse-dot bg-accent" : "bg-text-dimmer"
            }`}
          />
          {marketLabel ?? "Awaiting stream…"}
        </span>
      </div>

      {series.length === 0 ? (
        /* Skeleton / waiting state */
        <div className="mt-3 flex items-center gap-2">
          <div className="h-8 flex-1 animate-pulse rounded-md bg-surface-2" />
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {/* Sparklines */}
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="h-10 w-full"
            aria-hidden
          >
            {/* Subtle fill under the first (home win) line */}
            {series[0] && (
              <path
                d={`${sparkPath(series[0].points, W, H, min, max)} V${H} H${
                  ((MAX_POINTS - series[0].points.length) * W) / (MAX_POINTS - 1)
                } Z`}
                fill="rgba(129,140,248,0.05)"
                stroke="none"
              />
            )}
            {series.map((s) => (
              <path
                key={s.name}
                d={sparkPath(s.points, W, H, min, max)}
                fill="none"
                stroke={s.color}
                strokeWidth={1.8}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {/* pulse dot for active series */}
            {series[0].points.length > 0 && (
              <circle
                cx={((MAX_POINTS - 1) * W) / (MAX_POINTS - 1)}
                cy={
                  H -
                  ((series[0].points[series[0].points.length - 1] - min) / (max - min || 1)) *
                    H
                }
                r={2.5}
                fill="#818cf8"
                className="animate-pulse-dot"
              />
            )}
          </svg>

          {/* Probability bar */}
          {total > 0 && (
            <div className="flex h-1 w-full overflow-hidden rounded-full">
              {series.map((s, i) => (
                <div
                  key={s.name}
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${(latest[i] / total) * 100}%`,
                    background: s.color,
                    opacity: i === 0 ? 1 : 0.45,
                  }}
                />
              ))}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 pt-0.5">
            {series.map((s, i) => (
              <span key={s.name} className="flex items-center gap-1.5 font-mono text-[10px]">
                <span
                  className="h-1.5 w-3 rounded-full"
                  style={{ background: s.color, opacity: i === 0 ? 1 : 0.6 }}
                />
                <span className="text-text-dim">{s.name}</span>
                <span className="text-text">
                  {latest[i]?.toFixed(1)}%
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
