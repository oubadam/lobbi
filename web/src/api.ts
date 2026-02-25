const API = "/api";

async function apiFetch(path: string): Promise<Response> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) {
    const text = await res.text();
    let msg = `API ${path}: ${res.status}`;
    try {
      const j = JSON.parse(text);
      if (j?.error) msg = j.error;
      else if (j?.message) msg = j.message;
    } catch {
      if (text) msg += " " + text.slice(0, 200);
    }
    throw new Error(msg);
  }
  return res;
}

export interface TradeRecord {
  id: string;
  mint: string;
  symbol: string;
  name: string;
  why: string;
  mcapUsd?: number;
  mcapAtSellUsd?: number;
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
  chosenMcapUsd?: number;
  chosenHolderCount?: number;
  chosenReason?: string;
}

export async function fetchTrades(): Promise<TradeRecord[]> {
  const res = await apiFetch("/trades");
  const data = await res.json();
  return data.trades ?? [];
}

export async function fetchLatestTrades(limit = 10): Promise<TradeRecord[]> {
  const res = await apiFetch(`/trades/latest?limit=${limit}`);
  const data = await res.json();
  return data.trades ?? [];
}

export async function fetchBalance(): Promise<number> {
  const res = await apiFetch("/balance");
  const data = await res.json();
  return data.balanceSol ?? 0;
}

export async function fetchPnl(): Promise<{ totalPnlSol: number; tradeCount: number }> {
  const res = await apiFetch("/pnl");
  const data = await res.json();
  return { totalPnlSol: data.totalPnlSol ?? 0, tradeCount: data.tradeCount ?? 0 };
}

export async function fetchLobbiState(): Promise<LobbiState | null> {
  const res = await apiFetch("/lobbi/state");
  const data = await res.json();
  return data;
}

export interface FiltersConfig {
  minVolumeUsd?: number;
  minMcapUsd?: number;
  maxMcapUsd?: number;
  minGlobalFeesPaidSol?: number;
  maxAgeMinutes?: number;
  holdMinSeconds?: number;
  holdMaxSeconds?: number;
  takeProfitPercent?: number;
  stopLossPercent?: number;
}

export async function fetchFilters(): Promise<FiltersConfig> {
  const res = await apiFetch("/filters");
  return res.json();
}
