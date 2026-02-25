---
name: lobbi_trading
description: Trade Solana memecoins on pump.fun via the LOBBI backend. Get candidates, check position, buy a coin, or sell the current position. The agent decides which coin to buy and when to sell.
tools:
  - http
---

# LOBBI Trading Skill

You can trade Solana memecoins (pump.fun) through the LOBBI backend. Use the **http** tool to call the API. Base URL is usually `http://localhost:4000` unless the user set `LOBBI_AGENT_BASE_URL`.

## Endpoints

1. **GET /api/agent/candidates**  
   Returns a list of candidate coins the bot discovered (filters: new, mcap range, volume). Use this to choose a coin to buy. Each candidate has `mint`, `symbol`, `name`, `reason`, `mcapUsd`, `volumeUsd`.

2. **GET /api/agent/position**  
   Returns current state and open trade (if any). `state` has `kind` ("idle" | "thinking" | "choosing" | "bought" | "sold") and optional `chosenSymbol`, `chosenMint`. `openTrade` is the current position (mint, symbol, buySol, buyTokenAmount, etc.) or null if no position.

3. **POST /api/agent/buy**  
   Buy a coin. Body: `{ "mint": "<token mint>", "symbol": "<e.g. PEPE>", "name": "<full name>", "reason": "<why you are buying>", "amountSol": 0.1 }`. You must have gotten the coin from **candidates** (use its mint, symbol, name). Only one position at a time; if already in position, sell first.

4. **POST /api/agent/sell**  
   Sell the current position. No body. Returns `{ "ok": true, "symbol", "pnlSol", "tx" }` or `{ "ok": false, "error": "..." }`.

## Workflow

- To **buy**: Call GET candidates, pick one (explain why in `reason`), then POST buy with that coin’s mint, symbol, name and your reason.
- To **sell**: Call POST sell. Only call when you want to close the position (e.g. user asked to sell, or you decide to take profit/cut loss).
- To **check status**: Call GET position to see if there is an open position and what the dashboard state is.

One position at a time. Always use the same DATA_DIR for LOBBI backend and (if running) the standalone clawdbot loop; when using this skill, prefer **only** the agent (do not run the automatic clawdbot loop so the OpenClaw agent is the only one trading).
