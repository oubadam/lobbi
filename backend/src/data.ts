import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

function findRoot(): string {
  const d = dirname(fileURLToPath(import.meta.url));
  let root = join(d, "..", "..");
  if (!existsSync(join(root, "data")) && existsSync(join(root, "..", "data"))) {
    root = join(root, "..");
  }
  if (!existsSync(join(root, "config")) && existsSync(join(root, "..", "config"))) {
    root = join(root, "..");
  }
  return root;
}
const root = process.env.DATA_DIR ? join(process.env.DATA_DIR, "..") : findRoot();
const dataDir = process.env.DATA_DIR || join(root, "data");
const TRADES_FILE = "trades.json";
const STATE_FILE = "state.json";

function readJson<T>(filename: string, fallback: T): T {
  const p = join(dataDir, filename);
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export interface TradeRecord {
  id: string;
  mint: string;
  symbol: string;
  name: string;
  why: string;
  buySol: number;
  buyTokenAmount: number;
  buyTimestamp: string;
  sellSol: number;
  sellTokenAmount: number;
  sellTimestamp: string;
  holdSeconds: number;
  pnlSol: number;
  txBuy?: string;
  txSell?: string;
}

export interface CandidateCoin {
  mint: string;
  symbol: string;
  name: string;
  reason: string;
  volumeUsd?: number;
  mcapUsd?: number;
  pairCreatedAt?: number;
}

export type LobbiStateKind = "idle" | "thinking" | "choosing" | "bought" | "sold";

export interface LobbiState {
  kind: LobbiStateKind;
  at: string;
  message?: string;
  candidateCoins?: CandidateCoin[];
  chosenMint?: string;
  chosenSymbol?: string;
  lastTx?: string;
}

export function getTrades(): TradeRecord[] {
  return readJson<TradeRecord[]>(TRADES_FILE, []);
}

export function getState(): LobbiState | null {
  return readJson<LobbiState | null>(STATE_FILE, null);
}
