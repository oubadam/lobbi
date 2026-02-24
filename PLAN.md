# Lobbi Memecoin + Clawdbot – Project Plan

## Vision

- **Lobbi**: Memecoin on Pump.fun with a pixel-art lobster mascot.
- **Clawdbot**: Autonomous agent that trades Solana memecoins (filters you set), starts with 1 SOL, and is funded by Lobbi creator rewards.
- **Website**: ASCII/pixel-style UI where Lobbi is shown live: moving, “thinking,” choosing from coin options, and taking trades. Plus live trade feed, PnL, and wallet balance.

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           LOBBI WEBSITE (Frontend)                        │
│  ASCII/pixel UI • Live Lobbi animation • Trade feed • PnL • Balance      │
│  Real-time updates (WebSocket or polling)                                 │
└───────────────────────────────────┬───────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKEND (API + optional worker)                        │
│  • Serves trades, balance, PnL, “current state” (thinking / choosing)    │
│  • Optional: aggregates events, computes PnL, stores in DB               │
└───────────────────────────────────┬───────────────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│  CLAWDBOT       │    │  PUMP.FUN           │    │  SOLANA RPC /       │
│  (Trading Agent)│    │  • Launch Lobbi     │    │  Jupiter / Raydium   │
│  • 1 SOL start  │    │  • Creator rewards  │    │  • Swap execution    │
│  • Your filters │    │    → bot wallet     │    │  • Token lists       │
│  • Buy/sell     │    │  • Bonding curve    │    │  • Price / volume    │
└─────────────────┘    └─────────────────────┘    └─────────────────────┘
```

- **Pump.fun**: Launch Lobbi; configure creator rewards to go to the **Clawdbot wallet**.
- **Clawdbot**: One Solana wallet (1 SOL seed); trades memecoins via Jupiter/Raydium; receives Pump.fun creator rewards (e.g. 0.5 SOL on bonding curve completion).
- **Backend**: Exposes API for the website (trades, balance, PnL, “Lobbi state”).
- **Website**: ASCII/pixel theme, Lobbi sprite moving/thinking/choosing/buying, live feed and stats.

---

## 2. Lobbi Memecoin (Pump.fun)

### 2.1 Launch

- **Art**: Use `lobbi.jpg` (pixel lobster) as the token image.
- **Name**: Lobbi (or Lobbi / $LOBBi as ticker).
- **Platform**: Create token on [Pump.fun](https://pump.fun) (bonding curve; no upfront deploy fee; first buyer pays).
- **Creator wallet**: Set to the **Clawdbot bot wallet** so all creator rewards go to the bot.

### 2.2 Creator Rewards → Bot

- Pump.fun pays creator rewards (e.g. 0.5 SOL when bonding curve completes and migrates to Raydium).
- By using the Clawdbot wallet as the “creator” wallet, that 0.5 SOL lands in the bot’s balance automatically.
- Optional: use Pump.fun “fee claiming” APIs (e.g. from [PumpDev](https://pumpdev.io)) to claim any other creator royalties and send to the same wallet.

**Deliverables**

- [ ] Pump.fun account; deploy Lobbi with bot wallet as creator.
- [ ] (Optional) Script or cron to claim creator fees and ensure they go to bot wallet.
- [ ] Document the Lobbi token address and Pump.fun URL for the website.

---

## 3. Clawdbot Trading Agent

### 3.1 Wallet and Funding

- **One dedicated wallet** for the bot (keypair from env or vault).
- **Initial balance**: 1 SOL (you send to this wallet before going live).
- **Ongoing**: Pump.fun creator rewards (and any claimed fees) increase the balance.

### 3.2 Filters (Your Criteria)

Define filters so the bot only considers certain memecoins. Examples (to be implemented as config):

- **Source**: Pump.fun bonding curve and/or Raydium pools (Pump.fun → Raydium migration).
- **Min liquidity / volume**: e.g. minimum SOL or USD in pool / 24h volume.
- **Age**: e.g. “listed at least N minutes” to avoid instant rugs.
- **Contract**: allowlist/blocklist of mint addresses (optional).
- **Max position size**: e.g. “use at most X% of wallet per buy” or “max 0.1 SOL per coin.”
- **Coins to consider**: e.g. “top N by volume on Pump.fun / DexScreener in last hour.”

Store these in a config file or env (e.g. `CLAWDBOT_FILTERS_JSON` or `config/filters.json`) so you can change them without code changes.

### 3.3 Trading Loop (High Level)

1. **Discover**: Fetch candidate memecoins (Pump.fun API, DexScreener, or Jupiter/Raydium) and apply your filters.
2. **Rank / choose**: Score candidates (e.g. by volume, liquidity, momentum, or simple rules). Pick one (or top one) as “the coin Lobbi is choosing.”
3. **Buy**: Use Jupiter (and/or Raydium) swap API to buy with a portion of the bot’s SOL (respecting max position size). Record: mint, amount SOL, amount tokens, timestamp, “reason” (e.g. which filter/score).
4. **Hold**: Optional hold logic (e.g. time-based or profit target or stop-loss).
5. **Sell**: Swap token back to SOL via Jupiter/Raydium. Record: sell amount, SOL received, timestamp, hold duration.
6. **Emit event**: Every buy/sell (and optionally “thinking” / “choosing”) should be stored or streamed so the backend can serve the website.

### 3.4 Data to Record per Trade (for website)

For each trade the backend (or bot) should store or expose:

- **Coin**: name/symbol if available, **contract (mint) address**.
- **Why**: short reason (e.g. “Top volume last hour”, “Passed liquidity filter”).
- **Buy**: SOL spent, token amount, timestamp.
- **Sell**: Token amount sold, SOL received, timestamp.
- **Hold time**: duration in seconds/minutes.
- **PnL**: SOL and/or USD for that trade (and cumulative).

### 3.5 Tech Stack Suggestion (Bot)

- **Runtime**: Node.js (TypeScript) or Python.
- **Solana**: `@solana/web3.js`, wallet keypair from env.
- **Swaps**: Jupiter v6 API (and/or Raydium Trade API) for swap quotes and execution.
- **Data**: Pump.fun API (e.g. PumpDev), DexScreener or Birdeye for list/volume/liquidity.
- **State**: Either bot writes to a small DB (e.g. SQLite/Postgres) or pushes to backend API; backend can also listen to wallet via RPC and derive trades.

**Deliverables**

- [ ] Wallet generation and 1 SOL funding; document address for Lobbi creator rewards.
- [ ] Config-driven filters (JSON or env).
- [ ] Discovery + filter + rank pipeline; output “current candidates” and “chosen coin.”
- [ ] Buy/sell execution with logging (mint, amounts, timestamps, reason).
- [ ] Emit or persist every trade (and optionally “thinking” / “choosing”) for the website.

---

## 4. Backend (API for Website)

### 4.1 Role

- **Single source of truth** for the website: trades, wallet balance, PnL, and “Lobbi state” (idle / thinking / choosing / bought / sold).
- Can run as a separate service or same process as the bot; bot can POST events or write to DB, and API reads from DB and/or Solana RPC.

### 4.2 Endpoints (Suggested)

- **GET /api/trades**  
  List of trades (paginated): coin, mint, why, buy amount, sell amount, hold time, PnL, timestamps.
- **GET /api/trades/latest**  
  Last N trades for “live” strip (e.g. last 10).
- **GET /api/balance**  
  Current SOL (and optionally USD) balance of the bot wallet.
- **GET /api/pnl**  
  Total PnL (SOL and/or USD), and optionally per-trade or daily.
- **GET /api/lobbi/state**  
  Current state: `idle | thinking | choosing | bought | sold`, plus optional payload (e.g. `candidateCoins[]`, `chosenMint`, `lastTxSignature`). Website uses this to drive Lobbi animation and “why it bought” text.
- **WebSocket (optional)**  
  Stream: new trade, balance update, state change (thinking → choosing → bought) so the UI updates in real time without polling.

### 4.3 Data Sources

- **Balance**: Solana RPC `getBalance(botWallet)` and optionally token accounts.
- **Trades / PnL**: From DB (bot writes after each trade) or by indexing wallet transactions and parsing swap instructions (more work).
- **Lobbi state**: Bot updates state when it starts thinking, when it has candidates, when it chooses, and when it executes buy/sell.

**Deliverables**

- [ ] API server (e.g. Node/Express or Fastify, or Python FastAPI).
- [ ] Implement above endpoints (or minimal set: trades, balance, pnl, lobbi/state).
- [ ] (Optional) WebSocket for live updates.
- [ ] (Optional) DB schema for trades and state; bot writes, API reads.

---

## 5. Website (ASCII / Pixel + Live Lobbi)

### 5.1 Aesthetic

- **ASCII / pixel style** to match `lobbi.jpg`: pixel lobster, monospace or pixel fonts, grid or terminal-like layout, limited palette (e.g. orange, white, dark background, accent for links/numbers).
- **Lobbi asset**: Use the existing pixel lobster image as the main character; optionally add ASCII variants for “thinking” or “celebrating” (e.g. `(づ｡◕‿‿◕｡)づ` or custom ASCII frames).

### 5.2 “Live Lobbi” Experience

- **States** (driven by `GET /api/lobbi/state` or WebSocket):
  - **Idle**: Lobbi standing or small idle animation.
  - **Thinking**: Lobbi with “…” or a thought bubble; optional “Scanning memecoins…” text.
  - **Choosing**: Show 3–5 candidate coins (name/symbol + mint) as options on screen; Lobbi “moves” or points toward one (highlighted).
  - **Bought**: Lobbi next to “Bought &lt;symbol&gt;” and contract address; optional confetti or simple animation.
  - **Sold**: “Sold &lt;symbol&gt; • PnL: +X.XX SOL” (or red if negative).
- **Loop**: Every N seconds (or on WebSocket event), refresh state; when state is “choosing,” show candidates for a few seconds, then switch to “bought” with the chosen coin and trade details. This gives the “watch Lobbi choose and buy” feel.

### 5.3 Main Sections (Always Visible or Tabbed)

1. **Header**
   - Logo/title “Lobbi” + pixel lobster.
   - Wallet balance (SOL, optional USD): “Claw balance: X.XX SOL” (from `/api/balance`).
2. **Live Lobbi**
   - Central area: Lobbi sprite + current state (thinking / choosing / bought / sold) and short message (e.g. “Why: Top volume on Pump.fun”).
   - When “choosing,” show the 3–5 options and which one Lobbi “picked.”
3. **Trade feed**
   - List: time, coin (name + contract address link to Solscan/DexScreener), “Why,” buy amount (SOL), sell amount (SOL), hold time, PnL (SOL and color).
   - Auto-scroll; newest at top. Data from `/api/trades` or `/api/trades/latest`.
4. **PnL**
   - Total PnL (SOL and USD if you have price); optional: today / all-time; optional simple chart (ASCII bar or small SVG).
5. **Footer**
   - Links: Lobbi on Pump.fun, Solscan bot wallet, “How it works,” etc.

### 5.4 Real-Time Updates

- **Polling**: Every 5–10 s call `/api/balance`, `/api/pnl`, `/api/lobbi/state`, `/api/trades/latest`. Simple and enough for a “live” feel.
- **WebSocket**: If you add it, subscribe to trade and state events; update Lobbi and feed immediately when a new trade or state change happens.

### 5.5 Tech Stack Suggestion (Frontend)

- **Stack**: React (or Next.js for SSR/SEO) or vanilla HTML/CSS/JS.
- **Styling**: CSS with pixel fonts (e.g. “Press Start 2P”, “VT323”), orange/white/dark theme, maybe CSS grid for alignment.
- **Lobbi**: `<img src="/lobbi.jpg">` with CSS for position/scale; state changes = different CSS class or wrapper (e.g. “lobbi--thinking” with a bounce or “…” overlay). Candidate coins as buttons or divs that get highlighted when “chosen.”
- **Contract links**: `https://solscan.io/token/<mint>` and DexScreener/Pump.fun links.

