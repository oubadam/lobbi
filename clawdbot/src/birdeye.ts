const BIRDEYE_BASE = "https://public-api.birdeye.so";

function getApiKey(): string | null {
  return process.env.BIRDEYE_API_KEY ?? null;
}

export function hasBirdeyeApiKey(): boolean {
  return !!getApiKey();
}

const COMMON_HEADERS = {
  accept: "application/json",
  "x-chain": "solana",
};

interface BirdeyeToken {
  address: string;
  symbol: string;
  name: string;
  mc?: number;
  v24hUSD?: number;
  liquidity?: number;
}

interface TokenListResponse {
  success?: boolean;
  data?: {
    tokens?: BirdeyeToken[];
    total?: number;
  };
}

/**
 * Fetch token list from Birdeye (sorted by 24h volume). Requires BIRDEYE_API_KEY.
 * Filters: min_liquidity, and we filter by mc <= maxMcapUsd and (optional) pump tokens.
 */
export async function getTokenList(params: {
  sortBy?: "v24hUSD" | "mc" | "v24hChangePercent";
  sortType?: "asc" | "desc";
  offset?: number;
  limit?: number;
  minLiquidity?: number;
}): Promise<BirdeyeToken[]> {
  const key = getApiKey();
  if (!key) return [];

  const url = new URL(`${BIRDEYE_BASE}/defi/tokenlist`);
  url.searchParams.set("sort_by", params.sortBy ?? "v24hUSD");
  url.searchParams.set("sort_type", params.sortType ?? "desc");
  url.searchParams.set("offset", String(params.offset ?? 0));
  url.searchParams.set("limit", String(Math.min(50, params.limit ?? 50)));
  if (params.minLiquidity != null) url.searchParams.set("min_liquidity", String(params.minLiquidity));

  try {
    const res = await fetch(url.toString(), {
      headers: { ...COMMON_HEADERS, "X-API-KEY": key },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as TokenListResponse;
    return data?.data?.tokens ?? [];
  } catch {
    return [];
  }
}

interface HolderItem {
  wallet?: string;
  holding?: string;
  percent_of_supply?: number;
}

interface HolderDistributionResponse {
  success?: boolean;
  data?: {
    summary?: { wallet_count?: number; total_holding?: string; percent_of_supply?: number };
    holders?: HolderItem[];
  };
}

/**
 * Get holder distribution (top N holders). Requires BIRDEYE_API_KEY.
 * Returns { holderCount, top10PercentOfSupply } for "good holders" scoring.
 */
/**
 * Fetch token price in USD from Birdeye. Requires BIRDEYE_API_KEY.
 * Use for more accurate PnL when available.
 */
export async function getTokenPriceUsdBirdeye(mint: string): Promise<number | null> {
  const key = getApiKey();
  if (!key) return null;
  try {
    const url = `${BIRDEYE_BASE}/defi/price?address=${mint}`;
    const res = await fetch(url, { headers: { ...COMMON_HEADERS, "X-API-KEY": key } });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { value?: number } };
    const v = data?.data?.value;
    return typeof v === "number" && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export async function getHolderStats(mint: string, topN = 10): Promise<{
  holderCount: number;
  top10PercentOfSupply: number;
  isGoodHolders: boolean;
} | null> {
  const key = getApiKey();
  if (!key) return null;

  const url = new URL(`${BIRDEYE_BASE}/holder/v1/distribution`);
  url.searchParams.set("token_address", mint);
  url.searchParams.set("mode", "top");
  url.searchParams.set("top_n", String(topN));
  url.searchParams.set("include_list", "true");

  try {
    const res = await fetch(url.toString(), {
      headers: { ...COMMON_HEADERS, "X-API-KEY": key },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as HolderDistributionResponse;
    const summary = data?.data?.summary;
    const holders = data?.data?.holders ?? [];
    const holderCount = summary?.wallet_count ?? holders.length;
    const top10Percent = holders.reduce((sum, h) => sum + (h.percent_of_supply ?? 0), 0);
    const isGoodHolders = holderCount >= 20 && top10Percent < 70;
    return { holderCount, top10PercentOfSupply: top10Percent, isGoodHolders };
  } catch {
    return null;
  }
}
