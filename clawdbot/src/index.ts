import { loadFilters, getDataDir, DEMO_MODE } from "./config.js";
import { setState, getRecentMints, tryAcquireCycleLock, releaseCycleLock } from "./storage.js";
import { discoverCandidates } from "./discovery.js";
import { executeBuy, executeSell, recordTrade } from "./trade.js";
import { planHold } from "./analysis.js";
import { getTokenPriceUsd } from "./price.js";
import { getHolderStats, hasBirdeyeApiKey } from "./birdeye.js";
import {
  emitIdle,
  emitThinking,
  emitChoosing,
  emitBought,
  emitSold,
} from "./state.js";
import type { CandidateCoin, LobbiState } from "./types.js";

const filters = loadFilters();
const LOOP_DELAY_MS = 3 * 60 * 1000;
const HOLD_POLL_MS = 10_000;
/** Demo: min hold so we don't sell in 8s. */
const DEMO_HOLD_MIN_MS = 90_000;
/** Demo: max hold (3 min). */
const DEMO_HOLD_CAP_MS = 180_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

async function runCycle(): Promise<void> {
  if (!tryAcquireCycleLock()) {
    return;
  }
  try {
    await runCycleBody();
  } finally {
    releaseCycleLock();
  }
}

async function runCycleBody(): Promise<void> {
  emitIdle();
  await sleep(2000);

  emitThinking();
  await sleep(3000);

  const recentMints = new Set(getRecentMints(10));
  const candidates = await discoverCandidates(filters, {
    excludeMints: recentMints,
    poolSize: 12,
  });
  if (candidates.length === 0) {
    emitIdle();
    return;
  }

  emitChoosing(candidates);
  await sleep(1000);

  const chosen = pickOne(candidates);
  const holderStats = hasBirdeyeApiKey() ? await getHolderStats(chosen.mint) : null;
  const plan = planHold(chosen, filters, holderStats);

  const buySol = Math.min(filters.maxPositionSol, 0.1);
  const { tokenAmount, tx: txBuy } = await executeBuy(chosen, buySol, filters);
  const buyTimestamp = new Date().toISOString();

  emitBought(chosen.mint, chosen.symbol, txBuy);
  await sleep(2000);

  let sellTimestamp = "";
  let solReceived = 0;
  let txSell: string | undefined;

  if (DEMO_MODE) {
    const holdMs =
      DEMO_HOLD_MIN_MS +
      Math.random() * (DEMO_HOLD_CAP_MS - DEMO_HOLD_MIN_MS);
    await sleep(holdMs);
    const res = await executeSell(chosen.mint, tokenAmount, filters);
    txSell = res.tx;
    const r = Math.random();
    if (r < 0.4) {
      solReceived = buySol * (1 + plan.takeProfitPercent / 100);
    } else if (r < 0.65) {
      solReceived = buySol * (1 + plan.stopLossPercent / 100);
    } else {
      solReceived = buySol * (0.95 + Math.random() * 0.1);
    }
    sellTimestamp = new Date().toISOString();
  } else {
    const buyPriceUsd = await getTokenPriceUsd(chosen.mint);
    const start = Date.now();
    const tpMult = 1 + plan.takeProfitPercent / 100;
    const slMult = 1 + plan.stopLossPercent / 100;
    let sold = false;

    while (Date.now() - start < plan.holdMaxMs) {
      await sleep(HOLD_POLL_MS);
      const elapsed = Date.now() - start;
      if (elapsed < plan.holdMinMs) continue;

      const priceUsd = await getTokenPriceUsd(chosen.mint);
      if (priceUsd != null && buyPriceUsd != null && buyPriceUsd > 0) {
        if (priceUsd >= buyPriceUsd * tpMult) {
          const res = await executeSell(chosen.mint, tokenAmount, filters);
          sellTimestamp = new Date().toISOString();
          solReceived = res.solReceived;
          txSell = res.tx;
          sold = true;
          break;
        }
        if (priceUsd <= buyPriceUsd * slMult) {
          const res = await executeSell(chosen.mint, tokenAmount, filters);
          sellTimestamp = new Date().toISOString();
          solReceived = res.solReceived;
          txSell = res.tx;
          sold = true;
          break;
        }
      }
      if (elapsed >= plan.holdMaxMs) break;
    }

    if (!sold) {
      const res = await executeSell(chosen.mint, tokenAmount, filters);
      sellTimestamp = new Date().toISOString();
      solReceived = res.solReceived;
      txSell = res.tx;
    }
  }

  if (!sellTimestamp) {
    const res = await executeSell(chosen.mint, tokenAmount, filters);
    sellTimestamp = new Date().toISOString();
    solReceived = res.solReceived;
    txSell = res.tx;
  }

  recordTrade(
    chosen.symbol,
    chosen.name,
    chosen.mint,
    chosen.reason + " | hold: " + plan.reason,
    buySol,
    tokenAmount,
    buyTimestamp,
    solReceived,
    tokenAmount,
    sellTimestamp,
    txBuy,
    txSell
  );

  emitSold(chosen.mint, chosen.symbol, solReceived - buySol, txSell);
  await sleep(3000);
}

async function main(): Promise<void> {
  console.log("[Clawdbot] Data dir:", getDataDir());
  console.log("[Clawdbot] Demo mode:", DEMO_MODE);
  console.log("[Clawdbot] Filters:", JSON.stringify(filters, null, 2));

  setState({
    kind: "idle",
    at: new Date().toISOString(),
  } as LobbiState);

  while (true) {
    try {
      await runCycle();
    } catch (e) {
      console.error("[Clawdbot] Cycle error:", e);
      emitIdle();
    }
    await sleep(LOOP_DELAY_MS);
  }
}

main();
