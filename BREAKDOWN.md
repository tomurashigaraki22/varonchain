# VAROnChain — Project Breakdown

> **Hackathon:** Superteam Earn × TxODDS World Cup Hackathon 2026  
> **Track:** Consumer & Fan Experiences  
> **Prize pool:** $16,000 USDT  
> **Deadline:** July 19, 2026

---

## The One-Line Pitch

VAROnChain is a real-time World Cup fan companion where **every goal, card, and substitution is cryptographically proven against the Solana blockchain** — not just claimed. The on-chain proof is the product, not a footnote.

---

## Why This Exists

Most entries in a "fan experience" hackathon will wrap a live scores API in a scoreboard and call it done. TxODDS TxLINE's actual technical differentiator is *verifiability* — every event batch is hashed into a Merkle root and anchored to Solana. We make that the thing fans interact with, not something hidden in a footnote.

When you see a goal on VAROnChain, you can hit **Verify** and prove cryptographically that this goal actually happened — backed by a real Anchor program simulation against an on-chain PDA, not a badge we drew in CSS.

---

## Features

### 1. Live Verified Match Ticker
Real-time goals, cards, and substitutions from TxLINE's SSE stream. Each key event has a **Verify** button that runs a genuine `validateStatV2` on-chain proof check:

- Fetches the Merkle proof payload from TxLINE's `/scores/stat-validation` endpoint
- Derives the `daily_scores_roots` PDA on Solana devnet
- Runs `program.methods.validateStatV2(...).view()` — a **read-only simulation**, no transaction sent, no fees charged
- Returns `verified: true/false` + the PDA address for the Solana Explorer link

### 2. Shareable Verified Moment Cards
When a goal is verified on-chain, generate a downloadable PNG card containing:
- The match, score, and minute
- Short proof hash
- QR code linking to the on-chain PDA on Solana Explorer

Built with `html-to-image` + `qrcode` libraries. No canvas API needed.

### 3. Crowd Pulse — Match Momentum Sparkline
A live win-probability sparkline built from TxLINE's StablePrice odds SSE stream. Framed as "match momentum" for the fan-experience track (not a betting interface). Shows home win / draw / away win probability shifting in real time.

### 4. Free-to-Play Prediction Game
Fans guess the next event (goal / card / corner / penalty) in a live window:
- 30-second cooldown between predictions
- Auto-resolves when the matching event arrives from the live stream
- 10 points per correct prediction
- Live top-20 leaderboard
- Predictions locked on finished matches

### 5. World Cup Fixture Browser
Sorted intelligently: **upcoming first → live → finished (most recent)**. Each fixture card shows:
- Win probability bars from the odds snapshot
- Live / FT / kickoff time badge
- Score for finished matches

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│                                                             │
│  Landing page (/)        App (/app)                        │
│                          ├─ ActivationPanel                 │
│                          │    connect wallet                │
│                          │    → subscribe on-chain          │
│                          │    → activate API token          │
│                          │                                  │
│                          ├─ FixtureList                     │
│                          │    World Cup fixtures + odds     │
│                          │                                  │
│                          └─ MatchModal (per fixture)        │
│                               ├─ MatchHeader (score)        │
│                               ├─ OddsSparkline (Crowd Pulse)│
│                               ├─ EventFeed (live events)    │
│                               └─ PredictionGame             │
└─────────────────────────────────────────────────────────────┘
                              │
                    Next.js API routes (server)
                    Auth held in httpOnly cookies
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   TxLINE REST API      TxLINE SSE streams    Solana devnet RPC
   (fixtures, odds,     (scores stream,       (validateStatV2
    history, proof)      odds stream)          simulation)