**Deliverables**

- [ ] Single-page or multi-section layout; ASCII/pixel theme; Lobbi in center.
- [ ] Integrate `/api/balance`, `/api/pnl`, `/api/lobbi/state`, `/api/trades` (or latest).
- [ ] State-driven Lobbi: idle, thinking, choosing (with 3–5 options), bought, sold.
- [ ] Trade feed with coin, contract, why, amounts, hold time, PnL.
- [ ] PnL block and wallet balance; update on interval (and WebSocket if implemented).
- [ ] Mobile-friendly layout (optional but recommended).

---

## 6. Implementation Order

1. **Setup and wallet**
   - Create bot wallet; fund with 1 SOL; document address.
2. **Lobbi token**
   - Launch Lobbi on Pump.fun with bot wallet as creator; note token address.
3. **Clawdbot (minimal)**
   - Filters config; discovery + filter + one “choose” logic; one buy (Jupiter) and one sell; log each trade to DB or file; expose “state” (thinking / choosing / bought / sold).
4. **Backend API**
   - Trades list, balance, PnL, Lobbi state; optional WebSocket.
5. **Website**
   - ASCII/pixel layout; Lobbi + state; trade feed; PnL and balance; polling (and WS if done).
6. **Polish**
   - Creator rewards verification; better filters; hold/sell logic (targets, stops); error handling and alerts.

