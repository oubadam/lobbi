import type { CandidateCoin, Filters, HoldPlan } from "./types.js";

export interface HolderStats {
  holderCount: number;
  top10PercentOfSupply: number;
  isGoodHolders: boolean;
}

/**
 * Analyse coin (volume, mcap, liquidity, optional holder stats) to decide hold time and take-profit/stop-loss.
 * - High volume/mcap = healthy velocity → hold longer, aim for higher TP.
 * - Good liquidity vs mcap = easier exit → can use tighter SL.
 * - Good holders (many wallets, not concentrated) → longer hold, higher TP.
 * - Small mcap near max = more volatile → shorter max hold, respect SL.
 */
export function planHold(
  coin: CandidateCoin,
  filters: Filters,
  holderStats?: HolderStats | null
): HoldPlan {
  const vol = coin.volumeUsd ?? 0;
  const mcap = coin.mcapUsd ?? 0;
  const liq = coin.liquidityUsd ?? 0;

  const baseMin = filters.holdMinSeconds * 1000;
  const baseMax = filters.holdMaxSeconds * 1000;
  const baseTP = filters.takeProfitPercent;
  const baseSL = filters.stopLossPercent;

  let holdMinMs = baseMin;
  let holdMaxMs = baseMax;
  let takeProfitPercent = baseTP;
  let stopLossPercent = baseSL;
  const reasons: string[] = [];

  if (holderStats) {
    if (holderStats.isGoodHolders) {
      holdMaxMs = Math.min(holdMaxMs * 1.2, 600 * 1000);
      takeProfitPercent = Math.min(takeProfitPercent + 10, 80);
      reasons.push(`good holders (${holderStats.holderCount}, top10 ${holderStats.top10PercentOfSupply.toFixed(0)}%)`);
    } else if (holderStats.holderCount < 10 || holderStats.top10PercentOfSupply > 85) {
      holdMaxMs = Math.min(holdMaxMs, 120 * 1000);
      reasons.push("concentrated holders");
    }
  }

  if (mcap > 0 && vol > 0) {
    const velocity = vol / mcap;
    if (velocity > 0.5) {
      holdMaxMs = Math.min(baseMax * 1.5, 600 * 1000);
      takeProfitPercent = Math.min(baseTP + 20, 80);
      reasons.push("high vol/mcap");
    } else if (velocity < 0.1) {
      holdMaxMs = Math.max(baseMax * 0.6, 60 * 1000);
      stopLossPercent = Math.min(baseSL - 5, -15);
      reasons.push("low velocity");
    }
  }

  if (liq > 0 && mcap > 0) {
    const liqRatio = liq / mcap;
    if (liqRatio > 0.3) {
      reasons.push("good liquidity");
    } else if (liqRatio < 0.1) {
      holdMaxMs = Math.min(holdMaxMs, 120 * 1000);
      reasons.push("thin liquidity");
    }
  }

  const maxMcap = filters.maxMcapUsd ?? 31400;
  if (mcap > maxMcap * 0.8) {
    holdMaxMs = Math.min(holdMaxMs, 180 * 1000);
    reasons.push("near max mcap");
  }

  return {
    holdMinMs,
    holdMaxMs,
    takeProfitPercent,
    stopLossPercent,
    reason: reasons.length ? reasons.join(", ") : "default",
  };
}

/** Pick one option based on a deterministic hash of input (same coin = same pick, different coins = varied). */
function pick<T>(options: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return options[h % options.length]!;
}

/** Build a unique, coin-specific "why bought" narrative. Varied phrasing based on actual metrics. */
export function buildNarrativeWhy(
  coin: CandidateCoin,
  plan: HoldPlan,
  holderStats?: HolderStats | null,
  ageMinutes?: number
): string {
  const name = coin.name || coin.symbol || "Unknown";
  const mcap = coin.mcapUsd ?? 0;
  const vol = coin.volumeUsd ?? 0;
  const mcapK = (mcap / 1000).toFixed(1);
  const volK = (vol / 1000).toFixed(1);
  const seed = coin.mint + coin.symbol;

  const openings = [
    `${name} ($${coin.symbol}) — `,
    `$${coin.symbol} — `,
    `${name} — `,
  ];
  let s = "Bought " + pick(openings, seed);

  if (mcap > 0 && vol > 0) {
    const velocity = vol / mcap;
    const velPhrases: string[] =
      velocity > 2
        ? [
            `Unusual ${velocity.toFixed(1)}x vol/mcap ($${volK}k / $${mcapK}k)—strong momentum.`,
            `Vol $${(vol / 1000).toFixed(0)}k crushes mcap $${mcapK}k (${velocity.toFixed(1)}x)—real interest.`,
          ]
        : velocity > 0.8
          ? [
              `Vol $${volK}k vs mcap $${mcapK}k (${velocity.toFixed(1)}x)—healthy trading activity.`,
              `$${volK}k volume on $${mcapK}k mcap—decent velocity and interest.`,
            ]
          : velocity > 0.3
            ? [
                `$${volK}k vol, $${mcapK}k mcap—solid ratio.`,
                `Volume and mcap in line: $${volK}k / $${mcapK}k.`,
              ]
            : [
                `Lower vol ($${volK}k) for $${mcapK}k mcap—speculative play.`,
                `$${mcapK}k mcap, $${volK}k vol—early stage.`,
              ];
    s += pick(velPhrases, seed + "v");
  } else if (mcap > 0) {
    s += `Mcap $${mcapK}k. `;
  }

  if (ageMinutes != null) {
    const agePhrases: string[] =
      ageMinutes < 5
        ? [`Fresh: ${ageMinutes}m old. `, `Very new: ${ageMinutes}m. `]
        : ageMinutes < 20
          ? [`${ageMinutes}m old—early entry. `, `Age ${ageMinutes}m. `]
          : ageMinutes < 45
            ? [`${ageMinutes}m in—momentum phase. `, `Token ${ageMinutes}m old. `]
            : [`${ageMinutes}m old. `];
    s += pick(agePhrases, seed + "a");
  }

  if (holderStats) {
    const h = holderStats.holderCount;
    const t10 = holderStats.top10PercentOfSupply.toFixed(0);
    const holderPhrases: string[] = holderStats.isGoodHolders
      ? [
          `${h} holders, top 10 = ${t10}%—distributed. `,
          `Good distribution: ${h} holders, ${t10}% in top 10. `,
        ]
      : [
          `${h} holders, top 10 hold ${t10}%. `,
          `Holder base: ${h}, top 10 = ${t10}%. `,
        ];
    s += pick(holderPhrases, seed + "h");
  }

  if (coin.twitter || coin.website) {
    const links: string[] = [];
    if (coin.twitter) links.push(coin.twitter);
    if (coin.website) links.push(coin.website);
    s += `Socials: ${links.join(", ")}. `;
  }

  return s.trim();
}
