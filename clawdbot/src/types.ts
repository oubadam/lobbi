export interface Filters {
  minVolumeUsd: number;
  minMcapUsd: number;
  maxMcapUsd: number;
  minGlobalFeesPaidSol: number;
  maxAgeMinutes: number;
  maxPositionSol: number;
  maxPositionPercent: number;
  maxCandidates: number;
  holdMinSeconds: number;
  holdMaxSeconds: number;
  takeProfitPercent: number;
  stopLossPercent: number;
  slippagePercent: number;
  priorityFeeSol: number;
}

export interface HoldPlan {
  holdMinMs: number;
  holdMaxMs: number;
  takeProfitPercent: number;
  stopLossPercent: number;
  reason: string;
}

export interface CandidateCoin {
  mint: string;
  symbol: string;
  name: string;
  reason: string;
  volumeUsd?: number;
  mcapUsd?: number;
  pairCreatedAt?: number;
  globalFeesPaidSol?: number;
  liquidityUsd?: number;
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
