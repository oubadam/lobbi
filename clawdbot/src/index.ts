import { config } from "dotenv";
import { existsSync } from "fs";
import { join } from "path";
const envPath = [join(process.cwd(), ".env"), join(process.cwd(), "..", ".env")].find((p) => existsSync(p));
if (envPath) config({ path: envPath });
import { loadFilters, getDataDir, DEMO_MODE, getLobbiOwnTokenMint } from "./config.js";
import { setState, getOpenTrade, getRecentMints, tryAcquireCycleLock, releaseCycleLock, clearStaleOpenTrades, updateOpenTradeToSold } from "./storage.js";
import { discoverCandidates } from "./discovery.js";
import { executeBuy, executeSell, recordOpenBuy, getWalletBalanceSol } from "./trade.js";
import { planHold, buildNarrativeWhy } from "./analysis.js";
import { getTokenPriceUsd, getTokenMcapUsd, getTokenStats, getBondingCurveSolReserves } from "./price.js";
import { getHolderStats, hasBirdeyeApiKey } from "./birdeye.js";
import {
  emitIdle,
  emitThinking,
  emitChoosing,
  emitBought,
  emitSold,
} from "./state.js";
import { getPositionWithQuote } from "./agent-api.js";
import { askLobbiShouldSell } from "./llm.js";
import type { CandidateCoin, HoldPlan, LobbiState } from "./types.js";

const HOLD_POLL_MS = 5_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

const MAX_HOLD_SECONDS = 10 * 60; // 10 min hard cap—don't hold longer

/** Hold position; Lobbi (via LLM) decides when to sell. Autonomous—no human prompt needed. */
async function holdAndSell(
  mint: string,
  symbol: string,
  buySol: number,
  tokenAmount: number,
  filters: ReturnType<typeof loadFilters>,
  _plan: HoldPlan
): Promise<void> {
  const hasLlm = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
  if (!hasLlm) {
    console.warn("[Lobbi] No ANTHROPIC_API_KEY or OPENAI_API_KEY—Lobbi cannot decide when to sell. Set one for autonomous trading.");
  }
  const ownTokenMint = getLobbiOwnTokenMint();

  while (true) {
    await sleep(HOLD_POLL_MS);
    const open = getOpenTrade();
    if (!open || open.mint !== mint) return;

    if (ownTokenMint && open.mint === ownTokenMint) continue;

    const buyTimestamp = open.buyTimestamp ? new Date(open.buyTimestamp).getTime() : Date.now();
    const holdSeconds = Math.round((Date.now() - buyTimestamp) / 1000);

    let shouldSell: boolean;
    let reason: string | undefined;

    if (holdSeconds >= MAX_HOLD_SECONDS) {
      console.log("[Lobbi] Max hold time reached (10m), forcing sell.");
      shouldSell = true;
      reason = "Max hold 10m";
    } else if (!hasLlm) {
      continue;
    } else {
      let quote: Awaited<ReturnType<typeof getPositionWithQuote>>["quote"];
      try {
        const pos = await getPositionWithQuote();
        quote = pos.quote;
      } catch (e) {
        console.warn("[Lobbi] getPositionWithQuote failed:", e);
        continue;
      }
      if (!quote) continue;

      const result = await askLobbiShouldSell(symbol, open.why ?? "", quote);
      shouldSell = result.shouldSell;
      reason = result.reason;
    }
    if (!shouldSell) continue;

    console.log("[Lobbi] Selling:", reason ?? "LLM decided");
    const balBefore = await getWalletBalanceSol();
    const res = await executeSell(mint, tokenAmount, filters);
    let solReceived = res.solReceived;
    const sellTimestamp = new Date().toISOString();
    if (solReceived <= 0 && balBefore != null) {
      await sleep(5000);
      const balAfter = await getWalletBalanceSol();
      if (balAfter != null) solReceived = Math.max(0, balAfter - balBefore);
    }
    const statsAtSell = await getTokenStats(mint);
    const mcapAtSellUsd = statsAtSell?.mcapUsd ?? (await getTokenMcapUsd(mint));
    const volumeAtSellUsd = statsAtSell?.volumeUsd;
    if (solReceived <= 0 && open.mcapUsd != null && open.mcapUsd > 0 && mcapAtSellUsd != null && mcapAtSellUsd > 0) {
      solReceived = buySol * (mcapAtSellUsd / open.mcapUsd);
    }
    if (solReceived <= 0) solReceived = buySol * 0.95;
    const whySold = reason ?? "Lobbi exit";
    updateOpenTradeToSold(solReceived, tokenAmount, sellTimestamp, res.tx, mcapAtSellUsd ?? undefined, whySold, volumeAtSellUsd);
    emitSold(mint, symbol, solReceived - buySol, res.tx);
    return;
  }
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
    const loopDelay = filters.loopDelayMs ?? 3 * 60 * 1000;
    if (loopDelay > 0) {
      console.log(`[Clawdbot] Waiting ${loopDelay / 1000}s before next buy.`);
      await sleep(loopDelay);
    }
    return;
  }

  emitIdle();
  await sleep(2000);

  emitThinking();
  await sleep(3000);

  const recentMints = new Set(getRecentMints(10));
  const ownTokenMint = getLobbiOwnTokenMint();
  if (ownTokenMint) recentMints.add(ownTokenMint);
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
  if (chosen.mint.startsWith("DemoMint") || (ownTokenMint && chosen.mint === ownTokenMint)) {
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
    if (curveSol == null && !DEMO_MODE) {
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

  const statsAtBuy = await getTokenStats(chosen.mint);
  const mcapAtBuyUsd = statsAtBuy?.mcapUsd ?? chosen.mcapUsd ?? (await getTokenMcapUsd(chosen.mint));
  const volumeAtBuyUsd = statsAtBuy?.volumeUsd ?? chosen.volumeUsd;
  const ageMinutesAtBuy =
    chosen.pairCreatedAt != null
      ? Math.round((Date.now() - chosen.pairCreatedAt) / 60000)
      : undefined;
  const narrativeWhy = buildNarrativeWhy(chosen, plan, holderStats, ageMinutesAtBuy);

  clearStaleOpenTrades();
  recordOpenBuy(
    chosen.symbol,
    chosen.name,
    chosen.mint,
    narrativeWhy,
    buySol,
    tokenAmount,
    buyTimestamp,
    txBuy,
    mcapAtBuyUsd ?? undefined,
    volumeAtBuyUsd,
    ageMinutesAtBuy
  );
  const holderCount = holderStats?.holderCount;
  const buyReason = narrativeWhy;
  emitBought(chosen.mint, chosen.symbol, txBuy, mcapAtBuyUsd ?? chosen.mcapUsd ?? undefined, holderCount, buyReason);
  await sleep(2000);

  await holdAndSell(chosen.mint, chosen.symbol, buySol, tokenAmount, filters, plan);
  emitIdle();
  const loopDelay = filters.loopDelayMs ?? 3 * 60 * 1000;
  if (loopDelay > 0) {
    console.log(`[Clawdbot] Waiting ${loopDelay / 1000}s before next buy.`);
    await sleep(loopDelay);
  }
}

async function main(): Promise<void> {
  console.log("[Clawdbot] Data dir:", getDataDir());
  console.log("[Clawdbot] Demo mode:", DEMO_MODE);
  console.log("[Clawdbot] Filters:", JSON.stringify(loadFilters(), null, 2));
  const f = loadFilters();
  console.log(
    "[Clawdbot] One position at a time. Loop delay:",
    (f.loopDelayMs ?? 180000) / 1000 + "s. Min hold:",
    f.holdMinSeconds + "s."
  );

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
