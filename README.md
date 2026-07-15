# VAROnChain

**Every goal. Verified on-chain.**

VAROnChain is a real-time World Cup fan companion built on [TxODDS TxLINE](https://txline.txodds.com) — every score event is cryptographically proven against a Solana-anchored Merkle root before it hits your screen.

Built for the **Superteam Earn × TxODDS World Cup Hackathon 2026** — Consumer & Fan Experiences track.

---

## What it does

| Feature | Description |
|---|---|
| **Live verified ticker** | Goals, cards, subs stream in from TxLINE's SSE feed. Each event can be proven on-chain via `validateStatV2` — a real Anchor `.view()` simulation, not a static badge. |
| **Shareable moment cards** | Verified events generate a downloadable PNG stamped with the on-chain proof hash + QR code linking to Solana Explorer. |
| **Crowd Pulse sparkline** | Live win-probability chart built from TxLINE's StablePrice odds stream, framed as match momentum rather than betting lines. |
| **Free-to-play prediction game** | Guess the next event (goal/card/corner/penalty) before it happens. Auto-resolves when the matching event arrives from the live stream. Points tracked with a live leaderboard. |

## Stack

- **Framework:** Next.js 16 (App Router), TypeScript, Tailwind v4
- **Wallet:** `@solana/wallet-adapter-react` (Phantom), devnet
- **Chain:** `@coral-xyz/anchor` against TxLINE's `txoracle` program
  - Devnet program: `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`
- **Data:** TxLINE — scores + odds SSE streams, history backfill, on-chain stat validation
- **Auth:** httpOnly cookie proxy — the real TxLINE JWT + API token never reach the client

## Architecture

```
Browser
  └─ /app page
       ├─ ActivationPanel   connect wallet → subscribe on-chain → activate API
       ├─ FixtureList        World Cup fixtures with live odds probability bars
       └─ MatchModal (per fixture)
            ├─ MatchHeader      live score + phase badge
            ├─ OddsSparkline    Crowd Pulse from StablePrice odds stream
            ├─ EventFeed        live events + validateStatV2 proof check + share cards
            └─ PredictionGame   guess next event, auto-resolve, leaderboard

Next.js API routes (server-side, auth held in httpOnly cookies)
  ├─ /api/txline/guest-jwt        POST → TxLINE guest JWT
  ├─ /api/txline/activate         POST → API token, sets cookies
  ├─ /api/txline/status           GET  → activation check
  ├─ /api/txline/proxy/[...path]  GET  → authenticated snapshot proxy
  ├─ /api/txline/stream/scores    GET  → SSE proxy for score events
  ├─ /api/txline/stream/odds      GET  → SSE proxy for odds events
  ├─ /api/txline/history          GET  → historical/backfill (tries /scores/historical first)
  ├─ /api/txline/verify           POST → validateStatV2 on-chain simulation
  ├─ /api/txline/odds             GET  → odds snapshot per fixture
  └─ /api/txline/predictions      GET/POST/PATCH → prediction game state
```

## Running locally

### Prerequisites

- Node.js 20+
- A Phantom wallet funded with devnet SOL  
  (`solana airdrop 1 <YOUR_PUBKEY> --url devnet`)

### Setup

```bash
git clone <repo>
cd varonchain
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Activation flow

1. Open `/app`
2. Click **Connect Wallet** — connect Phantom on devnet
3. Click **Subscribe & Activate (Free)** — signs one on-chain `subscribe` tx + wallet message
4. Once activated, World Cup fixtures load automatically

No API keys required. The free World Cup tier needs no TxL purchase — just devnet SOL for the subscribe tx fee (~0.001 SOL).

### Demo fixture IDs

These are confirmed covered by TxLINE and have historical data:

| Match | fixtureId |
|---|---|
| France vs Sweden (R32) | 18175981 |
| France vs Spain (SF) | 18237038 |
| England vs Argentina (SF) | 18241006 |
| France vs Morocco (QF) | 18209181 |

Enter any fixture ID in the "Track by fixture ID" field on the fixtures page.

## On-chain verification

Every key event (goal, card, penalty) carries a **Verify** button that:

1. Calls `/api/txline/verify` which fetches the Merkle proof from TxLINE's `/scores/stat-validation` endpoint
2. Derives the `daily_scores_roots` PDA: `seeds = ["daily_scores_roots", epochDay as u16 LE]`
3. Runs `program.methods.validateStatV2(payload, strategy).view()` — a read-only simulation, no transaction submitted, no fees
4. Returns `verified: true/false` + the PDA address for the on-chain Explorer link

## Score data notes

TxLINE's soccer feed carries goals as **period counts** inside the `Score` object:
```
event.Score.Participant1.H1.Goals  +  event.Score.Participant1.H2.Goals  =  final score
event.Score.Participant2.H1.Goals  +  event.Score.Participant2.H2.Goals
```
`Total.Goals` exists but may reflect intermediate state after a discarded goal — summing period buckets is always accurate. Final scores are reliable on `game_finalised` events.

The history endpoint tries `/scores/historical/{fixtureId}` first, then `/scores/snapshot/{fixtureId}` (which TxLINE already de-duplicates), then falls back to scanning 5-minute update buckets for live matches.

## Hackathon context

- **Track:** Consumer & Fan Experiences
- **Data source:** TxLINE free World Cup tier (no TxL required, devnet)
- **Differentiator:** verifiability is the product — every event is proven, not assumed
- **Deadline:** July 19, 2026

## License

MIT
