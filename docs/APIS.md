# APIs used by Lobbi / Clawdbot

## External APIs (Clawdbot + Backend)

| API | Purpose | When used | Auth |
|-----|---------|-----------|------|
| **DexScreener** (`api.dexscreener.com`) | Token discovery (search by keyword), token price (token-pairs) | Discovery when no Birdeye key; price during hold loop | None (public) |
| **PumpPortal** (`pumpportal.fun`) | Buy/sell on Pump.fun (trade-local) | Live mode: execute buy and sell transactions | None (0.5% fee per trade) |
| **Birdeye** (`public-api.birdeye.so`) | Token list (finding coins), holder distribution (good holders) | When `BIRDEYE_API_KEY` is set: discovery + holder analysis | `X-API-KEY` header |
| **Solana RPC** (e.g. Helius, QuickNode) | Send signed transactions | Live mode: after PumpPortal returns serialized tx | `SOLANA_RPC_URL` (your endpoint) |

## Our own

| API | Purpose |
|-----|---------|
| **Backend** (`localhost:4000` in dev) | Serves `/api/trades`, `/api/balance`, `/api/pnl`, `/api/lobbi/state` for the website. Reads from `data/` (trades.json, state.json) written by Clawdbot. |

## Endpoints in detail

- **DexScreener**
  - `GET /latest/dex/search?q=...` — search pairs (we use for discovery).
  - `GET /token-pairs/v1/solana/{mint}` — pairs and price for a token (we use for USD price in hold loop).
- **PumpPortal**
  - `POST /api/trade-local` — body: publicKey, action (buy/sell), mint, amount, denominatedInSol, slippage, priorityFee, pool. Returns serialized transaction; we sign and send via Solana RPC.
- **Birdeye** (when key set)
  - `GET /defi/tokenlist` — sort_by (v24hUSD, mc), min_liquidity, offset, limit. Headers: `x-chain: solana`, `X-API-KEY`.
  - `GET /holder/v1/distribution` — token_address, mode=top, top_n=10. For “good holders” (count, concentration).
  - `GET /defi/v3/token/holder` — top holders by token address (alternative for holder data).

## SOL price

- We use **$76.6 USD** per SOL for approximate conversions (e.g. max mcap $31.4k ≈ 410 SOL). Update `clawdbot/src/price.ts` or add a price API if you want live SOL/USD.
