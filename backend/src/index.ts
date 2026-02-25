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

app.get("/api/lobbi/state", (_req, res) => {
  const state = getState();
  res.json(state ?? { kind: "idle", at: new Date().toISOString() });
});

app.get("/api/filters", (_req, res) => {
  const filters = getFilters();
  res.json(filters);
});

app.listen(PORT, () => {
  console.log(`[Backend] API on http://localhost:${PORT}`);
});