```

### Credential Flow

```
User connects Phantom wallet (devnet)
  │
  ├─ 1. Frontend POSTs to /api/txline/guest-jwt
  │      → Server fetches short-lived JWT from TxLINE guest auth
  │
  ├─ 2. Frontend sends on-chain subscribe() tx
  │      → Signs with wallet, pays ~0.001 SOL devnet fee
  │      → TxLINE txoracle program records subscription
  │
  ├─ 3. Frontend signs activation message with wallet
  │      → POSTs sig + txSig to /api/txline/activate
  │      → Server exchanges for real API token
  │      → Token stored in httpOnly cookie (never touches client JS)
  │
  └─ 4. All subsequent data calls go through /api/txline/proxy/*
         → Server injects Authorization + X-Api-Token headers
         → Client never sees credentials
```

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript |
| Styling | Tailwind CSS v4, custom dark theme |
| Wallet | `@solana/wallet-adapter-react` — Phantom, Wallet Standard |
| On-chain | `@coral-xyz/anchor` — TxLINE `txoracle` program |
| Solana program | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` (devnet) |
| Data | TxLINE SSE streams + REST snapshot/history endpoints |
| Icons | HugeIcons `@hugeicons/core-free-icons` |
| Card gen | `html-to-image` + `qrcode` |
| OG image | `next/og` ImageResponse API |

---

## File Structure

```
src/
├── app/
│   ├── page.tsx                    Landing page
│   ├── app/page.tsx                Main app dashboard
│   ├── opengraph-image.tsx         OG image (next/og)
│   ├── twitter-image.tsx           Twitter card image
│   └── api/txline/
│       ├── guest-jwt/route.ts      POST → fetch guest JWT
│       ├── activate/route.ts       POST → activate API token
│       ├── status/route.ts         GET  → session check
│       ├── proxy/[...path]/route.ts GET  → authenticated proxy
│       ├── stream/scores/route.ts  GET  → SSE score stream proxy
│       ├── stream/odds/route.ts    GET  → SSE odds stream proxy
│       ├── history/route.ts        GET  → history backfill
│       ├── verify/route.ts         POST → validateStatV2 proof
│       ├── odds/route.ts           GET  → odds snapshot
│       └── predictions/route.ts   GET/POST/PATCH → prediction game
│
├── components/
│   ├── SolanaProviders.tsx         Wallet adapter context
│   ├── ActivationPanel.tsx         Connect → Subscribe → Activate flow
│   ├── app/
│   │   ├── AppNavbar.tsx           App top bar
│   │   ├── FixtureList.tsx         World Cup fixture browser
│   │   ├── MatchModal.tsx          Match detail overlay
│   │   ├── MatchHeader.tsx         Live score + phase badge
│   │   ├── EventFeed.tsx           Live events + verify + share
│   │   ├── OddsSparkline.tsx       Crowd Pulse sparkline
│   │   ├── PredictionGame.tsx      Prediction game + leaderboard
│   │   └── ShareCardModal.tsx      Verified moment PNG generator
│   └── landing/
│       ├── Hero.tsx                Landing hero + live ticker widget
│       ├── HowItWorks.tsx          3-step explainer
│       ├── FeatureBento.tsx        Feature grid
│       ├── TerminalProof.tsx       Animated proof terminal
│       ├── CTABanner.tsx           CTA section
│       └── Footer.tsx
│
└── lib/txline/
    ├── config.ts                   RPC URL, program ID, API base
    ├── server.ts                   Server-side fetch helpers + JWT renewal
    ├── subscribeClient.ts          Browser: build + send subscribe tx
    ├── verify.ts                   validateStatV2 on-chain simulation
    ├── idl/txoracle.devnet.json    Anchor IDL for the txoracle program
    └── types/txoracle.devnet.ts    Generated TypeScript types
```

---

## On-Chain Verification — Deep Dive

This is the core differentiator. Here's exactly how it works:

### The Data Contract

TxLINE batches match events into Merkle trees. The root of each day's tree is written on-chain into a `daily_scores_roots` PDA on Solana:

```
PDA seeds: ["daily_scores_roots", epochDay as u16 little-endian]
Program:   6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J
Network:   Solana devnet
```

### The Proof

When a user clicks **Verify** on a goal event:

1. **Backend** fetches the Merkle proof from TxLINE:
   ```
   GET /scores/stat-validation?fixtureId=X&seq=Y&statKeys=1,2
   ```
   Returns a `StatValidationApiResponse` containing:
   - `summary`: fixture ID, update count, timestamp range, sub-tree root
   - `subTreeProof`: Merkle path from this fixture to the daily root
   - `mainTreeProof`: continuation of the Merkle path to the on-chain root
   - `eventStatRoot`: root of this specific event's stat tree
   - `statsToProve`: array of `{ key, value, period }` — e.g. stat key 1 (home goals), key 2 (away goals)
   - `statProofs`: Merkle proofs for each individual stat

2. **Backend** constructs the `validateStatV2` call:
   ```typescript
   program.methods
     .validateStatV2(payload, strategy)
     .accounts({ dailyScoresMerkleRoots: dailyScoresPda })
     .preInstructions([computeBudgetIx])
     .view()  // read-only simulation — no tx submitted, no fees
   ```

3. **Strategy**: `discretePredicates` — each stat value must be `> 0` (i.e., "this goal actually happened")

4. **Result**: `verified: boolean` + the PDA address for the Solana Explorer link

The fee payer is the user's own connected wallet (it already exists on-chain from the subscribe transaction). No funds are spent — `.view()` only simulates.

---

## Event Data Pipeline

### Source → Display Flow

```
TxLINE SSE stream (/scores/stream)
    │
    ▼
/api/txline/stream/scores (Next.js route — holds auth server-side)
    │  pipes the SSE stream through, injecting auth headers
    ▼
EventSource (browser) — receives raw JSON events
    │
    ▼
EventFeed.tsx — classifies, deduplicates, displays

Classification tiers:
  KEY    → goals, cards, substitutions, penalty outcomes, VAR decisions
  MARKER → kick off, half time, full time (separator rows)
  ACTIVITY → corners, penalty awarded, VAR start (collapsible drawer)
  SYSTEM → possession, lineups, weather, coverage noise (hidden)

Deduplication rules (from TxLINE schema):
  action_amend:     Data.Id = original event Id → patch in place
  action_discarded: top-level Id = voided event Id → remove
```

### History Backfill Strategy

When a fixture is opened, we fetch history in order:

1. `/scores/historical/{fixtureId}` — covers finished matches (6h–2wk ago)
2. `/scores/snapshot/{fixtureId}` — current resolved state (already deduplicated server-side)
3. 5-minute bucket scan (`/scores/updates/{epochDay}/{hour}/{interval}`) — live matches only

The snapshot is used over the bucket scan for finished matches because TxLINE applies discards server-side — the snapshot is the clean resolved state.

### Score Extraction

TxLINE goals are stored as period counts:
```
Score.Participant1.H1.Goals + Score.Participant1.H2.Goals = home score
Score.Participant2.H1.Goals + Score.Participant2.H2.Goals = away score
```
`Total.Goals` can be stale after a discarded goal, so we sum the period buckets. For live matches with 0 goals, we default to 0 (Score object present = match has started).

---

## Running Locally

### Prerequisites

- Node.js 20+
- Phantom wallet browser extension
- Devnet SOL: `solana airdrop 1 <YOUR_PUBKEY> --url devnet`

### Setup

```bash
git clone <repo>
cd varonchain
npm install
npm run dev
```

Open http://localhost:3000

### First Run

1. Go to `/app`
2. Connect Phantom (make sure it's on **devnet** in settings)
3. Click **Subscribe & Activate (Free)**
   - Signs one on-chain `subscribe` transaction (~0.001 SOL fee)
   - Signs a wallet message for activation
   - Session stored in httpOnly cookies — persists across reloads
4. World Cup fixtures load automatically

No API keys, no sign-up, no TxL token purchase required.

### Demo Fixture IDs

| Match | Fixture ID |
|---|---|
| France vs Spain (SF) | 18237038 |
| England vs Argentina (SF) | 18241006 |
| France vs Morocco (QF) | 18209181 |
| France vs Sweden (R32) | 18175981 |

Enter any ID in the "Track by fixture ID" field if it doesn't appear in the list.

---

## What Makes This Different

Most fan-experience entries will:
- Wrap the score API in a scoreboard UI
- Call it "verified" because TxLINE data is blockchain-adjacent

VAROnChain makes the verification the UX, not a backend detail:

| Everyone else | VAROnChain |
|---|---|
| Shows score from API, claims it's verified | Each event has a Verify button that runs a real proof |
| "Verified" is a static badge | "Verified" means `validateStatV2.view()` returned `true` |
| Score shown, no proof available | Score + Solana Explorer link to the on-chain PDA |
| Static OG image | Dynamic OG image showing the actual project |
| Generic fan app | Shareable proof cards fans can post |

---

## Hackathon Compliance

- **Track:** Consumer & Fan Experiences ✓
- **Data source:** TxLINE free World Cup tier ✓ (no TxL purchase required)
- **Not a trading tool:** Odds shown as "Crowd Pulse / match momentum" ✓
- **Devnet:** All on-chain interactions on Solana devnet ✓
- **Free-to-play:** Prediction game has no monetary stakes ✓
