import { config } from "dotenv";
import { existsSync } from "fs";
import { join } from "path";
const envPath = [join(process.cwd(), ".env"), join(process.cwd(), "..", ".env")].find((p) => existsSync(p));
if (envPath) config({ path: envPath });
import { loadFilters, getDataDir, DEMO_MODE } from "./config.js";
import { setState, getOpenTrade, getRecentMints, tryAcquireCycleLock, releaseCycleLock, updateOpenTradeToSold, clearStaleOpenTrades } from "./storage.js";
import { discoverCandidates } from "./discovery.js";
import { executeBuy, executeSell, recordOpenBuy, getWalletBalanceSol } from "./trade.js";
import { planHold } from "./analysis.js";
import { getTokenPriceUsd, getTokenMcapUsd, getBondingCurveSolReserves } from "./price.js";
import { getHolderStats, hasBirdeyeApiKey } from "./birdeye.js";
import {
  emitIdle,
  emitThinking,
  emitChoosing,
  emitBought,
  emitSold,
} from "./state.js";
import type { CandidateCoin, HoldPlan, LobbiState } from "./types.js";

const LOOP_DELAY_MS = 3 * 60 * 1000;
const HOLD_POLL_MS = 5_000;
const MIN_HOLD_MS = 2 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

async function holdAndSell(
  mint: string,
  symbol: string,
  buySol: number,
  tokenAmount: number,
  filters: ReturnType<typeof loadFilters>,
  plan: HoldPlan
): Promise<void> {
  let sellTimestamp = "";
  let solReceived = 0;
  let txSell: string | undefined;
  let buyPriceUsd: number | null = null;

  if (DEMO_MODE) {
    buyPriceUsd = await getTokenPriceUsd(mint);
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
    let sellPriceUsd = await getTokenPriceUsd(mint);
    if (sellPriceUsd == null) {
      await sleep(2000);
      sellPriceUsd = await getTokenPriceUsd(mint) ?? null;
    }
    const res = await executeSell(mint, tokenAmount, filters);
    txSell = res.tx;
    if (buyPriceUsd != null && buyPriceUsd > 0 && sellPriceUsd != null) {
      solReceived = buySol * (sellPriceUsd / buyPriceUsd);
    } else {
      solReceived = buySol * 0.95;
    }
    sellTimestamp = new Date().toISOString();
  } else {
    buyPriceUsd = await getTokenPriceUsd(mint);
    const start = Date.now();
    const tpMult = 1 + plan.takeProfitPercent / 100;
    const slMult = 1 + plan.stopLossPercent / 100;
    const effectiveHoldMinMs = Math.max(plan.holdMinMs, MIN_HOLD_MS);
    let sold = false;

    while (Date.now() - start < plan.holdMaxMs) {
      await sleep(HOLD_POLL_MS);
      const elapsed = Date.now() - start;
      if (elapsed < effectiveHoldMinMs) continue;

      const priceUsd = await getTokenPriceUsd(mint);
      if (priceUsd != null && buyPriceUsd != null && buyPriceUsd > 0) {
        if (priceUsd >= buyPriceUsd * tpMult) {
          const balBefore = await getWalletBalanceSol();
          const res = await executeSell(mint, tokenAmount, filters);
          sellTimestamp = new Date().toISOString();
          txSell = res.tx;
          if (res.solReceived <= 0 && balBefore != null) {
            await sleep(5000);
            const balAfter = await getWalletBalanceSol();
            if (balAfter != null) solReceived = Math.max(0, balAfter - balBefore);
          } else {
            solReceived = res.solReceived;
          }
          sold = true;
          break;
        }
        if (priceUsd <= buyPriceUsd * slMult) {
          const balBefore = await getWalletBalanceSol();
          const res = await executeSell(mint, tokenAmount, filters);
          sellTimestamp = new Date().toISOString();
          txSell = res.tx;
          if (res.solReceived <= 0 && balBefore != null) {
            await sleep(5000);
            const balAfter = await getWalletBalanceSol();
            if (balAfter != null) solReceived = Math.max(0, balAfter - balBefore);
          } else {
            solReceived = res.solReceived;
          }
          sold = true;
          break;
        }
      }
      if (Date.now() - start >= plan.holdMaxMs) break;
    }

    if (!sold) {
      const balBefore = await getWalletBalanceSol();
      const res = await executeSell(mint, tokenAmount, filters);
      sellTimestamp = new Date().toISOString();
      txSell = res.tx;
      if (res.solReceived <= 0 && balBefore != null) {
        await sleep(5000);
        const balAfter = await getWalletBalanceSol();
        if (balAfter != null) solReceived = Math.max(0, balAfter - balBefore);
      } else {
        solReceived = res.solReceived;
      }
    }
    if (solReceived <= 0 && buyPriceUsd != null && buyPriceUsd > 0) {
      const sellPriceUsd = await getTokenPriceUsd(mint);
      if (sellPriceUsd != null) solReceived = buySol * (sellPriceUsd / buyPriceUsd);
    }
  }

  if (!sellTimestamp) {
    const balBefore = await getWalletBalanceSol();
    const res = await executeSell(mint, tokenAmount, filters);
    sellTimestamp = new Date().toISOString();
    txSell = res.tx;
    if (res.solReceived <= 0 && balBefore != null) {
      await sleep(5000);
      const balAfter = await getWalletBalanceSol();
      if (balAfter != null) solReceived = Math.max(0, balAfter - balBefore);
    } else {
      solReceived = res.solReceived;
    }
  }
  if (solReceived <= 0 && buyPriceUsd != null && buyPriceUsd > 0) {
    const sellPriceUsdNow = await getTokenPriceUsd(mint);
    if (sellPriceUsdNow != null) solReceived = buySol * (sellPriceUsdNow / buyPriceUsd);
  }
  const mcapAtSellUsd = await getTokenMcapUsd(mint);
  if (solReceived <= 0) {
    const open = getOpenTrade();
    if (open?.mcapUsd != null && open.mcapUsd > 0 && mcapAtSellUsd != null && mcapAtSellUsd > 0) {
      solReceived = buySol * (mcapAtSellUsd / open.mcapUsd);
    }
  }
  if (solReceived <= 0) solReceived = buySol * 0.95;
  updateOpenTradeToSold(solReceived, tokenAmount, sellTimestamp, txSell, mcapAtSellUsd ?? undefined);
  emitSold(mint, symbol, solReceived - buySol, txSell);
  await sleep(8000);
}

