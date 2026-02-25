# Lobbi — Clawdbot Memecoin

Lobbi is a memecoin with a **Clawdbot** that trades Solana memecoins. Creator rewards from the Lobbi token (on Pump.fun) fund the bot. This repo contains:

- **Clawdbot** — Trading agent (filters, discover → choose → buy → sell, writes trades + state to `data/`)
- **Backend** — API for the website (trades, balance, PnL, Lobbi state)
- **Web** — ASCII/pixel-style site where you watch Lobbi think, choose a coin, and take trades live

## Quick start (demo mode)

No Solana keys or RPC needed. The bot runs in **demo mode** and generates fake trades so you can see the full flow.

1. **Install and run backend + web**

   ```bash
   npm install
   cd backend && npm install && cd ..
   cd web && npm install && cd ..
   cd clawdbot && npm install && cd ..
   ```

2. **Start backend and frontend**

   ```bash
   npm run dev
   ```

   This runs the API at **http://localhost:4000** and the site at **http://localhost:5173**. **Open the app at http://localhost:5173** (or http://localhost:5174 / 5175 if Vite picks another port when 5173 is in use).

3. **Start the bot** (in another terminal, or run everything at once):

   ```bash
   npm run dev:bot
   ```

   Or run **backend + web + bot** in one go:

   ```bash
   npm run dev:all
   ```

   The bot will cycle: idle → thinking → choosing (from 3 candidates on the ASCII screens) → buy → hold → sell, and write trades + state to `data/`. The website polls every 3s so you see Lobbi move and the trade feed update.

## Project layout

```
lobbi/
├── config/
│   └── filters.json     # Clawdbot filters (position size, hold time, etc.)
├── data/                # Created by bot: trades.json, state.json
├── clawdbot/            # Trading agent
├── backend/             # API (Express)
├── web/                 # Vite + React frontend
├── lobbi.jpg            # Lobbi mascot
└── PLAN.md              # Full project plan
```

## Configuration

- **Bot filters (all enforced)** — Edit `config/filters.json`. Every filter is enforced; no relaxation of max age or max mcap:
  - `minVolumeUsd`, `minMcapUsd` — min 24h volume and market cap (USD)
  - `maxMcapUsd`: **31400** — max market cap $31.4k. Only tokens at or below this are considered.
  - `maxAgeMinutes`: **60** — max token age (1 hour). Coins older than this are never selected.
  - `minGlobalFeesPaidSol`: 0.8 — min global fees paid on bonding curve (SOL); applied when data is available
  - `maxCandidates`: 3 — coins shown on the 3 screens
  - `holdMinSeconds`, `holdMaxSeconds` — base hold window; actual hold is decided by **coin analysis** (volume/mcap, liquidity).
  - `takeProfitPercent`, `stopLossPercent` — targets; analysis can tighten or relax them by coin quality.
  - `maxPositionSol`, `slippagePercent`, `priorityFeeSol`, etc.
- **Hold logic** — The bot analyses each coin (volume, mcap, liquidity, and optionally **holder distribution** when Birdeye is configured): high volume/mcap → longer hold and higher take-profit; good holders (many wallets, not concentrated) → longer hold; thin liquidity or concentrated holders → shorter max hold. In live mode it polls price and sells when take-profit or stop-loss is hit, or when max hold time is reached.
- **Birdeye** (optional) — Set `BIRDEYE_API_KEY` to use Birdeye for **discovery** (token list by volume) and **holder stats** (top-10 concentration) to score "good holders" and adjust hold/TP. Without the key, discovery uses DexScreener only.
- **Demo vs live** — If `SOLANA_RPC_URL` is not set, the bot runs in **demo mode** (no real swaps). Buy/sell amounts and PnL are **simulated** from DexScreener prices, so they can be approximate. When you **link a wallet** (set `SOLANA_RPC_URL` and `WALLET_PRIVATE_KEY`), the bot does real on-chain trades and **PnL is computed from the wallet’s actual SOL balance before/after each sell**, so the trade feed and total PnL are accurate. You need:
  - `SOLANA_RPC_URL` (e.g. Helius, QuickNode)
  - `WALLET_PRIVATE_KEY` (base58) for the bot wallet
  - Fund the bot wallet with SOL (e.g. 1 SOL to start)
  - Buys/sells use PumpPortal’s trade-local API (0.5% fee per trade).

See **docs/APIS.md** for a list of all APIs used (DexScreener, PumpPortal, Birdeye, Solana RPC, backend).

## Lobbi token on Pump.fun

1. Create a token on [Pump.fun](https://pump.fun) using **Lobbi** (or $LOBBi), with `lobbi.jpg` as the image.
2. Set the **creator wallet** to the **Clawdbot wallet** so creator rewards (e.g. 0.5 SOL on bonding curve completion) go to the bot.

## Scripts

| Command        | Description                    |
|----------------|--------------------------------|
| `npm run dev`  | Backend + web (concurrently)   |
| `npm run dev:bot` | Clawdbot (demo or live)   |
| `npm run dev:backend` | Backend only              |
| `npm run dev:web`     | Web only                  |
| `npm run build`      | Build bot, backend, web  |

## Tech

- **Clawdbot**: Node + TypeScript, writes to `data/trades.json` and `data/state.json`. Real trading would use Jupiter API + Solana RPC (not wired in demo).
- **Backend**: Express, serves `/api/trades`, `/api/balance`, `/api/pnl`, `/api/lobbi/state` from `data/`.
- **Web**: React + Vite, pixel/ASCII theme (Press Start 2P, VT323), Lobbi sprite, live state and trade feed.
