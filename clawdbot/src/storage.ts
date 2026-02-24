import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import type { TradeRecord, LobbiState } from "./types.js";
import { getDataDir } from "./config.js";

function dataPath(file: string): string {
  const dir = getDataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, file);
}

const TRADES_FILE = "trades.json";
const STATE_FILE = "state.json";
const CYCLE_LOCK_FILE = ".cycle-lock";
const LOCK_MAX_AGE_MS = 15 * 60 * 1000;

let tradesCache: TradeRecord[] = [];
let stateCache: LobbiState | null = null;

function loadTrades(): TradeRecord[] {
  const p = dataPath(TRADES_FILE);
  if (!existsSync(p)) return [];
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return [];
  }
}

function loadState(): LobbiState | null {
  const p = dataPath(STATE_FILE);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

export function getTrades(): TradeRecord[] {
  tradesCache = loadTrades();
  return tradesCache;
}

/** Mints we bought in the last N closed trades (to avoid re-buying same coin). */
export function getRecentMints(lastN: number): string[] {
  const trades = loadTrades();
  const closed = trades.filter((t) => t.sellTimestamp && t.sellTimestamp !== "");
  return closed.slice(0, lastN).map((t) => t.mint);
}

export function appendTrade(t: TradeRecord): void {
  const all = loadTrades();
  all.unshift(t);
  writeFileSync(dataPath(TRADES_FILE), JSON.stringify(all, null, 2));
  tradesCache = all;
}

/** Remove any open (unclosed) trades so we never have more than one. Call before recording a new buy. */
export function clearStaleOpenTrades(): void {
  const all = loadTrades();
  const closedOnly = all.filter((t) => t.sellTimestamp && t.sellTimestamp !== "");
  if (closedOnly.length === all.length) return;
  writeFileSync(dataPath(TRADES_FILE), JSON.stringify(closedOnly, null, 2));
  tradesCache = closedOnly;
}

/** Update the current open position (first trade with no sell) with sell data. Only one open at a time. */
export function updateOpenTradeToSold(
  sellSol: number,
  sellTokenAmount: number,
  sellTimestamp: string,
  txSell?: string,
  mcapAtSellUsd?: number
): void {
  const all = loadTrades();
  const idx = all.findIndex((t) => !t.sellTimestamp || t.sellTimestamp === "");
  if (idx === -1) return;
  const t = all[idx]!;
  t.sellSol = sellSol;
  t.sellTokenAmount = sellTokenAmount;
  t.sellTimestamp = sellTimestamp;
  t.txSell = txSell;
  t.mcapAtSellUsd = mcapAtSellUsd;
  t.holdSeconds = Math.round((new Date(sellTimestamp).getTime() - new Date(t.buyTimestamp).getTime()) / 1000);
  t.pnlSol = sellSol - t.buySol;
  writeFileSync(dataPath(TRADES_FILE), JSON.stringify(all, null, 2));
  tradesCache = all;
}

export function getState(): LobbiState | null {
  stateCache = loadState();
  return stateCache;
}

export function setState(s: LobbiState): void {
  writeFileSync(dataPath(STATE_FILE), JSON.stringify(s, null, 2));
  stateCache = s;
}

/** Try to acquire lock so only one cycle runs at a time (avoid same coin bought twice by two processes). */
export function tryAcquireCycleLock(): boolean {
  const p = dataPath(CYCLE_LOCK_FILE);
  if (existsSync(p)) {
    try {
      const data = JSON.parse(readFileSync(p, "utf-8")) as { at: string };
      const age = Date.now() - new Date(data.at).getTime();
      if (age < LOCK_MAX_AGE_MS) return false;
    } catch {
      /* stale or invalid, remove and take lock */
    }
    try {
      unlinkSync(p);
    } catch {
      /* ignore */
    }
  }
  try {
    writeFileSync(p, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

export function releaseCycleLock(): void {
  try {
    unlinkSync(dataPath(CYCLE_LOCK_FILE));
  } catch {
    /* ignore */
  }
}
