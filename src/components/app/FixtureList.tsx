"use client";

import { useEffect, useRef, useState } from "react";
import { fixtureId, fixtureLabel, type Fixture } from "@/lib/hooks/useFixtures";
import { extractPhase, extractScore, type MatchPhase, type SoccerScore } from "@/lib/txline/scoreSoccer";

type OddsEntry = {
  PriceNames?: string[];
  Pct?: string[];
  MarketPeriod?: string | number;
  SuperOddsType?: string | number;
  [key: string]: unknown;
};

type MatchOdds = {
  home: number;
  draw?: number;
  away: number;
  label: string;
} | null;

function formatKickoff(startTime: unknown): string {
  const ms = typeof startTime === "number" ? startTime : Number(startTime);
  if (!ms || Number.isNaN(ms)) return "";
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseMatchOdds(data: unknown): MatchOdds {
  if (!Array.isArray(data) || data.length === 0) return null;

  for (const entry of data as OddsEntry[]) {
    // Support both PriceNames/Pct and Names/Probabilities field shapes
    const names: unknown = entry.PriceNames ?? entry.Names ?? entry.priceNames;
    const pct: unknown = entry.Pct ?? entry.Probabilities ?? entry.pct ?? entry.probabilities;

    if (!Array.isArray(names) || !Array.isArray(pct)) continue;
    if (names.length < 2 || pct.length < 2) continue;

    // Parse percentages — skip "NA" or null, require at least 2 valid numbers
    const nums = (pct as unknown[]).map((p) => {
      if (p === null || p === undefined || p === "NA" || p === "N/A") return NaN;
      const n = typeof p === "number" ? p : parseFloat(String(p));
      return isFinite(n) ? n : NaN;
    });

    const valid = nums.filter((n) => !isNaN(n));
    if (valid.length < 2) continue;

    // Replace NaN slots with 0 so the bar still renders
    const safe = nums.map((n) => (isNaN(n) ? 0 : n));

    if (names.length >= 3 && safe.length >= 3) {
      return {
        home: safe[0],
        draw: safe[1],
        away: safe[2],
        label: String(entry.MarketPeriod ?? entry.SuperOddsType ?? entry.marketPeriod ?? "FT"),
      };
    }
    return {
      home: safe[0],
      away: safe[1],
      label: String(entry.MarketPeriod ?? entry.SuperOddsType ?? entry.marketPeriod ?? "FT"),
    };
  }
  return null;
}

function OddsBar({ odds }: { odds: MatchOdds }) {
  if (!odds) return null;
  const segments = odds.draw != null
    ? [
        { pct: odds.home, color: "bg-accent/80", label: "H" },
        { pct: odds.draw, color: "bg-border", label: "D" },
        { pct: odds.away, color: "bg-text-dimmer", label: "A" },
      ]
    : [
        { pct: odds.home, color: "bg-accent/80", label: "H" },
        { pct: odds.away, color: "bg-text-dimmer", label: "A" },
      ];

  return (
    <div className="mt-3">
      {/* Stacked bar */}
      <div className="flex h-1.5 w-full overflow-hidden rounded-full">
        {segments.map((s) => (
          <div
            key={s.label}
            className={`${s.color} h-full transition-all`}
            style={{ width: `${s.pct}%` }}
          />
        ))}
      </div>
      {/* Labels */}
      <div className="mt-1.5 flex justify-between">
        {segments.map((s) => (
          <span key={s.label} className="font-mono text-[10px] text-text-dimmer">
            <span className="text-text-dim">{s.label}</span>{" "}
            {s.pct.toFixed(0)}%
          </span>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ phase }: { phase: MatchPhase }) {
  // Scheduled (no phase yet) — kickoff time is shown as its own line now,
  // so there's nothing else to show here.
  if (!phase) return null;
  if (!phase.live) {
    return (
      <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-text-dimmer">
        FT
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-dim px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-accent">
      <span className="h-1 w-1 animate-pulse-dot rounded-full bg-accent" />
      {phase.label === "Half time" ? "HT" : "Live"}
    </span>
  );
}

function FixtureCard({
  fx,
  index,
  isSelected,
  isMatchOfTheDay = false,
  onSelect,
}: {
  fx: Fixture;
  index: number;
  isSelected: boolean;
  isMatchOfTheDay?: boolean;
  onSelect: () => void;
}) {
  const id = fixtureId(fx, index);
  const { home, away } = fixtureLabel(fx);
  const [odds, setOdds] = useState<MatchOdds>(null);
  const [oddsLoading, setOddsLoading] = useState(false);
  const [phase, setPhase] = useState<MatchPhase>(null);
  const [score, setScore] = useState<SoccerScore>({});
  // Read inside the odds-retry closure without restarting that effect —
  // phase resolves asynchronously in a separate effect below.
  const phaseRef = useRef<MatchPhase>(null);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Retries several times before settling on "not posted" — a single
  // fire-and-forget fetch was indistinguishable from a real empty market
  // whenever it hit a transient error or the market simply wasn't posted
  // yet at the moment this card mounted. Every visible card fires this on
  // mount, so the first attempt is staggered by card index to avoid a
  // request burst hitting rate limits inconsistently ("sometimes shows,
  // sometimes doesn't" was this, not a real per-fixture data gap). Stops
  // retrying immediately once the fixture is confirmed finished — a closed
  // market never comes back, no point burning more requests on it.
  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    const MAX_ATTEMPTS = 6;
    const RETRY_DELAY_MS = 3000;
    const STAGGER_MS = Math.min(index, 12) * 250;

    Promise.resolve().then(() => {
      if (!cancelled) setOddsLoading(true);
    });

    const load = () => {
      if (phaseRef.current?.label === "Full time") {
        if (!cancelled) setOddsLoading(false);
        return;
      }
      fetch(`/api/txline/odds?fixtureId=${id}`)
        .then((r) => r.json())
        .then((data: unknown) => {
          if (cancelled) return;
          const parsed = parseMatchOdds(data);
          if (parsed) {
            setOdds(parsed);
            setOddsLoading(false);
          } else if (attempt < MAX_ATTEMPTS - 1) {
            attempt += 1;
            setTimeout(load, RETRY_DELAY_MS);
          } else {
            setOddsLoading(false);
          }
        })
        .catch(() => {
          if (cancelled) return;
          if (attempt < MAX_ATTEMPTS - 1) {
            attempt += 1;
            setTimeout(load, RETRY_DELAY_MS);
          } else {
            setOddsLoading(false);
          }
        });
    };
    const kickoff = setTimeout(load, STAGGER_MS);

    return () => {
      cancelled = true;
      clearTimeout(kickoff);
    };
  }, [id, index]);

  // Real live/finished status + running score — the fixtures/snapshot endpoint
  // carries neither, so this reads each card's own scores/snapshot directly.
  useEffect(() => {
    let cancelled = false;

    const fetchScore = () => {
      fetch(`/api/txline/proxy/scores/snapshot/${id}`)
        .then((r) => r.json())
        .then((data: unknown) => {
          if (cancelled) return;
          const items = (Array.isArray(data) ? data : [data]) as Record<string, unknown>[];
          setPhase(extractPhase(items));
          const s = extractScore(items);
          if (s.home != null || s.away != null) setScore(s);
        })
        .catch(() => {});
    };

    fetchScore();
    const interval = setInterval(fetchScore, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id]);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group w-full rounded-xl border text-left transition-all duration-200 ${
        isMatchOfTheDay ? "p-6" : "p-4"
      } ${
        isSelected
          ? "border-accent/40 bg-accent-dim shadow-[0_0_20px_rgba(129,140,248,0.12)]"
          : isMatchOfTheDay
          ? "border-accent/30 bg-surface shadow-[0_4px_20px_rgba(129,140,248,0.08)] hover:border-accent/60"
          : "glass border-border hover:border-border-hover hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`${isMatchOfTheDay ? "text-xl" : "text-sm"} font-semibold leading-tight ${isSelected || isMatchOfTheDay ? "text-accent" : "text-text"}`}>
            {home}
            <span className={`mx-2 font-normal ${isSelected || isMatchOfTheDay ? "text-accent/60" : "text-text-dimmer"}`}>vs</span>
            {away}
          </p>
          {/* Kickoff time — always shown regardless of live/FT status,
              not just while the fixture is still scheduled. */}
          {fx.StartTime != null && (
            <p className="mt-0.5 font-mono text-[10px] text-text-dimmer">
              Kickoff {formatKickoff(fx.StartTime)}
            </p>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {/* Score for live and finished matches, from the fixture's own scores/snapshot */}
          {(score.home != null || score.away != null) && (
            <span className={`font-display ${isMatchOfTheDay ? "text-2xl" : "text-base"} font-bold tabular-nums text-text-dim`}>
              {score.home ?? 0}
              <span className="mx-1 text-text-dimmer">:</span>
              {score.away ?? 0}
            </span>
          )}
          <StatusPill phase={phase} />
        </div>
      </div>

      {oddsLoading && (
        <div className="mt-4 h-2 w-full animate-pulse rounded-full bg-surface-2" />
      )}
      {!oddsLoading && odds && (
        <div className={isMatchOfTheDay ? "mt-4" : ""}>
          <OddsBar odds={odds} />
        </div>
      )}
      {!oddsLoading && !odds && (
        <p className="mt-3 font-mono text-[10px] text-text-dimmer">
          {phase?.label === "Full time" ? "Odds closed" : "Odds not posted yet"}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <span
          className={`font-mono text-[10px] uppercase tracking-widest ${
            isSelected ? "text-accent/70" : "text-text-dimmer group-hover:text-text-dim"
          }`}
        >
          #{id}
        </span>
        <span
          className={`font-mono text-[10px] uppercase tracking-widest transition-colors ${
            isSelected || isMatchOfTheDay ? "text-accent" : "text-text-dimmer group-hover:text-accent"
          }`}
        >
          {isSelected ? "● Tracking" : "Track Match →"}
        </span>
      </div>
    </button>
  );
}

export function FixtureList({
  active,
  fixtures,
  loading,
  error,
  selectedFixtureId,
  onSelect,
}: {
  active: boolean;
  fixtures: Fixture[] | null;
  loading: boolean;
  error: string | null;
  selectedFixtureId?: number;
  onSelect?: (fixture: { id: number; label: string; raw: Fixture }) => void;
}) {
  const [manualFixtureId, setManualFixtureId] = useState("");
  const [showAll, setShowAll] = useState(false);

  if (!active) return null;

  const matchOfTheDay = fixtures && fixtures.length > 0 ? fixtures[0] : null;
  const displayedFixtures = fixtures
    ? showAll
      ? fixtures.slice(1)
      : fixtures.slice(1, 10)
    : null;

  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        <p className="font-mono text-xs uppercase tracking-widest text-text-dim">
          World Cup Fixtures
        </p>
        {loading && (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {!loading && fixtures && fixtures.length === 0 && (
        <div className="mt-4 rounded-xl border border-border bg-surface px-5 py-8 text-center">
          <p className="text-sm text-text-dim">
            No fixtures found for this window — check back closer to kickoff.
          </p>
        </div>
      )}

      {matchOfTheDay && (
        <div className="mt-6 mb-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent">
              ★ Match of the Day
            </span>
          </div>
          <FixtureCard
            fx={matchOfTheDay}
            index={0}
            isSelected={selectedFixtureId === fixtureId(matchOfTheDay, 0)}
            isMatchOfTheDay={true}
            onSelect={() => {
              const id = fixtureId(matchOfTheDay, 0);
              const { home, away } = fixtureLabel(matchOfTheDay);
              onSelect?.({ id, label: `${home} vs ${away}`, raw: matchOfTheDay });
            }}
          />
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {displayedFixtures?.map((fx, i) => {
          const indexOffset = i + 1; // Since we sliced off the first item
          const id = fixtureId(fx, indexOffset);
          const { home, away } = fixtureLabel(fx);
          return (
            <FixtureCard
              key={id}
              fx={fx}
              index={indexOffset}
              isSelected={selectedFixtureId === id}
              onSelect={() => onSelect?.({ id, label: `${home} vs ${away}`, raw: fx })}
            />
          );
        })}
      </div>

      {/* Show more button */}
      {fixtures && fixtures.length > 10 && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="rounded-full border border-border px-5 py-2 font-mono text-[11px] uppercase tracking-widest text-text-dim transition-colors hover:border-border-hover hover:text-text"
          >
            {showAll
              ? `Show less`
              : `Show ${fixtures.length - 10} more fixtures`}
          </button>
        </div>
      )}

      {/* Manual fixture ID input */}
      <div className="mt-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-text-dimmer">
          Or track by fixture ID
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const id = Number(manualFixtureId);
            if (!Number.isNaN(id) && id > 0) {
              onSelect?.({ id, label: `Fixture #${id}`, raw: {} as Fixture });
            }
          }}
          className="mt-2 flex gap-2"
        >
          <input
            value={manualFixtureId}
            onChange={(e) => setManualFixtureId(e.target.value)}
            placeholder="e.g. 18237038"
            inputMode="numeric"
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm text-text placeholder:text-text-dimmer focus:border-border-active focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-5 py-2 text-sm font-extrabold text-bg transition-shadow glow-accent-hover hover:opacity-95"
          >
            Track
          </button>
        </form>
      </div>
    </div>
  );
}
