# Lobbi Trading Skill for OpenClaw

This skill lets **Lobbi** trade Solana memecoins via the Lobbi backend. Lobbi is the AI agent, powered by [OpenClaw](https://openclaw.ai). Lobbi decides which coin to buy and when to sell.

## Setup

1. **Install OpenClaw** (if you haven’t):  
   [Getting started](https://docs.openclaw.ai/start/getting-started) — e.g. `npm i -g openclaw@latest` then `openclaw onboard`.

2. **Run Lobbi backend with agent API** (same repo):
   - Build clawdbot and backend, and set `DATA_DIR` so they share the same data folder:
     ```bash
     cd /path/to/lobbi
     npm run build
     DATA_DIR=./data node backend/dist/index.js
     ```
   - Or from repo root: `npm run dev:backend` (uses `DATA_DIR=../data`). Ensure clawdbot is built: `npm run build --prefix clawdbot`.

3. **Install the skill into your OpenClaw workspace**:
   - Copy this folder into your OpenClaw skills directory:
     ```bash
     cp -r /path/to/lobbi/openclaw-skill ~/.openclaw/workspace/skills/lobbi-trading
     ```
   - Or symlink:
     ```bash
     ln -s /path/to/lobbi/openclaw-skill ~/.openclaw/workspace/skills/lobbi-trading
     ```

4. **Refresh skills**: Ask OpenClaw to “refresh skills” or restart the gateway. Lobbi will then have the Lobbi trading skill and can use the `http` tool to call the backend.

5. **Optional**: Set `LOBBI_AGENT_BASE_URL` if the backend is not on `http://localhost:4000` (e.g. on another host or port). The skill instructions tell the agent to use that env or default to localhost:4000.

## Usage

- **“Get Lobbi candidates”** / **“What can Lobbi buy?”** — Lobbi calls `GET /api/agent/candidates` and shows you the list.
- **“Buy a Lobbi coin”** / **“Use Lobbi to buy one of the candidates”** — Lobbi gets candidates, picks one (with a reason), then calls `POST /api/agent/buy` with that coin’s mint, symbol, name and reason.
- **“Sell Lobbi position”** / **“Close Lobbi trade”** — Lobbi calls `POST /api/agent/sell`.
- **“Lobbi status”** / **“Do we have a Lobbi position?”** — Lobbi calls `GET /api/agent/position`.

One position at a time. When using this skill, **do not** run the standalone clawdbot loop (`npm run dev:bot`); only the Lobbi (via OpenClaw) should drive trades so they don’t conflict.
