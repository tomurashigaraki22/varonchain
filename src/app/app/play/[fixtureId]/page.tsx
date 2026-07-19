// Overview's actual content (lineups + live event feed) is rendered by the
// parent layout, not here — EventFeed has to stay mounted across tab
// switches (see layout.tsx) so its live stream/verify state doesn't reset
// every time you move to Arena or Leaderboard and back.
export default function PlayOverviewPage() {
  return null;
}
