"use client";

import { useEffect, useState } from "react";

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
  GameState?: number;
  // Score fields that may be present on the fixture object itself
  Participant1Score?: number | string;
  Participant2Score?: number | string;
  HomeScore?: number | string;
  AwayScore?: number | string;
  Score1?: number | string;
  Score2?: number | string;
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

          const sorted = [...raw].sort((a, b) => {
            const tsA = Number(a.StartTime ?? 0);
            const tsB = Number(b.StartTime ?? 0);
            const gsA = Number(a.GameState ?? 1);
            const gsB = Number(b.GameState ?? 1);

            // GameState=1 = scheduled/not started; 5/10/13 = finished
            const finishedStates = new Set([5, 10, 13]);
            const doneA = finishedStates.has(gsA);
            const doneB = finishedStates.has(gsB);
            // "live" = not scheduled (gs≠1) and not finished
            const liveA = gsA !== 1 && !doneA;
            const liveB = gsB !== 1 && !doneB;
            // "upcoming" = scheduled AND start time is in the future
            const upcomingA = gsA === 1 && tsA > now;
            const upcomingB = gsB === 1 && tsB > now;

            // 1st priority: upcoming (future kick-offs), soonest first
            if (upcomingA && !upcomingB) return -1;
            if (upcomingB && !upcomingA) return 1;
            if (upcomingA && upcomingB) return tsA - tsB;

            // 2nd priority: live matches
            if (liveA && !liveB) return -1;
            if (liveB && !liveA) return 1;

            // 3rd priority: finished matches — most recent first
            if (doneA && doneB) return tsB - tsA;

            // Scheduled in the past (odd state) — treat like finished
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
