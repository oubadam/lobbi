import type { CandidateCoin, Filters } from "./types.js";
import { getTokenList, hasBirdeyeApiKey } from "./birdeye.js";

const DEXSCREENER = "https://api.dexscreener.com/latest/dex";

interface DexPair {
  chainId: string;
  dexId: string;
  url?: string;
  baseToken: { address: string; symbol: string; name: string };
  quoteToken: { address: string; symbol: string };
  volume?: { h24?: number };
  fdv?: number;
  marketCap?: number;
  liquidity?: { usd?: number };
  pairCreatedAt?: number;
}

function isPumpToken(addr: string): boolean {
  return addr.length >= 32 && (addr.endsWith("pump") || addr.toLowerCase().includes("pump"));
}

function parsePairs(data: { pairs?: DexPair[] }): DexPair[] {
  return data?.pairs ?? [];
}

function collectFromPairs(
  pairs: DexPair[],
  filters: { minVol: number; minMcap: number; maxMcap: number; maxAgeMs: number },
  pumpOnly: boolean,
  seen: Set<string>,
  candidates: CandidateCoin[],
  now: number,
  maxCount: number,
  exclude?: Set<string>
): void {
  for (const p of pairs) {
    if (p.chainId !== "solana") continue;
    const mint = p.baseToken.address;
    if (seen.has(mint) || exclude?.has(mint)) continue;
    if (pumpOnly) {
      const onPump =
        p.dexId === "pump" ||
        p.dexId === "pumpswap" ||
        isPumpToken(mint) ||
        (p.url ?? "").toLowerCase().includes("pump");
      if (!onPump) continue;
    }
    const vol = p.volume?.h24 ?? 0;
    const mcap = p.fdv ?? p.marketCap ?? p.liquidity?.usd ?? 0;
    const created = p.pairCreatedAt ?? 0;
    const ageOk = created >= now - filters.maxAgeMs;
    const mcapOk = mcap <= filters.maxMcap && mcap >= filters.minMcap;
    if (vol >= filters.minVol && mcapOk && ageOk) {
      seen.add(mint);
      const ageMin = Math.round((now - created) / 60000);
      const liq = p.liquidity?.usd ?? 0;
      candidates.push({
        mint,
        symbol: p.baseToken.symbol || "???",
        name: p.baseToken.name || p.baseToken.symbol || "Unknown",
        reason: `Vol $${(vol / 1000).toFixed(1)}k · Mcap $${(mcap / 1000).toFixed(1)}k · ${ageMin}m old`,
        volumeUsd: vol,
        mcapUsd: mcap,
        pairCreatedAt: created,
        liquidityUsd: liq,
      });
      if (candidates.length >= maxCount) return;
    }
  }
}

const DISCOVERY_POOL_SIZE = 12;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export interface DiscoverOptions {
  /** Exclude these mints (e.g. recently bought) so we don't keep buying the same coin. */
  excludeMints?: Set<string>;
  /** How many to collect before shuffling and picking; default 12 for variety. */
  poolSize?: number;
}

