const API = "/api";

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
}

export async function fetchTrades(): Promise<TradeRecord[]> {
  const res = await fetch(`${API}/trades`);
  const data = await res.json();
  return data.trades ?? [];
}

export async function fetchLatestTrades(limit = 10): Promise<TradeRecord[]> {
  const res = await fetch(`${API}/trades/latest?limit=${limit}`);
  const data = await res.json();
  return data.trades ?? [];
}

export async function fetchBalance(): Promise<number> {
  const res = await fetch(`${API}/balance`);
  const data = await res.json();
  return data.balanceSol ?? 0;
}

export async function fetchPnl(): Promise<{ totalPnlSol: number; tradeCount: number }> {
  const res = await fetch(`${API}/pnl`);
  const data = await res.json();
  return { totalPnlSol: data.totalPnlSol ?? 0, tradeCount: data.tradeCount ?? 0 };
}

export async function fetchLobbiState(): Promise<LobbiState | null> {
  const res = await fetch(`${API}/lobbi/state`);
  const data = await res.json();
  return data;
}
