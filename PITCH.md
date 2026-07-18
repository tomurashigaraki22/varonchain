# VAROnChain: The Ultimate Web3 Fan Companion

**Tagline:** *Every goal. Verified on-chain.*

## 📌 The Problem
Traditional sports companion apps (like ESPN or LiveScore) give fans the data, but they offer a strictly passive, Web2 experience. Fans want to actively participate, prove they "called it" before it happened, and engage with live matches in a verifiable, interactive way. 

## 💡 Our Solution
**VAROnChain** is a real-time World Cup fan companion powered by **TxODDS TxLINE** and the **Solana** blockchain. It transforms passive game-watching into an interactive, verifiable, and highly social Web3 experience. 

We take live sports data, put it on-chain, and build a suite of fan-engagement tools around it.

---

## 🚀 Core Features (How to Demo to Judges)

### 1. Real-Time "TxLINE" Live Feeds
* **What it does:** We stream live match events (Goals, Cards, Substitutions, Penalties) directly to the user's dashboard.
* **The Web3 Twist:** Every single major event in the feed isn't just text—it is cryptographically verified on-chain. We pull data via the TxLINE stream. If a stream drops (common on devnets), we have a bulletproof 5-second polling fallback so the fan never misses a beat.

### 2. The "What Happens Next?" Prediction Arena
* **What it does:** A totally free-to-play, rapid-fire prediction minigame embedded right next to the live match feed.
* **How it works:** 
  1. A user connects their Solana Wallet.
  2. They predict the *very next* event in the match (Goal, Card, Corner, or Penalty).
  3. A **5-minute countdown (TTL)** starts.
  4. If the live TxLINE stream broadcasts that event within 5 minutes, the system automatically grades their prediction as a **win** and awards them points. If 5 minutes pass, the prediction expires.
* **The "Arena" Tab:** Users can see a live, global feed of what every other connected wallet is predicting in real-time. It's Wallet vs Wallet.

### 3. Verifiable Social Flexing (Shareable Cards)
* **What it does:** When a user's team scores, or when they win a prediction, they want to brag.
* **How it works:** VAROnChain generates gorgeous, dynamic, shareable PNG cards right in the browser. These cards include a QR code pointing directly to the on-chain proof of that specific event. It turns a simple "I called it!" into a cryptographically verified receipt.

### 4. Premium Aesthetic
* **What it does:** We built a custom "Soft Slate & Muted Indigo" UI.
* **Why it matters:** Most crypto apps look overwhelming or use harsh neon colors. VAROnChain looks like a premium, sleek fintech or sports platform. It reduces eye strain and establishes trust, proving Web3 apps can have world-class UX.

---

## 🛠 Technical Stack
- **Frontend:** Next.js (App Router), Tailwind CSS (Custom Design System), React.
- **Blockchain Data:** TxODDS TxLINE API (for live match streams, historical data, and odds).
- **Web3 Integrations:** Solana Wallet Adapter for user authentication and the Prediction Arena identity.
- **Dynamic Assets:** Next.js Satori for on-the-fly OpenGraph image generation.

## 🎯 The Pitch Summary (Read this to the Judges)
> *"VAROnChain isn't just another live score app. By combining Solana's speed with TxLINE's rich sports data, we've built an active, verifiable fan arena. Fans can track live games, make micro-predictions on the next 5 minutes of play, and generate verifiable, on-chain receipts when they call the right shots. It is fast, it is completely free to play, and it represents the future of interactive sports broadcasting."*
