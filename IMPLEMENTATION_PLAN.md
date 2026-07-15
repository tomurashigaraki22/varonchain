# VAROnChain — Implementation Plan

**Hackathon:** Superteam Earn × TxODDS World Cup Hackathon — "Consumer and Fan Experiences" track
**Prize:** $16,000 USDT (1st $10K / 2nd $4K / 3rd $2K)
**Deadline:** Submissions close **July 19, 2026**. Winners announced July 29, 2026.
**Data source:** [TxLINE](https://txline.txodds.com/documentation/quickstart) — TxODDS' hybrid Solana + off-chain sports data API. Fixtures, odds, and scores are cryptographically anchored to Solana via Merkle roots. Free World Cup / Int'l Friendlies tier requires no TxL purchase — just a Solana wallet + devnet SOL for the one-time on-chain subscribe transaction.

## Concept

Most fan-experience entries will wrap the odds/score feed in a plain scoreboard. TxODDS' actual differentiator is *verifiability* — every score update can be proven against an on-chain Merkle root. VAROnChain makes that the product, not a footnote:

1. **Live verified ticker** — real-time goals/cards/subs feed, each event carrying a "✓ Verified on Solana" badge backed by a real `validateStatV2` on-chain proof check, not a static icon.
2. **Shareable moment cards** — the instant a goal/red card lands, auto-generate a shareable graphic (score, minute, player) stamped with a short hash + QR code linking to the on-chain proof.
3. **Crowd Pulse sentiment strip** — a live sparkline built from the StablePrice odds feed, framed as "match momentum" rather than betting odds, to stay in fan-experience territory rather than the trading-agent track.
4. **Free-to-play predictions + leaderboard** — fans guess the next event (goal/card/corner) in a live window; points tracked off-chain. Explicitly non-gambling. Stretch goal: mint a soulbound "Verified Fan" badge on-chain for top predictors.

## Stack

- **Frontend:** Next.js 16 (App Router) + Tailwind v4, TypeScript, mobile-first
- **Wallet:** `@solana/wallet-adapter-react` (Phantom), devnet
- **Chain integration:** `@coral-xyz/anchor` against TxLINE's `txoracle` program (devnet program id `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`)
- **Backend:** Next.js API routes acting as an authenticated proxy — holds the TxLINE guest JWT + activated API token in httpOnly cookies, never exposed to the client. Client only ever signs the on-chain tx and the activation message via the wallet.
- **Data:** Postgres/Supabase for leaderboard + prediction state (not yet started)

## Architecture as built so far

```
src/
  lib/txline/
    config.ts            devnet program id, mint, API hosts, free-tier constants
    idl/txoracle.devnet.json     TxLINE Anchor IDL (pulled from txodds/tx-on-chain)
    types/txoracle.devnet.ts     generated TS types for the IDL
    subscribeClient.ts   browser-side: builds+sends the on-chain `subscribe` tx,
                          signs the activation message, calls our backend to activate
    server.ts             server-side: guest JWT fetch, activation call, authenticated
                          data proxy with automatic JWT renewal on 401/403
  app/
    api/txline/
      guest-jwt/route.ts       POST -> fetches a short-lived guest JWT
      activate/route.ts        POST -> activates API token, sets httpOnly cookies
      status/route.ts          GET  -> whether this session is activated
      proxy/[...path]/route.ts GET  -> authenticated passthrough to any TxLINE
                                        snapshot/validation endpoint
    page.tsx / (landing + app UI — being reworked, see below)
  components/
    SolanaProviders.tsx   wallet adapter context
    ActivationPanel.tsx   connect wallet + subscribe & activate flow
    FixturesPanel.tsx     fetches World Cup fixtures once activated
```

Credential flow: connect wallet → fetch guest JWT → sign+send `subscribe(serviceLevelId=1, weeks=4)` on-chain → sign activation message with wallet → backend exchanges it for an API token → token stored in httpOnly cookies → all subsequent data calls go through our own `/api/txline/proxy/*`, which injects the real TxLINE auth headers server-side.

## Status (as of now)

| # | Task | Status |
|---|------|--------|
| 1 | Scaffold Next.js + Tailwind project | ✅ Done |
| 2 | Install Solana/TxLINE dependencies | ✅ Done |
| 3 | Wallet adapter (Phantom) wired up | ✅ Done |
| 4 | On-chain subscribe + activation flow (client + backend proxy) | ✅ Done, untested against live devnet wallet |
| 5 | Backend stream proxy for live scores/odds (SSE) | ✅ Done — `/api/txline/stream/scores` and `/api/txline/stream/odds` proxy TxLINE's raw SSE streams, holding auth server-side with one JWT-renewal retry |
| 6 | Live match ticker UI + on-chain verified badge (`validateStatV2`) | ✅ Done — `EventFeed` consumes the scores stream + a history backfill, filters by fixture, and runs a real `validateStatV2` read-only on-chain proof check per event via `/api/txline/verify` (ephemeral unfunded keypair, no wallet/fees needed since it's a simulate-only `.view()` call) |
| 7 | Momentum sparkline from odds feed | ✅ Done — `OddsSparkline` subscribes to `/api/txline/stream/odds`, locks onto the first market seen per fixture, renders a sparkline + probability bar + legend. "Crowd Pulse / StablePrice" framing. |
| 8 | Shareable moment cards (image + QR + proof hash) | ✅ Done — `ShareCardModal` uses `html-to-image` + `qrcode` to generate a downloadable PNG stamped with the on-chain proof hash and a QR code linking to Solana Explorer. Triggered from any verified event card. |
| 9 | Prediction mini-game + leaderboard | ✅ Done — `PredictionGame` component + `/api/txline/predictions` API route (in-memory store). Four prediction types (goal/card/corner/penalty), 30s cooldown, auto-resolution when a matching event arrives from the live stream, 10 pts per correct guess, top-20 leaderboard. |
| 10 | Polish, mobile pass, demo video, submission | ✅ Done — OG/Twitter image via `next/og` ImageResponse API, sticky score header in modal, show-all fixtures button, snapshot-fallback score fetch for past matches, enhanced score extraction (additional field shapes + tertiary FinalScore/Result envelope), mobile padding/sizing improvements throughout. |
| — | **UI/visual design** (landing page, dark theme, typography) | ✅ Done — landing page at `/` (flat dark theme, dot-grid/glow hero, glass cards, scroll/typewriter animations). App dashboard at `/app` rebuilt as a two-panel layout (left rail + main), data-table connect card, match-card fixture list. Selecting a fixture now opens a centered landscape `MatchModal` (score header + tiered event feed) instead of inlining below the page. Rebranded from "Matchday Pulse" to **VAROnChain**. |

**Score bug fixed:** The history backfill now tries `/scores/historical/{fixtureId}` first (covers finished matches from 6h–2wk ago), then falls back to the snapshot + 5-min bucket scan. The `MatchHeader` score extraction now walks the confirmed soccer feed shape `Score.Participant1.Total.Score` / `Score.Participant2.Total.Score`, with flat fallbacks. Phase detection now recognises `game_finalised` (statusId=100) and numeric `StatusId` values from `status` action events.

**Real event data observed, and a UX fix in response:** history-scan events for a scheduled fixture came back full of coverage/setup noise (`connected`, `venue`, `players_warming_up`, `pitch`, `weather`) mixed in with anything meaningful. `EventFeed` now classifies every event into three tiers: **key** (goals/cards/subs/penalties/VAR/corners/kickoff/half/full time — full verify UI, own column), **activity** (shots, comments, etc. — compact, collapsed by default), **system** (the coverage noise above — ultra-compact monospace log, collapsed by default). Also confirmed: the scores-stream `GameState` field is a *string* (`"scheduled"`) here, distinct from the *numeric* `GameState` on the fixtures-snapshot endpoint — these are two different fields from two different endpoints, not a bug.

**Known gap / real risk:** the exact field names for a running score (used in `MatchHeader`) are still a best-effort guess (`Participant1Score`/`HomeScore`/etc.) since no live in-progress match has been observed yet; it intentionally shows "–" rather than a guessed wrong number when it can't find a recognized field.

**Bug fixed along the way:** `@coral-xyz/anchor`'s `Wallet` class isn't statically resolvable from its ESM bundle under Turbopack (`Export Wallet doesn't exist in target module`) — replaced with a small hand-rolled wallet object implementing just the `signTransaction`/`signAllTransactions` interface `AnchorProvider` needs, backed by an ephemeral `Keypair`. Also fixed: `/api/token/activate` returns the API token as plain text on success, not JSON — code assumed JSON and crashed with a parse error.

## Remaining plan (5-day window, started July 14)

- **Day 1 (today, in progress):** ~~scaffold~~, ~~wallet adapter~~, ~~subscribe/activate flow~~, redo UI (landing page + crisp dark theme), then verify the activation flow end-to-end with a real devnet wallet.
- **Day 2:** Backend SSE proxy for score/odds streams on a sample fixture; wire up `validateStatV2` for goal events to produce a real on-chain proof check.
- **Day 3:** Live match ticker UI with the verified badge; momentum sparkline from the odds stream.
- **Day 4:** Shareable moment card generation (canvas/OG image + QR linking to the proof); prediction mini-game + leaderboard (off-chain first).
- **Day 5:** Mobile polish, demo video, README, submission on Superteam Earn.

## Open risks / things to verify

- No live/covered World Cup fixture may be in progress during dev — need to test against historical/replay data or the documented demo fixture ids (`fixtureId=18175981` etc. from the example scripts) rather than assuming a live match.
- Devnet wallet needs devnet SOL for tx fees — confirm the user's wallet is funded before the first real activation test.
- `validateStatV2` proof derivation (epoch-day PDA math) is intricate — budget real time for Day 2, it's the single most technically risky piece and also the feature that differentiates this submission.
