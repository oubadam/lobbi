import { getTokenPriceUsdBirdeye, hasBirdeyeApiKey } from "./birdeye.js";

const DEXSCREENER = "https://api.dexscreener.com/latest/dex";
const PUMP_BONDING_API = "https://api.pumpfunapis.com/api/bonding-curve";
const LAMPORTS_PER_SOL = 1e9;

interface Pair {
  baseToken?: { address: string };
  priceUsd?: string;
  priceNative?: string;
  fdv?: number;
  marketCap?: number;
}

async function getTokenPriceUsdDexScreener(mint: string): Promise<number | null> {
  try {
    const res = await fetch(`${DEXSCREENER}/token-pairs/v1/solana/${mint}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { pairs?: Pair[] };
    const pairs = data?.pairs ?? [];
    const p = pairs[0];
    if (!p?.priceUsd) return null;
    return parseFloat(p.priceUsd);
  } catch {
    return null;
  }
}

/**
 * Fetch current token price in USD. Tries Birdeye first (more accurate) if BIRDEYE_API_KEY is set, else DexScreener.
 */
export async function getTokenPriceUsd(mint: string): Promise<number | null> {
  if (hasBirdeyeApiKey()) {
    const p = await getTokenPriceUsdBirdeye(mint);
    if (p != null && p > 0) return p;
  }
  return getTokenPriceUsdDexScreener(mint);
}

/** Fetch current token mcap (FDV) in USD from DexScreener. */
export async function getTokenMcapUsd(mint: string): Promise<number | null> {
  try {
    const res = await fetch(`${DEXSCREENER}/token-pairs/v1/solana/${mint}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { pairs?: Pair[] };
    const pairs = data?.pairs ?? [];
    const p = pairs[0];
    const mcap = p?.fdv ?? p?.marketCap;
    if (mcap == null) return null;
    return typeof mcap === "number" ? mcap : parseFloat(String(mcap));
  } catch {
    return null;
  }
}

/**
 * SOL per 1 USD (approximate for display). As of 2025, SOL ~$76.6 USD.
 * $31.4k mcap ≈ 31400 / 76.6 ≈ 410 SOL.
 */
const SOL_PRICE_USD = 76.6;
const SOL_PER_USD_APPROX = 1 / SOL_PRICE_USD;

export function usdToSolApprox(usd: number): number {
  return usd * SOL_PER_USD_APPROX;
}

export function getSolPriceUsd(): number {
  return SOL_PRICE_USD;
}

/**
 * Fetch bonding curve real SOL reserves for a pump.fun token (proxy for "global fees paid" / activity).
 * Returns SOL amount or null if not a pump token or API fails.
 */
export async function getBondingCurveSolReserves(mint: string): Promise<number | null> {
  if (!mint || !mint.endsWith("pump")) return null;
  try {
    const res = await fetch(`${PUMP_BONDING_API}/${mint}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { real_sol_reserves?: number; realSolReserves?: number };
    const lamports = data?.real_sol_reserves ?? data?.realSolReserves;
    if (lamports == null) return null;
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return null;
  }
}
