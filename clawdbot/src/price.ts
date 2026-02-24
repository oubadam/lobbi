const DEXSCREENER = "https://api.dexscreener.com/latest/dex";

interface Pair {
  baseToken?: { address: string };
  priceUsd?: string;
  priceNative?: string;
  fdv?: number;
  marketCap?: number;
}

/**
 * Fetch current token price in USD (or SOL) from DexScreener token-pairs.
 */
export async function getTokenPriceUsd(mint: string): Promise<number | null> {
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
