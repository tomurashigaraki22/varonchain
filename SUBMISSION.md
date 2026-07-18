# VAROnChain

## 🚀 Inspiration
Watching live sports is fundamentally a shared, high-adrenaline experience, but sports companion apps remain entirely passive. Fans are checking text-based score updates without any real interactivity or trust in the data source. We wanted to change that. We asked ourselves: *What if every major match event was cryptographically verified on-chain, and fans could actively predict outcomes against each other in real-time?* That is how **VAROnChain** was born.

## 💡 What it does
**VAROnChain** is a real-time Web3 fan companion for the World Cup, powered by the **TxODDS TxLINE API** and the **Solana** blockchain. 
* **Live, On-Chain Feeds:** It provides an ultra-fast, live feed of match events (Goals, Cards, Substitutions, and Penalties). Every major action is verified on-chain.
* **The Prediction Arena:** A free-to-play, rapid-fire prediction minigame embedded directly into the live feed. Fans connect their Solana wallets and predict the *very next* event (e.g., "Next Goal", "Card"). Predictions have a strict 5-minute Time-To-Live (TTL). If the event happens on the live stream within 5 minutes, the user automatically wins points.
* **Wallet vs Wallet:** Users can view the "Arena" tab to see a live feed of exactly what other fans are predicting in real-time, competing for the top spot on the global leaderboard.
* **Verifiable Social Flexing:** When a user calls a prediction correctly or their team scores, the platform dynamically generates a gorgeous, shareable PNG card containing a QR code that links directly to the on-chain proof of that event.

## 🛠 How we built it
* **Frontend:** We built a highly responsive, modern UI using **Next.js (App Router)** and **Tailwind CSS**. We deliberately moved away from harsh neon "crypto" aesthetics, opting for a clean, premium "Soft Slate & Muted Indigo" design that prevents eye strain during 90-minute matches.
* **Data Layer:** We integrated the **TxLINE API** via Server-Sent Events (SSE) to stream live scores directly to the client. To ensure 100% uptime (even if the devnet stream drops), we implemented a robust hybrid system that unconditionally falls back to 5-second polling.
* **Web3 Integration:** We used the **Solana Wallet Adapter** to authenticate users instantly without gas fees, acting as their unique identity for the Prediction Arena.
* **Dynamic Assets:** We used **Next.js Satori (generateImage)** to instantly render beautiful, data-rich PNG share cards natively on the edge.

## 🚧 Challenges we ran into
* **Handling Unstable Live Streams:** Streaming real-time data over SSE on a devnet environment meant we sometimes experienced dropped connections or silent streams. We solved this by engineering a custom hybrid polling fallback that ensures the UI is strictly live regardless of connection hiccups.
* **Satori / OG Image Constraints:** Dynamically generating the shareable cards natively in Next.js using Satori came with strict CSS and layout constraints (like strict `display: flex` requirements). We had to creatively adapt our HTML structures to ensure the cards rendered perfectly.

## 🏆 Accomplishments that we're proud of
* Building a truly real-time prediction engine that auto-resolves bets against a live blockchain data stream without requiring manual grading or slow smart-contract state changes.
* Creating a visually stunning, polished product that looks like a consumer-ready Web2 app but secretly leverages powerful Web3 primitives under the hood.

## 📖 What we learned
We learned a tremendous amount about handling ultra-low latency real-time data streams in React, the intricacies of the TxLINE data structures for World Cup matches, and how to seamlessly blend Web3 wallet identities into a frictionless, free-to-play consumer experience.

## ⏭ What's next for VAROnChain
* **On-Chain Wagers:** Upgrading the free-to-play Prediction Arena to allow users to place micro-wagers in USDC or SOL on their 5-minute predictions.
* **NFT Ticket Stubs:** Allowing users to mint their successful predictions or "Match of the Day" scorecards as verifiable NFTs.
* **Expanded Leagues:** Scaling beyond the World Cup to cover the Premier League, Champions League, and other tier-1 sports ecosystems.
