"use client";

import { createContext, useContext } from "react";
import type { PlayerState } from "@/lib/txline/lineups";

type RawScoreEvent = Record<string, unknown>;

export type PlayContextValue = {
  fixtureId: number;
  fixtureLabel: string;
  matchStartTime?: number;
  matchEvents: RawScoreEvent[];
  latestKeyAction?: string;
  matchEnded: boolean;
  homeLineup: PlayerState[];
  awayLineup: PlayerState[];
};

export const PlayContext = createContext<PlayContextValue | null>(null);

/**
 * The live match stream (EventFeed) is mounted once at the /play/[fixtureId]
 * layout level so it keeps streaming/verifying across Overview/Arena/
 * Leaderboard tab switches instead of tearing down and reconnecting on every
 * navigation. This context is how the sub-pages read its live data
 * (latestKeyAction, matchEvents, lineups) without owning the stream
 * themselves.
 */
export function usePlayContext(): PlayContextValue {
  const ctx = useContext(PlayContext);
  if (!ctx) throw new Error("usePlayContext must be used within the /play/[fixtureId] layout");
  return ctx;
}
