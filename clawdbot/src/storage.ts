import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
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

/** Mints we bought in the last N trades (to avoid re-buying same coin). */
export function getRecentMints(lastN: number): string[] {
  const trades = loadTrades();
  return trades.slice(0, lastN).map((t) => t.mint);
}

export function appendTrade(t: TradeRecord): void {
  const all = loadTrades();
  all.unshift(t);
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
