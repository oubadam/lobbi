import type { TradeRecord, CandidateCoin, Filters } from "./types.js";
import { appendTrade } from "./storage.js";
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import { loadKeypair } from "./wallet.js";

const LAMPORTS_PER_SOL = 1e9;

/** Get current wallet SOL balance (for accurate PnL when wallet is linked). Returns null if no wallet/RPC. */
export async function getWalletBalanceSol(): Promise<number | null> {
  const keypair = loadKeypair();
  const rpc = process.env.SOLANA_RPC_URL;
  if (!keypair || !rpc) return null;
  try {
    const conn = new Connection(rpc);
    const lamports = await conn.getBalance(keypair.publicKey);
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return null;
  }
}

const PUMP_TRADE_URL = "https://pumpportal.fun/api/trade-local";

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

async function fetchSerializedTx(params: {
  publicKey: string;
  action: "buy" | "sell";
  mint: string;
  amount: string;
  denominatedInSol: string;
  slippage: number;
  priorityFee: number;
  pool: string;
}): Promise<ArrayBuffer> {
  const body = new URLSearchParams({
    publicKey: params.publicKey,
    action: params.action,
    mint: params.mint,
    amount: params.amount,
    denominatedInSol: params.denominatedInSol,
    slippage: String(params.slippage),
    priorityFee: String(params.priorityFee),
    pool: params.pool,
  });
  const res = await fetch(PUMP_TRADE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PumpPortal ${params.action} failed: ${res.status} ${text}`);
  }
  return res.arrayBuffer();
}

export async function executeBuy(
  candidate: CandidateCoin,
  solAmount: number,
  filters: Filters
): Promise<{ tokenAmount: number; tx?: string }> {
  const keypair = loadKeypair();
  const rpc = process.env.SOLANA_RPC_URL;
  if (!keypair || !rpc) {
    // Demo: fake numbers
    const tokenAmount = Math.floor(solAmount * 1e6 * (5000 + Math.random() * 5000));
    return { tokenAmount, tx: "demo_buy_" + genId() };
  }

  const amountLamports = Math.floor(solAmount * 1e9);
  const buf = await fetchSerializedTx({
    publicKey: keypair.publicKey.toBase58(),
    action: "buy",
    mint: candidate.mint,
    amount: String(amountLamports),
    denominatedInSol: "true",
    slippage: filters.slippagePercent ?? 15,
    priorityFee: filters.priorityFeeSol ?? 0.0001,
    pool: "auto",
  });
  const tx = VersionedTransaction.deserialize(new Uint8Array(buf));
  tx.sign([keypair]);
  const conn = new Connection(rpc);
  const sig = await conn.sendTransaction(tx, { skipPreflight: false, maxRetries: 3 });
  // Approximate token amount from SOL spent (exact would need parsing swap result)
  const tokenAmount = Math.floor(solAmount * 1e9 * 1000);
  return { tokenAmount, tx: sig };
}

export async function executeSell(
  mint: string,
  tokenAmount: number,
  filters: Filters
): Promise<{ solReceived: number; tx?: string }> {
  const keypair = loadKeypair();
  const rpc = process.env.SOLANA_RPC_URL;
  if (!keypair || !rpc) {
    return { solReceived: 0, tx: "demo_sell_" + genId() };
  }

  const buf = await fetchSerializedTx({
    publicKey: keypair.publicKey.toBase58(),
    action: "sell",
    mint,
    amount: "100%",
    denominatedInSol: "false",
    slippage: filters.slippagePercent ?? 15,
    priorityFee: filters.priorityFeeSol ?? 0.0001,
    pool: "auto",
  });
  const tx = VersionedTransaction.deserialize(new Uint8Array(buf));
  tx.sign([keypair]);
  const conn = new Connection(rpc);
  const sig = await conn.sendTransaction(tx, { skipPreflight: false, maxRetries: 3 });
  const solReceived = 0; // Would need to parse tx or get balance diff
  return { solReceived, tx: sig };
}

/** Record a buy immediately so the trade feed shows the BUY when Live Claw does. */
export function recordOpenBuy(
  symbol: string,
  name: string,
  mint: string,
  why: string,
  buySol: number,
  buyTokenAmount: number,
  buyTimestamp: string,
  txBuy?: string,
  mcapUsd?: number
): TradeRecord {
  const record: TradeRecord = {
    id: genId(),
    mint,
    symbol,
    name,
    why,
    mcapUsd,
    buySol,
    buyTokenAmount,
    buyTimestamp,
    sellSol: 0,
    sellTokenAmount: buyTokenAmount,
    sellTimestamp: "",
    holdSeconds: 0,
    pnlSol: 0,
    txBuy,
  };
  appendTrade(record);
  return record;
}

export function recordTrade(
  symbol: string,
  name: string,
  mint: string,
  why: string,
  buySol: number,
  buyTokenAmount: number,
  buyTimestamp: string,
  sellSol: number,
  sellTokenAmount: number,
  sellTimestamp: string,
  txBuy?: string,
  txSell?: string,
  mcapUsd?: number,
  mcapAtSellUsd?: number
): TradeRecord {
  const holdSeconds = Math.round(
    (new Date(sellTimestamp).getTime() - new Date(buyTimestamp).getTime()) / 1000
  );
  const pnlSol = sellSol - buySol;
  const record: TradeRecord = {
    id: genId(),
    mint,
    symbol,
    name,
    why,
    mcapUsd,
    mcapAtSellUsd,
    buySol,
    buyTokenAmount,
    buyTimestamp,
    sellSol,
    sellTokenAmount,
    sellTimestamp,
    holdSeconds,
    pnlSol,
    txBuy,
    txSell,
  };
  appendTrade(record);
  return record;
}
