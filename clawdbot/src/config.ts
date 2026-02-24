import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Filters } from "./types.js";

function findRoot(): string {
  const d = dirname(fileURLToPath(import.meta.url));
  let root = join(d, "..", "..");
  if (!existsSync(join(root, "config")) && existsSync(join(root, "..", "config"))) {
    root = join(root, "..");
  }
  return root;
}
const root = process.env.CONFIG_DIR ? join(process.env.CONFIG_DIR, "..") : findRoot();
const configDir = process.env.CONFIG_DIR || join(root, "config");
const dataDir = process.env.DATA_DIR || join(root, "data");

export function loadFilters(): Filters {
  try {
    const path = join(configDir, "filters.json");
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as Filters;
  } catch {
    return {
      minVolumeUsd: 5000,
      minMcapUsd: 5000,
      maxMcapUsd: 31400,
      minGlobalFeesPaidSol: 0.8,
      maxAgeMinutes: 120,
      maxPositionSol: 0.1,
      maxPositionPercent: 10,
      maxCandidates: 3,
      holdMinSeconds: 30,
      holdMaxSeconds: 300,
      takeProfitPercent: 50,
      stopLossPercent: -25,
      slippagePercent: 15,
      priorityFeeSol: 0.0001,
    };
  }
}

export function getDataDir(): string {
  return dataDir;
}

export const DEMO_MODE = process.env.DEMO_MODE === "true" || !process.env.SOLANA_RPC_URL;
