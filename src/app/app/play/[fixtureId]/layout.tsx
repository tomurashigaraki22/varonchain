"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { MatchHeader } from "@/components/app/MatchHeader";
import { EventFeed } from "@/components/app/EventFeed";
import { LineupPanel } from "@/components/app/LineupPanel";
import { OddsSparkline } from "@/components/app/OddsSparkline";
import { GoalCelebration, type CelebrationPayload } from "@/components/app/GoalCelebration";
import { FloatingScoreBadge } from "@/components/app/FloatingScoreBadge";
import { usePlayerLineups } from "@/lib/txline/lineups";
import { extractPhase, extractScore } from "@/lib/txline/scoreSoccer";
import { PlayContext } from "@/lib/playContext";

// Loaded client-only, same as AppNavbar does — it detects installed wallet
// extensions client-side, so SSR-ing it produces a hydration mismatch.
const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

type RawScoreEvent = Record<string, unknown>;

const TABS = [
  { key: "overview", label: "Overview", href: (id: string) => `/app/play/${id}` },
  { key: "arena", label: "Arena", href: (id: string) => `/app/play/${id}/arena` },
  { key: "leaderboard", label: "Leaderboard", href: (id: string) => `/app/play/${id}/leaderboard` },
] as const;

/**
 * Full-page match tracker — replaces the old MatchModal. Overview/Arena/
 * Leaderboard are real routes (not an in-component tab switcher) sharing
 * this layout, so the URL is bookmarkable/shareable per tab. The live match
 * stream (EventFeed) is mounted here ONCE and stays alive across all three
 * tabs — it's visually hidden (not unmounted) outside Overview so its SSE
 * connection, poll fallback, and per-event verify state survive tab
 * switches instead of resetting every navigation.
 *
 * Scroll behaviour (deliberate, not accidental): the page scrolls normally
 * at the top so the header can scroll away and the tab nav — `position:
 * sticky` — pins itself to the top of the viewport once you reach it. Below
 * the pinned tabs, the pitch/events panels sit in a box sized to exactly
 * fill the rest of the viewport (measured from the tab nav's real height),
 * each with its OWN independent scrollbar — so scrolling the event feed
 * never drags the pitch out of view, and vice versa, the way a single
 * shared page scroll would.
 */
