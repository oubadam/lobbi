---
name: lobbi_trading
description: Trade Solana memecoins on pump.fun via LOBBI. Scan candidates (filtered by mcap, volume, age), pick based on narrative and holder quality, provide reasoning, and decide when to take profit.
tools:
  - http
---

# LOBBI Trading Skill — Full Agent Control

You trade Solana memecoins (pump.fun) through the LOBBI backend. **You** decide which coin to buy and when to sell. Use the **http** tool. Base URL: `http://localhost:4000` (or `LOBBI_AGENT_BASE_URL` if set).

## Filters (enforced by LOBBI)

Candidates are pre-filtered. To understand limits, call **GET /api/filters**. Typical ranges:
- `maxMcapUsd`: 31400 — max market cap $31.4k
- `minMcapUsd`: 10000
- `minVolumeUsd`: 12000
- `maxAgeMinutes`: 60 — coins older than 1h are excluded
- `minGlobalFeesPaidSol`: 0.8 — bonding curve activity

## Endpoints

### GET /api/filters
Returns the filter config. Use to understand mcap/volume/age limits.

### GET /api/agent/candidates
Returns candidate coins (already filtered by mcap, volume, age). Each has:
- `mint`, `symbol`, `name`
- `reason` — e.g. "Vol $15k · Mcap $20k"
- `mcapUsd`, `volumeUsd`, `liquidityUsd`
- `holderInfo` — when Birdeye is configured: "N holders, top10=X% (good)" or "(concentrated)"

### GET /api/agent/position
Returns current state and open trade. When holding a position, includes `quote`:
- `currentPriceUsd`, `buyPriceUsd`
- `unrealizedPnlPercent` — % gain/loss
- `unrealizedPnlSol` — SOL gain/loss
- `holdSeconds` — time in position

Use this to **decide when to take profit**. Check periodically when holding.

### POST /api/agent/buy
Buy a coin. Body: `{ "mint": "...", "symbol": "...", "name": "...", "reason": "<your reasoning>", "amountSol": 0.1 }`
- Must use a coin from **candidates**
- **Always provide a detailed `reason`**: narrative, holder quality, why this coin, why now

### POST /api/agent/sell
Sell the current position. No body. Call when **you** decide to take profit or cut loss.

## Selection logic (narrative + data)

1. **Get candidates** — they are pre-filtered.
2. **Pick based on**:
   - **Narrative**: Symbol, name, cultural relevance, meme potential, topicality
   - **Holder quality** (when `holderInfo` exists): Prefer "good" (many holders, not concentrated). Avoid "concentrated"
   - **Volume / mcap**: Higher volume often means more interest; liquidity ratio
   - **Your judgment**: Which story will run? Which feels overdone?
3. **Provide reasoning** in every buy: explain narrative, holder quality, why this coin, why now.

## Take-profit logic

**You** decide when to sell. Call **GET /api/agent/position** to see `quote`:
- `unrealizedPnlPercent` — positive = profit, negative = loss
- `holdSeconds` — time held
- Consider: narrative played out? Target hit? Stop-loss? Time-based exit?

Sell when you judge it's right: take profit, cut loss, or narrative exhausted.

## Workflow

- **To buy**: GET candidates → pick one (narrative + holder + data) → POST buy with detailed `reason`
- **To sell**: GET position (check quote) → POST sell when you decide
- **One position at a time**. If already in position, sell first before buying.
- Do **not** run the automatic clawdbot loop — only you (the agent) drive trades.