---

## 7. Risks and Mitigations

- **Solana congestion**: Use priority fees (e.g. Jito bundles or high compute units) so bot trades land; retry logic.
- **Rugs / scams**: Filters (liquidity, age, volume) and max position size limit damage per trade.
- **Key security**: Bot keypair in env or secure vault; never in frontend or public repo.
- **Pump.fun changes**: Creator reward amount or claiming flow may change; document and optionally script fee claiming.

---

## 8. File Structure (Suggested)

```
lobbi/
├── PLAN.md                 # This file
├── lobbi.jpg               # Mascot asset
├── README.md               # How to run Lobbi + Clawdbot + site
├── config/
│   └── filters.json        # Clawdbot filters (example)
├── clawdbot/               # Trading agent
│   ├── package.json
│   ├── src/
│   │   ├── index.ts        # Main loop
│   │   ├── wallet.ts
│   │   ├── filters.ts
│   │   ├── discovery.ts
│   │   ├── trade.ts        # Buy/sell via Jupiter
│   │   └── state.ts        # Emit thinking/choosing/bought/sold
│   └── .env.example
├── backend/                # API for website
│   ├── package.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   ├── trades.ts
│   │   │   ├── balance.ts
│   │   │   ├── pnl.ts
│   │   │   └── lobbi.ts
│   │   └── db.ts           # Optional
│   └── .env.example
└── web/                    # Website
    ├── package.json
    ├── public/
    │   └── lobbi.jpg
    ├── src/
    │   ├── App.tsx
    │   ├── components/
    │   │   ├── LobbiScene.tsx   # Lobbi + state + candidates
    │   │   ├── TradeFeed.tsx
    │   │   ├── PnL.tsx
    │   │   └── Balance.tsx
    │   └── api.ts
    └── index.html
```

---

## 9. Success Criteria

- Lobbi token live on Pump.fun; creator rewards go to Clawdbot wallet.
- Clawdbot runs with your filters, starts with 1 SOL, and trades (buy/sell) with logged reason and amounts.
- Website shows Lobbi in ASCII/pixel style “taking trades” (thinking → choosing → bought/sold) and a live trade feed with contract, why, amounts, hold time, PnL.
- Wallet balance and PnL update on the site (polling or WebSocket).
- You can watch Lobbi “choose” one of several coins and buy it on the site.

If you tell me your preferred stack (e.g. Node vs Python for the bot, React vs vanilla for web), I can turn this into step-by-step tasks (e.g. “Task 1: Create `config/filters.json` and read it in the bot”) or generate starter code for one of the components (e.g. `web` or `clawdbot` or `backend`).