export default function PlayLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ fixtureId: string }>();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const fixtureId = Number(params.fixtureId);
  const fixtureLabel = searchParams.get("label") ?? "Match";
  const matchStartTime = Number(searchParams.get("start") ?? 0) || undefined;

  const [matchEvents, setMatchEvents] = useState<RawScoreEvent[]>([]);
  const [latestKeyAction, setLatestKeyAction] = useState<string | undefined>();
  const [matchEnded, setMatchEnded] = useState(false);
  const [celebration, setCelebration] = useState<CelebrationPayload | null>(null);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [tabNavHeight, setTabNavHeight] = useState(45);

  const headerRef = useRef<HTMLDivElement>(null);
  const tabNavRef = useRef<HTMLDivElement>(null);

  const { home: homeLineup, away: awayLineup, announced: lineupsAnnounced } = usePlayerLineups(
    fixtureId,
    fixtureLabel,
    matchEvents
  );

  const handleEventsChange = useCallback((events: RawScoreEvent[]) => {
    setMatchEvents((prev) => {
      const keyOf = (e: RawScoreEvent) => `${e.FixtureId ?? e.fixtureId}-${e.Seq ?? e.seq ?? e.Id ?? e.id}`;
      const seen = new Set(prev.map(keyOf));
      const additions = events.filter((e) => {
        const key = keyOf(e);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return additions.length > 0 ? [...prev, ...additions] : prev;
    });
  }, []);

  // Floating score badge appears once the real header has scrolled away.
  // Plain scroll-position check rather than IntersectionObserver — simpler
  // to reason about correctly alongside a sticky sibling (the tab nav)
  // right below the observed element.
  useEffect(() => {
    const check = () => {
      const el = headerRef.current;
      if (!el) return;
      setHeaderVisible(el.getBoundingClientRect().bottom > 0);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  // Measure the tab nav's real rendered height so the dual-scroll panel
  // below it can be sized to exactly fill "the rest of the viewport"
  // instead of guessing a fixed pixel value.
  useEffect(() => {
    const el = tabNavRef.current;
    if (!el) return;
    const update = () => setTabNavHeight(el.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isOverview = pathname === `/app/play/${params.fixtureId}`;

  const contextValue = useMemo(
    () => ({
      fixtureId,
      fixtureLabel,
      matchStartTime,
      matchEvents,
      latestKeyAction,
      matchEnded,
      homeLineup,
      awayLineup,
    }),
    [fixtureId, fixtureLabel, matchStartTime, matchEvents, latestKeyAction, matchEnded, homeLineup, awayLineup]
  );

  if (!Number.isFinite(fixtureId)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-6 text-center">
        <p className="text-sm text-text-dim">Invalid fixture. Go back and pick a match to track.</p>
      </div>
    );
  }

  const phase = extractPhase(matchEvents);
  const score = extractScore(matchEvents);
  const parts = fixtureLabel.split(" vs ");

  return (
    <PlayContext.Provider value={contextValue}>
      <div className="flex min-h-screen flex-col bg-bg">
        {/* Slim bar — the full AppNavbar's logo/nav was exactly the kind of
            fixed chrome eating vertical space this page needs for the
            pitch; this scrolls away with the rest of the header. */}
        <div className="shrink-0 border-b border-border bg-surface-2/40">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
            <button
              onClick={() => router.push("/app")}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-text-dim transition-colors hover:border-border-hover hover:text-text"
            >
              ← All matches
            </button>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-3 py-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-warning">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                Devnet
              </span>
              <WalletMultiButton
                style={{
                  height: "26px",
                  fontSize: "10px",
                  fontFamily: "monospace",
                  fontWeight: "bold",
                  borderRadius: "9999px",
                  padding: "0 12px",
                  backgroundColor: "var(--accent)",
                  color: "var(--bg)",
                }}
              />
            </div>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
          <div ref={headerRef} className="shrink-0">
            <MatchHeader label={fixtureLabel} fixtureId={fixtureId} events={matchEvents} />
          </div>

          {/* Tab nav — sticky: scrolls with the page until it hits the top,
              then pins there. */}
          <div ref={tabNavRef} className="sticky top-0 z-30 flex shrink-0 border-b border-border bg-bg">
            {TABS.map((t) => {
              const active = t.key === "overview" ? isOverview : pathname === t.href(params.fixtureId);
              return (
                <Link
                  key={t.key}
                  href={t.href(params.fixtureId) + (searchParams.toString() ? `?${searchParams.toString()}` : "")}
                  className={`flex-1 py-3 text-center font-mono text-[11px] uppercase tracking-widest transition-colors ${
                    active
                      ? "border-b-2 border-accent text-accent"
                      : "text-text-dimmer hover:text-text-dim"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>

          {/* Below the pinned tabs: on lg+ this is a HARD-bounded box
              (height, not min-height, plus overflow-hidden) sized to
              exactly fill the rest of the viewport — that's what forces
              the pitch/events columns' own overflow-y-auto to actually
              engage instead of just growing the page. Below lg it's only a
              min-height (room for the sticky-tab scroll effect to read as
              intentional) — mobile keeps one natural continuous scroll,
              since a split-scroll region doesn't make sense on a small
              screen. */}
          <div
            className="min-h-[var(--below-tabs)] lg:h-[var(--below-tabs)] lg:overflow-hidden"
            style={{ ["--below-tabs" as string]: `calc(100vh - ${tabNavHeight}px)` }}
          >
            {/* Overview slot — always mounted (never torn down) so
                EventFeed's stream/verify state survives switching to
                Arena/Leaderboard; just visually hidden otherwise. */}
            <div className={`${isOverview ? "flex" : "hidden"} h-full flex-col lg:min-h-0`}>
              <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[1.15fr_1fr] lg:divide-x lg:divide-border">
                <div className="lg:min-h-0 lg:overflow-y-auto scrollbar-hide">
                  <LineupPanel home={homeLineup} away={awayLineup} announced={lineupsAnnounced} />
                  <div className="hidden lg:block">
                    <OddsSparkline fixtureId={fixtureId} />
                  </div>
                </div>
                <div className="lg:min-h-0 lg:overflow-y-auto scrollbar-hide">
                  <div className="lg:hidden">
                    <OddsSparkline fixtureId={fixtureId} />
                  </div>
                  <EventFeed
                    fixtureId={fixtureId}
                    fixtureLabel={fixtureLabel}
                    matchStartTime={matchStartTime}
                    players={[...homeLineup, ...awayLineup]}
                    onEventsChange={handleEventsChange}
                    onLatestKeyAction={setLatestKeyAction}
                    onMatchEnd={() => setMatchEnded(true)}
                    onGoal={setCelebration}
                  />
                </div>
              </div>
            </div>

            {/* Arena / Leaderboard content */}
            <div className={`${isOverview ? "hidden" : "block"} h-full lg:min-h-0 lg:overflow-y-auto scrollbar-hide`}>
              {children}
            </div>
          </div>
        </div>
      </div>

      {!headerVisible && (
        <FloatingScoreBadge
          home={parts[0] ?? "Home"}
          away={parts[1] ?? "Away"}
          homeScore={score.home}
          awayScore={score.away}
          live={phase?.live ?? false}
        />
      )}

      {celebration && (
        <GoalCelebration payload={celebration} onDone={() => setCelebration(null)} />
      )}
    </PlayContext.Provider>
  );
}
