import { config } from "dotenv";
import { existsSync } from "fs";
import { join } from "path";
const envPath = [join(process.cwd(), ".env"), join(process.cwd(), "..", ".env")].find((p) => existsSync(p));
if (envPath) config({ path: envPath });
import express from "express";
import cors from "cors";
import { getTrades, getState, getFilters } from "./data.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT) || 4000;

// In demo mode we don't have a wallet; use mock balance that increases with PnL
function getBalance(): number {
  const trades = realTradesOnly(getTrades()).filter((t) => t.sellTimestamp);
  const totalPnl = trades.reduce((s, t) => s + t.pnlSol, 0);
  return 1 + totalPnl; // start 1 SOL + PnL
}

function realTradesOnly<T extends { mint: string }>(trades: T[]): T[] {
  return trades.filter((t) => !t.mint.startsWith("DemoMint"));
}

app.get("/api/trades", (_req, res) => {
  const trades = realTradesOnly(getTrades());
  res.json({ trades });
});

app.get("/api/trades/latest", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const trades = realTradesOnly(getTrades()).slice(0, limit);
  res.json({ trades });
});

app.get("/api/balance", (_req, res) => {
  const balance = getBalance();
  res.json({ balanceSol: balance });
});

app.get("/api/pnl", (_req, res) => {
  const trades = realTradesOnly(getTrades()).filter((t) => t.sellTimestamp);
  const totalPnlSol = trades.reduce((s, t) => s + t.pnlSol, 0);
  res.json({ totalPnlSol, tradeCount: trades.length });
});

/** Wallet balance over time for chart: [{timestamp, balanceSol}, ...] */
app.get("/api/balance/chart", (_req, res) => {
  const trades = realTradesOnly(getTrades())
    .filter((t) => t.sellTimestamp && t.sellTimestamp.length > 0)
    .sort((a, b) => new Date(a.sellTimestamp!).getTime() - new Date(b.sellTimestamp!).getTime());
  const points: { timestamp: string; balanceSol: number }[] = [];
  const startBalance = 1;
  let balance = startBalance;
  points.push({
    timestamp: trades[0]?.buyTimestamp ?? new Date().toISOString(),
    balanceSol: startBalance,
  });
  for (const t of trades) {
    balance += t.pnlSol;
    points.push({ timestamp: t.sellTimestamp!, balanceSol: balance });
  }
  res.json({ points });
});

app.get("/api/lobbi/state", (_req, res) => {
  const state = getState();
  res.json(state ?? { kind: "idle", at: new Date().toISOString() });
});

app.get("/api/filters", (_req, res) => {
  const filters = getFilters();
  res.json(filters);
});

const LOBBI_AGENT_BASE = process.env.LOBBI_AGENT_BASE_URL || "http://localhost:4000";

app.get("/api/agent/candidates", async (_req, res) => {
  try {
    const { getCandidates } = await import("clawdbot/agent");
    const candidates = await getCandidates();
    res.json({ candidates });
  } catch (e) {
    console.error("[Backend] Agent getCandidates error:", e);
    res.status(503).json({
      error: "Agent API unavailable. Build clawdbot and set DATA_DIR.",
      detail: e instanceof Error ? e.message : String(e),
    });
  }
});

app.get("/api/agent/position", async (_req, res) => {
  try {
    const { getPositionWithQuote } = await import("clawdbot/agent");
    const position = await getPositionWithQuote();
    res.json(position);
  } catch (e) {
    console.error("[Backend] Agent getPosition error:", e);
    res.status(503).json({
      error: "Agent API unavailable. Build clawdbot and set DATA_DIR.",
      detail: e instanceof Error ? e.message : String(e),
    });
  }
});

app.post("/api/agent/buy", async (req, res) => {
  try {
    const { buy: agentBuy } = await import("clawdbot/agent");
    const { mint, symbol, name, reason, amountSol } = req.body || {};
    if (!mint || !symbol || !name) {
      return res.status(400).json({ ok: false, error: "Missing mint, symbol, or name" });
    }
    const result = await agentBuy({ mint, symbol, name, reason, amountSol });
    res.json(result);
  } catch (e) {
    console.error("[Backend] Agent buy error:", e);
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
});

app.post("/api/agent/sell", async (req, res) => {
  try {
    const { sell: agentSell } = await import("clawdbot/agent");
    const result = await agentSell();
    res.json(result);
  } catch (e) {
    console.error("[Backend] Agent sell error:", e);
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
});

app.get("/api/agent/info", (_req, res) => {
  res.json({
    message: "Lobbi agent API. Use GET /api/agent/candidates, GET /api/agent/position, POST /api/agent/buy, POST /api/agent/sell. Lobbi runs on OpenClaw.",
    baseUrl: LOBBI_AGENT_BASE,
    endpoints: {
      candidates: `${LOBBI_AGENT_BASE}/api/agent/candidates`,
      position: `${LOBBI_AGENT_BASE}/api/agent/position`,
      buy: `${LOBBI_AGENT_BASE}/api/agent/buy`,
      sell: `${LOBBI_AGENT_BASE}/api/agent/sell`,
    },
  });
});

app.listen(PORT, () => {
  console.log(`[Backend] API on http://localhost:${PORT}`);
});
