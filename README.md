# Lobbi — AI Memecoin (powered by OpenClaw)

Lobbi is an **autonomous AI** that trades Solana memecoins on Pump.fun. Powered by [OpenClaw](https://openclaw.ai). Lobbi runs 24/7—you just watch. No one asks it anything; it buys and sells on its own.

- **Backend** — API for the website and agent endpoints
- **Web** — Watch Lobbi, the trade feed, PnL chart, and bot wallet
- **Clawbot** — Autonomous loop: discovers candidates, buys, holds; Lobbi (via LLM) decides when to sell

## Quick start

1. **Install**

   ```bash
   npm install
   cd backend && npm install && cd ..
   cd web && npm install && cd ..
   cd clawdbot && npm install && cd ..
   ```

2. **Set `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`** in `.env` — Lobbi uses this to decide when to sell (autonomous LLM calls).

3. **Run Lobbi** (backend + web + bot)

   ```bash
   npm run dev:all
   ```
   or `npm run dev` + `npm run dev:bot` in another terminal.

   API at **http://localhost:4000**, site at **http://localhost:5173**. Lobbi discovers, buys, holds, and sells on its own. You just watch.

## Project layout

```
lobbi/
├── config/
│   └── filters.json     # Clawdbot filters (position size, hold time, etc.)
├── data/                # Created by bot: trades.json, state.json
├── clawdbot/            # Trading agent (loop or agent API)
├── backend/             # API (Express) + /api/agent/* for Lobbi
├── web/                 # Vite + React frontend
├── openclaw-skill/      # OpenClaw skill so Lobbi can trade
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
| `npm run dev:all` | Backend + web (same as dev) |
| `npm run dev:bot` | Clawbot loop (optional; use only if not using Lobbi) |
| `npm run dev:backend` | Backend only              |
| `npm run dev:web`     | Web only                  |
| `npm run build`      | Build clawbot, backend, web  |

## Tech

- **Clawbot** (optional): Node + TypeScript, can run as a loop; normally Lobbi (via OpenClaw) drives trades.
- **Backend**: Express, serves `/api/trades`, `/api/balance`, `/api/pnl`, `/api/pnl/chart`, `/api/agent/*` from `data/`.
- **Web**: React + Vite, pixel/ASCII theme, Lobbi sprite, live state, trade feed, PnL chart.
