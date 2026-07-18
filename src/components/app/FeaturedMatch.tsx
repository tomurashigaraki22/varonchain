"use client";

import { fixtureId, fixtureLabel, type Fixture } from "@/lib/hooks/useFixtures";
import { useNow } from "@/lib/hooks/useNow";

const LIKELY_LIVE_WINDOW = 3 * 60 * 60 * 1000;

function isSameLocalDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function formatFullDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function countdownLabel(ms: number, now: number): string {
  const diff = ms - now;
  if (diff <= 0) return "";
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(hours / 24);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `Kicks off in ${days}d ${hours % 24}h`;
  if (hours > 0) return `Kicks off in ${hours}h ${mins}m`;
  return `Kicks off in ${mins}m`;
}

type Featured = {
  kind: "today" | "upcoming";
  fx: Fixture;
  id: number;
  startTime: number;
} | null;

function pickFeatured(fixtures: Fixture[], now: number): Featured {
  const withTimes = fixtures
    .map((fx, i) => ({ fx, id: fixtureId(fx, i), startTime: Number(fx.StartTime ?? 0) }))
    .filter((f) => f.startTime > 0);

  const todayMatches = withTimes.filter((f) => isSameLocalDay(f.startTime, now));
  if (todayMatches.length > 0) {
    // Prefer one that's live-ish right now, then the next kickoff today,
    // then fall back to the most recent one that already happened today.
    const live = todayMatches.find(
      (f) => now - f.startTime >= 0 && now - f.startTime < LIKELY_LIVE_WINDOW
    );
    if (live) return { kind: "today", ...live };
    const next = todayMatches
      .filter((f) => f.startTime > now)
      .sort((a, b) => a.startTime - b.startTime)[0];
    if (next) return { kind: "today", ...next };
    const mostRecent = todayMatches.sort((a, b) => b.startTime - a.startTime)[0];
    return { kind: "today", ...mostRecent };
  }

  const upcoming = withTimes.filter((f) => f.startTime > now).sort((a, b) => a.startTime - b.startTime)[0];
  return upcoming ? { kind: "upcoming", ...upcoming } : null;
}

export function FeaturedMatch({
  fixtures,
  onSelect,
}: {
  fixtures: Fixture[] | null;
  onSelect: (fixture: { id: number; label: string; raw: Fixture }) => void;
}) {
  const now = useNow();

  if (!fixtures || fixtures.length === 0) return null;

  const featured = pickFeatured(fixtures, now);
  if (!featured) return null;

  const { home, away } = fixtureLabel(featured.fx);
  const isLiveNow = now - featured.startTime >= 0 && now - featured.startTime < LIKELY_LIVE_WINDOW;
  const countdown = featured.startTime > now ? countdownLabel(featured.startTime, now) : "";

  return (
    <button
      type="button"
      onClick={() =>
        onSelect({ id: featured.id, label: `${home} vs ${away}`, raw: featured.fx })
      }
      className="group relative w-full overflow-hidden rounded-2xl border border-accent/25 bg-dot-grid p-5 text-left transition-all hover:border-accent/40 sm:p-6"
    >
      <div className="pointer-events-none absolute inset-0 bg-hero-glow opacity-60" aria-hidden />

      <div className="relative flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-dim px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-accent">
          {isLiveNow && <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" />}
          {featured.kind === "today" ? "Match of the day" : "Favourite upcoming match"}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-dimmer transition-colors group-hover:text-accent">
          {isLiveNow ? "Watch live →" : "Track →"}
        </span>
      </div>

      <p className="relative mt-4 font-display text-xl font-bold leading-tight text-text sm:text-2xl">
        {home} <span className="font-normal text-text-dimmer">vs</span> {away}
      </p>

      <div className="relative mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-text-dim">
        <span>{formatFullDate(featured.startTime)}</span>
        <span className="text-border">·</span>
        <span>{formatTime(featured.startTime)}</span>
        {countdown && (
          <>
            <span className="text-border">·</span>
            <span className="text-accent">{countdown}</span>
          </>
        )}
        {isLiveNow && (
          <>
            <span className="text-border">·</span>
            <span className="text-accent">In progress</span>
          </>
        )}
      </div>
    </button>
  );
}
