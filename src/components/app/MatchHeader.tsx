"use client";

import { useEffect, useState } from "react";
import { extractScore, extractPhase, type SoccerScore } from "@/lib/txline/scoreSoccer";

type RawScoreEvent = Record<string, unknown>;

export function MatchHeader({
  label,
  fixtureId,
  events,
}: {
  label: string;
  fixtureId?: number;
  events: RawScoreEvent[];
}) {
  const parts = label.split(" vs ");
  const home = parts[0] ?? "Home";
  const away = parts[1] ?? "Away";

  // Score from live events (goal counts from ScoreSoccer.ParticipantN)
  const eventScore = extractScore(events);

  // Snapshot fallback — same extraction applied to the scores/snapshot response
  const [snapshotScore, setSnapshotScore] = useState<SoccerScore | null>(null);

  useEffect(() => {
    if (!fixtureId) return;
    let cancelled = false;

    const fetchSnapshot = () => {
      fetch(`/api/txline/proxy/scores/snapshot/${fixtureId}`)
        .then((r) => r.json())
        .then((data: unknown) => {
          if (cancelled) return;
          const items = Array.isArray(data) ? data : [data];
          const extracted = extractScore(items as RawScoreEvent[]);
          // Always update — even 0:0 is valid
          if (extracted.home != null || extracted.away != null) {
            setSnapshotScore(extracted);
          }
        })
        .catch(() => {});
    };

    fetchSnapshot();

    // Poll every 30s for live matches (phase will be live if kickoff/start seen)
    const interval = setInterval(fetchSnapshot, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fixtureId]);

  // For live matches: snapshot (polling) is more reliable than event stream
  // For finished matches: event stream score (from history backfill) is authoritative
  const phase = extractPhase(events);
  const isLive = phase?.live ?? false;
  const { home: homeScore, away: awayScore } = isLive
    ? (snapshotScore ?? eventScore)
    : ((eventScore.home != null || eventScore.away != null) ? eventScore : (snapshotScore ?? {}));

  return (
    <div className="relative overflow-hidden border-b border-border bg-dot-grid">
      {/* Subtle glow behind the scoreline */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 120% at 50% 100%, rgba(205,254,0,0.05), transparent 70%)",
        }}
        aria-hidden
      />

      <div className="relative px-4 py-4 sm:px-8 sm:py-6">
        {/* Phase badge */}
        {phase ? (
          <div className="mb-4 flex justify-center">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest ${
                phase.live
                  ? "border-accent/30 bg-accent-dim text-accent"
                  : "border-border bg-surface text-text-dim"
              }`}
            >
              {phase.live && (
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" />
              )}
              {phase.label}
            </span>
          </div>
        ) : (
          <div className="mb-4 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-text-dimmer">
              Scheduled
            </span>
          </div>
        )}

        {/* Scoreline — three columns: home | score | away */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          {/* Home team */}
          <div className="flex flex-col items-end gap-1">
            <span className="text-right font-display text-sm font-bold leading-tight text-text sm:text-base lg:text-lg">
              {home}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-text-dimmer">
              Home
            </span>
          </div>

          {/* Score display */}
          <div className="flex flex-col items-center gap-1">
            <span className="font-display text-[clamp(2rem,8vw,3.5rem)] font-extrabold tabular-nums leading-none tracking-tight text-text">
              {homeScore ?? "–"}
              <span className="mx-2 text-text-dimmer">:</span>
              {awayScore ?? "–"}
            </span>
            {homeScore == null && awayScore == null && (
              <span className="font-mono text-[9px] text-text-dimmer">Awaiting data</span>
            )}
          </div>

          {/* Away team */}
          <div className="flex flex-col items-start gap-1">
            <span className="font-display text-sm font-bold leading-tight text-text sm:text-base lg:text-lg">
              {away}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-text-dimmer">
              Away
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