export async function discoverCandidates(
  filters: Filters,
  options?: DiscoverOptions
): Promise<CandidateCoin[]> {
  const now = Date.now();
  const poolSize = Math.min(options?.poolSize ?? DISCOVERY_POOL_SIZE, 20);
  const maxCandidates = Math.min(filters.maxCandidates, 10);
  const exclude = options?.excludeMints;
  const seen = new Set<string>();
  const candidates: CandidateCoin[] = [];
  const maxMcap = filters.maxMcapUsd ?? 31400;
  const minMcap = filters.minMcapUsd;
  const minVol = filters.minVolumeUsd;

  const add = (c: CandidateCoin) => {
    if (exclude?.has(c.mint)) return;
    if (seen.has(c.mint)) return;
    seen.add(c.mint);
    candidates.push(c);
  };

  if (hasBirdeyeApiKey()) {
    const birdeyeTokens = await getTokenList({
      sortBy: "v24hUSD",
      sortType: "desc",
      limit: 50,
      minLiquidity: Math.min(1000, minVol),
    });
    for (const t of birdeyeTokens) {
      const mint = t.address;
      const mcap = t.mc ?? 0;
      const vol = t.v24hUSD ?? 0;
      const liq = t.liquidity ?? 0;
      if (mcap < minMcap || mcap > maxMcap || vol < minVol) continue;
      const isPump = mint.length >= 32 && (mint.endsWith("pump") || mint.toLowerCase().includes("pump"));
      add({
        mint,
        symbol: t.symbol || "???",
        name: t.name || t.symbol || "Unknown",
        reason: `Vol $${(vol / 1000).toFixed(1)}k · Mcap $${(mcap / 1000).toFixed(1)}k${isPump ? " · Pump" : ""}`,
        volumeUsd: vol,
        mcapUsd: mcap,
        liquidityUsd: liq,
      });
      if (candidates.length >= poolSize) break;
    }
  }

  const strict = {
    minVol: filters.minVolumeUsd,
    minMcap: filters.minMcapUsd,
    maxMcap,
    maxAgeMs: filters.maxAgeMinutes * 60 * 1000,
  };
  const relaxedAge = {
    minVol: filters.minVolumeUsd,
    minMcap: filters.minMcapUsd,
    maxMcap,
    maxAgeMs: 24 * 60 * 60 * 1000,
  };
  const relaxedAll = {
    minVol: Math.min(3000, filters.minVolumeUsd),
    minMcap: Math.min(3000, filters.minMcapUsd),
    maxMcap,
    maxAgeMs: 7 * 24 * 60 * 60 * 1000,
  };

  const queries = ["pumpswap", "pump", "pumpfun", "memecoin", "sol", "pepe", "doge", "wojak", "based", "trending"];

  for (const q of queries) {
    try {
      const res = await fetch(`${DEXSCREENER}/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) continue;
      const data = (await res.json()) as { pairs?: DexPair[] };
      const pairs = parsePairs(data);
      collectFromPairs(pairs, strict, true, seen, candidates, now, poolSize, exclude);
      if (candidates.length >= poolSize) break;
    } catch (e) {
      console.warn("[discovery] query failed:", q, e);
    }
  }

  if (candidates.length === 0) {
    for (const q of queries) {
      try {
        const res = await fetch(`${DEXSCREENER}/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) continue;
        const data = (await res.json()) as { pairs?: DexPair[] };
        collectFromPairs(parsePairs(data), relaxedAge, true, seen, candidates, now, poolSize, exclude);
        if (candidates.length >= poolSize) break;
      } catch {
        /* ignore */
      }
    }
  }

  if (candidates.length === 0) {
    for (const q of ["pump", "solana", "trending"]) {
      try {
        const res = await fetch(`${DEXSCREENER}/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) continue;
        const data = (await res.json()) as { pairs?: DexPair[] };
        collectFromPairs(parsePairs(data), relaxedAll, true, seen, candidates, now, poolSize, exclude);
        if (candidates.length >= poolSize) break;
      } catch {
        /* ignore */
      }
    }
  }

  if (candidates.length === 0) {
    for (const q of ["solana", "trending"]) {
      try {
        const res = await fetch(`${DEXSCREENER}/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) continue;
        const data = (await res.json()) as { pairs?: DexPair[] };
        collectFromPairs(parsePairs(data), relaxedAll, false, seen, candidates, now, poolSize, exclude);
        if (candidates.length >= poolSize) break;
      } catch {
        /* ignore */
      }
    }
  }

  const realOnly = candidates.filter((c) => !c.mint.startsWith("DemoMint"));
  if (realOnly.length === 0) {
    return [];
  }
  return shuffle(realOnly).slice(0, maxCandidates);
}
