/**
 * Agent API: used by the backend when OpenClaw (or another agent) drives trading.
 * One position at a time. Agent calls getCandidates → choose → buy(mint) → later sell().
 */
import type { CandidateCoin } from "./types.js";
import { loadFilters } from "./config.js";
import { discoverCandidates } from "./discovery.js";
import { executeBuy, executeSell, recordOpenBuy, getWalletBalanceSol } from "./trade.js";
import { getState, getOpenTrade, getRecentMints, clearStaleOpenTrades, updateOpenTradeToSold } from "./storage.js";
import { emitBought, emitSold } from "./state.js";
import { getTokenPriceUsd, getTokenMcapUsd } from "./price.js";
import { planHold } from "./analysis.js";
import { getHolderStats, hasBirdeyeApiKey } from "./birdeye.js";

export interface AgentPosition {
  state: ReturnType<typeof getState>;
  openTrade: ReturnType<typeof getOpenTrade>;
}

export interface BuyParams {
  mint: string;
  symbol: string;
  name: string;
  reason?: string;
  amountSol?: number;
}

export async function getCandidates(): Promise<CandidateCoin[]> {
  const filters = loadFilters();
  const recent = new Set(getRecentMints(10));
  return discoverCandidates(filters, { excludeMints: recent, poolSize: 12 });
}

export function getPosition(): AgentPosition {
  return { state: getState(), openTrade: getOpenTrade() };
}

export async function buy(params: BuyParams): Promise<{ ok: true; symbol: string; tx?: string } | { ok: false; error: string }> {
  const open = getOpenTrade();
  if (open) {
    return { ok: false, error: `Already in position: ${open.symbol}. Sell first.` };
  }
  const filters = loadFilters();
  const amountSol = Math.min(params.amountSol ?? 0.1, filters.maxPositionSol);
  const candidate: CandidateCoin = {
    mint: params.mint,
    symbol: params.symbol,
    name: params.name,
    reason: params.reason ?? "OpenClaw agent",
    mcapUsd: undefined,
    volumeUsd: undefined,
  };
  try {
    clearStaleOpenTrades();
    const { tokenAmount, tx: txBuy } = await executeBuy(candidate, amountSol, filters);
    const buyTimestamp = new Date().toISOString();
    const mcapUsd = await getTokenMcapUsd(candidate.mint).catch(() => undefined);
    const holderStats = hasBirdeyeApiKey() ? await getHolderStats(candidate.mint) : null;
    const plan = planHold(candidate, filters, holderStats ?? undefined);
    const why = (params.reason ?? "agent") + " | hold: " + plan.reason;
    recordOpenBuy(candidate.symbol, candidate.name, candidate.mint, why, amountSol, tokenAmount, buyTimestamp, txBuy, mcapUsd ?? undefined);
    emitBought(
      candidate.mint,
      candidate.symbol,
      txBuy,
      mcapUsd ?? undefined,
      holderStats?.holderCount,
      why
    );
    return { ok: true, symbol: candidate.symbol, tx: txBuy };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function sell(): Promise<
  { ok: true; symbol: string; pnlSol: number; tx?: string } | { ok: false; error: string }
> {
  const open = getOpenTrade();
  if (!open) {
    return { ok: false, error: "No open position to sell." };
  }
  const filters = loadFilters();
  try {
    const balBefore = await getWalletBalanceSol();
    const res = await executeSell(open.mint, open.buyTokenAmount, filters);
    let solReceived = res.solReceived;
    if (solReceived <= 0 && balBefore != null) {
      await new Promise((r) => setTimeout(r, 5000));
      const balAfter = await getWalletBalanceSol();
      if (balAfter != null) solReceived = Math.max(0, balAfter - balBefore);
    }
    if (solReceived <= 0) solReceived = open.buySol * 0.95;
    const sellTimestamp = new Date().toISOString();
    const mcapAtSellUsd = await getTokenMcapUsd(open.mint).catch(() => undefined);
    updateOpenTradeToSold(solReceived, open.buyTokenAmount, sellTimestamp, res.tx, mcapAtSellUsd ?? undefined);
    const pnlSol = solReceived - open.buySol;
    emitSold(open.mint, open.symbol, pnlSol, res.tx);
    return { ok: true, symbol: open.symbol, pnlSol, tx: res.tx };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