const LOCK_RETRY_MS = 30_000; // 30s backoff when another instance holds lock

async function runCycle(): Promise<void> {
  if (!tryAcquireCycleLock()) {
    console.log("[Clawdbot] Another instance holds the lock or a cycle is running. Skipping. Retrying in 30s.");
    await sleep(LOCK_RETRY_MS);
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

  const open = getOpenTrade();
  if (open) {
    setState({
      kind: "bought",
      at: new Date().toISOString(),
      message: `Bought ${open.symbol}`,
      chosenMint: open.mint,
      chosenSymbol: open.symbol,
      chosenMcapUsd: open.mcapUsd,
      chosenReason: open.why,
    } as LobbiState);
    const resumePlan: HoldPlan = {
      holdMinMs: filters.holdMinSeconds * 1000,
      holdMaxMs: filters.holdMaxSeconds * 1000,
      takeProfitPercent: filters.takeProfitPercent,
      stopLossPercent: filters.stopLossPercent,
      reason: "resumed",
    };
    await holdAndSell(open.mint, open.symbol, open.buySol, open.buyTokenAmount, filters, resumePlan);
    emitIdle();
    console.log("[Clawdbot] Waiting 3 min before next buy.");
    await sleep(LOOP_DELAY_MS);
    return;
  }

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
    console.log("[Clawdbot] No candidates found this cycle (filters: ≤1h old, mcap $10k–$31.4k, min vol $12k). Retrying next cycle.");
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
  const minFeesSol = filters.minGlobalFeesPaidSol ?? 0.8;
  if (chosen.mint.endsWith("pump")) {
    const curveSol = await getBondingCurveSolReserves(chosen.mint);
    if (curveSol != null && curveSol < minFeesSol) {
      console.warn("[Clawdbot] Chosen coin bonding curve SOL", curveSol.toFixed(2), "< min", minFeesSol, "SOL, skipping");
      emitIdle();
      return;
    }
    if (curveSol == null) {
      console.warn("[Clawdbot] Could not fetch bonding curve for", chosen.symbol, ", skipping (require min 0.8 SOL fees)");
      emitIdle();
      return;
    }
  }
  if (chosen.globalFeesPaidSol != null && chosen.globalFeesPaidSol < minFeesSol) {
    console.warn("[Clawdbot] Chosen coin below min global fees paid (0.8 SOL), skipping");
    emitIdle();
    return;
  }

  const holderStats = hasBirdeyeApiKey() ? await getHolderStats(chosen.mint) : null;
  const plan = planHold(chosen, filters, holderStats);

  const buySol = Math.min(filters.maxPositionSol, 0.1);
  const { tokenAmount, tx: txBuy } = await executeBuy(chosen, buySol, filters);
  const buyTimestamp = new Date().toISOString();

  const mcapAtBuyUsd = await getTokenMcapUsd(chosen.mint);
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
    mcapAtBuyUsd ?? chosen.mcapUsd
  );
  const holderCount = holderStats?.holderCount;
  const buyReason = chosen.reason + " | hold: " + plan.reason;
  emitBought(chosen.mint, chosen.symbol, txBuy, mcapAtBuyUsd ?? chosen.mcapUsd ?? undefined, holderCount, buyReason);
  await sleep(2000);

  await holdAndSell(chosen.mint, chosen.symbol, buySol, tokenAmount, filters, plan);
  emitIdle();
  console.log("[Clawdbot] Waiting 3 min before next buy (lock held — one position at a time).");
  await sleep(LOOP_DELAY_MS);
}

async function main(): Promise<void> {
  console.log("[Clawdbot] Data dir:", getDataDir());
  console.log("[Clawdbot] Demo mode:", DEMO_MODE);
  console.log("[Clawdbot] Filters:", JSON.stringify(loadFilters(), null, 2));
  console.log("[Clawdbot] One position at a time. Loop delay: 3 min after each sell. Min hold: 2 min.");

  const open = getOpenTrade();
  if (open) {
    setState({
      kind: "bought",
      at: new Date().toISOString(),
      message: `Bought ${open.symbol}`,
      chosenMint: open.mint,
      chosenSymbol: open.symbol,
      chosenMcapUsd: open.mcapUsd,
      chosenReason: open.why,
    } as LobbiState);
    console.log("[Clawdbot] Resuming open position:", open.symbol);
  } else {
    setState({ kind: "idle", at: new Date().toISOString() } as LobbiState);
  }

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
