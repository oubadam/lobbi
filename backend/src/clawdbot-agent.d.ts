declare module "clawdbot/agent" {
  export interface AgentPosition {
    state: { kind: string; chosenSymbol?: string; chosenMint?: string } | null;
    openTrade: {
      mint: string;
      symbol: string;
      buySol: number;
      buyTokenAmount: number;
    } | null;
  }
  export interface BuyParams {
    mint: string;
    symbol: string;
    name: string;
    reason?: string;
    amountSol?: number;
  }
  export function getCandidates(): Promise<Array<{ mint: string; symbol: string; name: string; reason: string; mcapUsd?: number; volumeUsd?: number }>>;
  export function getPosition(): AgentPosition;
  export function getPositionWithQuote(): Promise<AgentPosition & { quote?: { currentPriceUsd: number | null; unrealizedPnlPercent: number | null; unrealizedPnlSol: number | null; holdSeconds: number } }>;
  export function buy(params: BuyParams): Promise<
    | { ok: true; symbol: string; tx?: string }
    | { ok: false; error: string }
  >;
  export function sell(): Promise<
    | { ok: true; symbol: string; pnlSol: number; tx?: string }
    | { ok: false; error: string }
  >;
  export function getWalletBalanceSol(): Promise<number | null>;
}


// test