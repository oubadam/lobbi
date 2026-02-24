import { loadFilters, getDataDir, DEMO_MODE } from "./config.js";
import { setState, getRecentMints, tryAcquireCycleLock, releaseCycleLock, updateOpenTradeToSold, clearStaleOpenTrades } from "./storage.js";
import { discoverCandidates } from "./discovery.js";
import { executeBuy, executeSell, recordOpenBuy } from "./trade.js";
import { planHold } from "./analysis.js";
import { getTokenPriceUsd, getTokenMcapUsd } from "./price.js";
import { getHolderStats, hasBirdeyeApiKey } from "./birdeye.js";
import {
  emitIdle,
  emitThinking,
  emitChoosing,
  emitBought,
  emitSold,
} from "./state.js";
import type { CandidateCoin, LobbiState } from "./types.js";

const LOOP_DELAY_MS = 3 * 60 * 1000;
const HOLD_POLL_MS = 10_000;
const MIN_HOLD_MS = 2 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

async function runCycle(): Promise<void> {
  if (!tryAcquireCycleLock()) {
    console.log("[Clawdbot] Another instance holds the lock or a cycle is running. Skipping. Only run one bot.");
    return;
  }
  try {
    await runCycleBody();
  } finally {
    releaseCycleLock();
  }
}

async function runCycleBody(): Promise<void> {
  const filters = loadFilters();
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
  if (chosen.mint.startsWith("DemoMint")) {
    emitIdle();
    return;
  }

  const maxAgeMs = filters.maxAgeMinutes * 60 * 1000;
  if (chosen.mcapUsd != null && (chosen.mcapUsd < filters.minMcapUsd || chosen.mcapUsd > (filters.maxMcapUsd ?? 31400))) {
    console.warn("[Clawdbot] Chosen coin mcap out of range, skipping");
    emitIdle();
    return;
  }
  if (chosen.volumeUsd != null && chosen.volumeUsd < filters.minVolumeUsd) {
    console.warn("[Clawdbot] Chosen coin volume below min, skipping");
    emitIdle();
    return;
  }
  if (chosen.pairCreatedAt != null && Date.now() - chosen.pairCreatedAt > maxAgeMs) {
    console.warn("[Clawdbot] Chosen coin too old, skipping");
    emitIdle();
    return;
  }

  const holderStats = hasBirdeyeApiKey() ? await getHolderStats(chosen.mint) : null;
  const plan = planHold(chosen, filters, holderStats);

  const buySol = Math.min(filters.maxPositionSol, 0.1);
  const { tokenAmount, tx: txBuy } = await executeBuy(chosen, buySol, filters);
  const buyTimestamp = new Date().toISOString();

  clearStaleOpenTrades();
  recordOpenBuy(
    chosen.symbol,
    chosen.name,
    chosen.mint,
    chosen.reason + " | hold: " + plan.reason,
    buySol,
    tokenAmount,
    buyTimestamp,
    txBuy,
    chosen.mcapUsd
  );
  const holderCount = holderStats?.holderCount;
  emitBought(chosen.mint, chosen.symbol, txBuy, chosen.mcapUsd ?? undefined, holderCount);
  await sleep(2000);

  let sellTimestamp = "";
  let solReceived = 0;
  let txSell: string | undefined;

  if (DEMO_MODE) {
    const buyPriceUsd = await getTokenPriceUsd(chosen.mint);
    console.log("[Clawdbot] Holding position for at least 2 min (enforced)...");
    await sleep(MIN_HOLD_MS);
    const extraMs = Math.min(
      Math.max(0, (filters.holdMaxSeconds - filters.holdMinSeconds) * 1000),
      8 * 60 * 1000
    );
    if (extraMs > 0) {
      const extra = Math.floor(extraMs * Math.random());
      console.log("[Clawdbot] Extra hold", Math.round(extra / 1000), "s");
      await sleep(extra);
    }
    const sellPriceUsd = await getTokenPriceUsd(chosen.mint);
    const res = await executeSell(chosen.mint, tokenAmount, filters);
    txSell = res.tx;
    if (buyPriceUsd != null && buyPriceUsd > 0 && sellPriceUsd != null) {
      solReceived = buySol * (sellPriceUsd / buyPriceUsd);
    } else {
      const r = Math.random();
      if (r < 0.4) solReceived = buySol * (1 + plan.takeProfitPercent / 100);
      else if (r < 0.65) solReceived = buySol * (1 + plan.stopLossPercent / 100);
      else solReceived = buySol * (0.95 + Math.random() * 0.1);
    }
    sellTimestamp = new Date().toISOString();
  } else {
    const buyPriceUsd = await getTokenPriceUsd(chosen.mint);
    const start = Date.now();
    const tpMult = 1 + plan.takeProfitPercent / 100;
    const slMult = 1 + plan.stopLossPercent / 100;
    const effectiveHoldMinMs = Math.max(plan.holdMinMs, MIN_HOLD_MS);
    let sold = false;

    while (Date.now() - start < plan.holdMaxMs) {
      await sleep(HOLD_POLL_MS);
      const elapsed = Date.now() - start;
      if (elapsed < effectiveHoldMinMs) continue;

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
    if (solReceived === 0 && buyPriceUsd != null && buyPriceUsd > 0) {
      const sellPriceUsd = await getTokenPriceUsd(chosen.mint);
      if (sellPriceUsd != null) solReceived = buySol * (sellPriceUsd / buyPriceUsd);
    }
  }

  if (!sellTimestamp) {
    const res = await executeSell(chosen.mint, tokenAmount, filters);
    sellTimestamp = new Date().toISOString();
    solReceived = res.solReceived;
    txSell = res.tx;
  }

  const mcapAtSellUsd = await getTokenMcapUsd(chosen.mint);

  updateOpenTradeToSold(
    solReceived,
    tokenAmount,
    sellTimestamp,
    txSell,
    mcapAtSellUsd ?? undefined
  );

  emitSold(chosen.mint, chosen.symbol, solReceived - buySol, txSell);
  await sleep(1000);
  emitIdle();
  console.log("[Clawdbot] Waiting 3 min before next buy (lock held — one position at a time).");
  await sleep(LOOP_DELAY_MS);
}

async function main(): Promise<void> {
  console.log("[Clawdbot] Data dir:", getDataDir());
  console.log("[Clawdbot] Demo mode:", DEMO_MODE);
  console.log("[Clawdbot] Filters:", JSON.stringify(loadFilters(), null, 2));
  console.log("[Clawdbot] One position at a time. Loop delay: 3 min after each sell. Min hold: 2 min.");

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
      releaseCycleLock();
    }
  }
}

main();
