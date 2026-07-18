"use client";

import { useEffect, useState } from "react";

// Shape per the TxLINE API reference for /api/fixtures/snapshot — it carries
// no status or score fields. Live/finished status and scores must be read
// per-fixture from /api/scores/snapshot/{fixtureId} instead (see
// src/lib/txline/scoreSoccer.ts, used by FixtureList and MatchHeader).
export type Fixture = {
  FixtureId?: number;
  Id?: number;
  Participant1?: string;
  Participant2?: string;
  HomeTeam?: string;
  AwayTeam?: string;
  Home?: string;
  Away?: string;
  StartTime?: number | string;
  StartDate?: string;
  [key: string]: unknown;
};

const WORLD_CUP_COMPETITION_ID = 72;

function todayEpochDay(): number {
  return Math.floor(Date.now() / 86400000);
}

// Cover 30 days back so all tournament matches are visible
function startWindowEpochDay(): number {
  return Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 86400000);
}

export function fixtureLabel(fx: Fixture): { home: string; away: string } {
  return {
    home: String(fx.Participant1 ?? fx.HomeTeam ?? fx.Home ?? "?"),
    away: String(fx.Participant2 ?? fx.AwayTeam ?? fx.Away ?? "?"),
  };
}

export function fixtureId(fx: Fixture, fallbackIndex: number): number {
  return Number(fx.FixtureId ?? fx.Id ?? fallbackIndex);
}

export function useFixtures(active: boolean) {
  const [fixtures, setFixtures] = useState<Fixture[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    Promise.resolve().then(() => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
    });

    const startEpochDay = startWindowEpochDay();
    const endEpochDay = todayEpochDay() + 14; // also show upcoming 2 weeks
    fetch(
      `/api/txline/proxy/fixtures/snapshot?competitionId=${WORLD_CUP_COMPETITION_ID}&startEpochDay=${startEpochDay}&endEpochDay=${endEpochDay}`
    )
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Failed to load fixtures");
        return data;
      })
      .then((data) => {
        if (!cancelled) {
          const raw: Fixture[] = Array.isArray(data) ? data : (data?.fixtures ?? []);
          const now = Date.now();

          // The fixtures/snapshot endpoint carries no live/finished status field
          // (confirmed against the TxLINE API reference — it returns only
          // Ts/StartTime/Competition/Participant fields), so status here is
          // approximated purely from StartTime vs now. Real per-fixture
          // live/finished state and scores come from scores/snapshot instead
          // (see FixtureList / MatchHeader).
          const LIKELY_LIVE_WINDOW = 3 * 60 * 60 * 1000; // regulation + ET + stoppage buffer
          const sorted = [...raw].sort((a, b) => {
            const tsA = Number(a.StartTime ?? 0);
            const tsB = Number(b.StartTime ?? 0);

            const upcomingA = tsA > now;
            const upcomingB = tsB > now;

            // 1st priority: upcoming (future kick-offs), soonest first
            if (upcomingA && !upcomingB) return -1;
            if (upcomingB && !upcomingA) return 1;
            if (upcomingA && upcomingB) return tsA - tsB;

            // 2nd priority: likely still in progress (kicked off recently)
            const liveA = now - tsA < LIKELY_LIVE_WINDOW;
            const liveB = now - tsB < LIKELY_LIVE_WINDOW;
            if (liveA && !liveB) return -1;
            if (liveB && !liveA) return 1;

            // 3rd priority: finished — most recent kickoff first
            return tsB - tsA;
          });
          setFixtures(sorted);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load fixtures");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [active]);

  return { fixtures, error, loading };
}
