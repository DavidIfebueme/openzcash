import "server-only";

import { z } from "zod";
import type {
  NetworkCore,
  NetworkEmission,
  NetworkFreshness,
  NetworkMining,
  NetworkPeriod,
  NetworkSnapshot,
  NetworkValuePool,
} from "./types";
import { getNetworkActivity } from "./zecblock";
import { getNetworkEconomics } from "./economics";

const API_URL = "https://api.zcashinfo.com/api/v1";
const SOURCE = {
  name: "Zcash Info",
  url: "https://zcashinfo.com/",
  docsUrl: "https://api.zcashinfo.com/docs",
};
const RANGES: Record<NetworkPeriod, string> = { day: "24h", week: "1w", month: "1m" };
const ZATS_PER_ZEC = 100_000_000;
const SECOND_HALVING_HEIGHT = 2_726_400;
const HALVING_BLOCKS = 1_680_000;
const RETRY_MS = 10_000;

const amount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const positive = z.number().finite().positive();
const unixTime = amount.max(253_402_300_799);
const blockSchema = z.object({
  height: amount,
  hash: z.string().regex(/^[0-9a-f]{64}$/i),
  time: unixTime,
  difficulty: positive,
  tx_count: amount,
  size: amount,
  miner: z.object({ pool_name: z.string().nullable().optional() }).nullable().optional(),
  transaction_fees_zatoshis: amount.nullable().optional(),
  total_minted_zatoshis: amount.nullable().optional(),
  miner_subsidy_zatoshis: amount.nullable().optional(),
  status: z.string().nullable().optional(),
});

const dashboardSchema = z.object({
  info: z.object({
    best_block: amount,
    chain_tip: amount,
    difficulty: positive,
    status: z.string(),
    target_block_spacing_secs: positive,
    work_per_difficulty: positive,
    nu7_activation_height: amount.nullable().optional(),
  }),
  pools: z.object({
    total_supply_zatoshis: amount,
    transparent_zatoshis: amount,
    sapling_zatoshis: amount,
    orchard_zatoshis: amount,
    sprout_zatoshis: amount,
    lockbox_zatoshis: amount,
    ironwood_zatoshis: amount.optional(),
  }).passthrough().superRefine((pools, context) => {
    for (const [key, value] of Object.entries(pools)) {
      if (key.endsWith("_zatoshis") && !amount.safeParse(value).success) {
        context.addIssue({ code: "custom", message: "Invalid value pool amount", path: [key] });
      }
    }
  }),
  recent_blocks: z.array(blockSchema).min(1),
});
const blocksSchema = z.object({ blocks: z.array(blockSchema).min(1) });
const miningSchema = z.object({
  total_blocks: amount,
  pools: z.array(z.object({
    pool_name: z.string().nullable(),
    block_count: amount,
    share_percentage: z.number().finite().min(0).max(100),
  })),
});
const mempoolSchema = z.object({ size: amount, bytes: amount });

type Resource<T> = NetworkFreshness & { data: T; at: number };
const cache = new Map<string, Resource<unknown>>();
const pending = new Map<string, Promise<Resource<unknown> | null>>();
const retryAfter = new Map<string, number>();

/** Preserve the original retrieval time if a public feed is unavailable. */
async function resource<T>(path: string, ttlMs: number, schema: z.ZodType<T>): Promise<Resource<T> | null> {
  const previous = cache.get(path) as Resource<T> | undefined;
  const now = Date.now();
  if (previous && now - previous.at < ttlMs) return { ...previous, stale: false };
  const fallback = () => previous ? { ...previous, stale: true } : null;
  if (now < (retryAfter.get(path) ?? 0)) return fallback();
  const inFlight = pending.get(path);
  if (inFlight) return inFlight as Promise<Resource<T> | null>;

  const request = (async (): Promise<Resource<T> | null> => {
    try {
      const response = await fetch(`${API_URL}${path}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Network data unavailable");
      const data = schema.parse(await response.json());
      const at = Date.now();
      const value = { data, at, fetchedAt: new Date(at).toISOString(), stale: false };
      cache.set(path, value);
      retryAfter.delete(path);
      return value;
    } catch {
      retryAfter.set(path, Date.now() + RETRY_MS);
      return fallback();
    } finally {
      pending.delete(path);
    }
  })();
  pending.set(path, request as Promise<Resource<unknown> | null>);
  return request;
}

type Dashboard = z.infer<typeof dashboardSchema>;
type ApiBlock = z.infer<typeof blockSchema>;

function emission(info: Dashboard["info"], latest: ApiBlock): NetworkEmission {
  const blockSubsidyZec = latest.total_minted_zatoshis == null
    ? null : latest.total_minted_zatoshis / ZATS_PER_ZEC;
  const minerSubsidyZec = latest.miner_subsidy_zatoshis == null
    ? null : latest.miner_subsidy_zatoshis / ZATS_PER_ZEC;
  // ZIP 208's current discrete schedule. A changed target or a scheduled NU7
  // before the halving needs a new projection, not a guessed activation date.
  const era = Math.floor((latest.height - SECOND_HALVING_HEIGHT) / HALVING_BLOCKS);
  const next = SECOND_HALVING_HEIGHT + (era + 1) * HALVING_BLOCKS;
  const knownSchedule = era >= 0 && info.target_block_spacing_secs === 75
    && (info.nu7_activation_height == null || info.nu7_activation_height > next);
  if (!knownSchedule) return {
    blockSubsidyZec, minerSubsidyZec, nextHalvingHeight: null,
    blocksRemaining: null, estimatedHalvingAt: null,
    eraProgressPercent: null, nextBlockSubsidyZec: null,
  };
  const remaining = Math.max(0, next - latest.height);
  return {
    blockSubsidyZec,
    minerSubsidyZec,
    nextHalvingHeight: next,
    blocksRemaining: remaining,
    estimatedHalvingAt: new Date((latest.time + remaining * info.target_block_spacing_secs) * 1_000).toISOString(),
    eraProgressPercent: (1 - remaining / HALVING_BLOCKS) * 100,
    nextBlockSubsidyZec: latest.total_minted_zatoshis == null
      ? null : Math.floor(latest.total_minted_zatoshis / 2) / ZATS_PER_ZEC,
  };
}

const POOL_NAMES: Record<string, string> = {
  transparent: "Transparent", ironwood: "Ironwood", orchard: "Orchard",
  sapling: "Sapling", sprout: "Sprout", lockbox: "Deferred Lockbox",
};
const SHIELDED_POOLS = new Set(["ironwood", "orchard", "sapling", "sprout"]);

function coreData(dashboard: Resource<Dashboard>, sample: Resource<z.infer<typeof blocksSchema>> | null): NetworkCore {
  const { info, pools: balances, recent_blocks: recent } = dashboard.data;
  const recentBlocks = recent.filter((block) => block.status?.toUpperCase() !== "STALE")
    .sort((a, b) => b.height - a.height);
  if (recentBlocks.length === 0) throw new Error("No current-chain dashboard blocks");
  const latest = recentBlocks[0];
  const blocks = (sample?.data.blocks ?? recentBlocks)
    .filter((block) => block.status?.toUpperCase() !== "STALE")
    .sort((a, b) => b.height - a.height);
  const usable = blocks.length > 0 ? blocks : recentBlocks;
  const first = usable[0] ?? latest;
  const oldest = usable.at(-1) ?? latest;
  const span = first.time - oldest.time;
  const heightSpan = first.height - oldest.height;
  const averageDifficulty = usable.reduce((sum, block) => sum + block.difficulty, 0) / usable.length;
  const fees = usable.map((block) => block.transaction_fees_zatoshis);
  const pools: NetworkValuePool[] = Object.entries(balances)
    .filter(([key]) => key.endsWith("_zatoshis") && key !== "total_supply_zatoshis")
    .map(([key, value]) => {
      const id = key.replace(/_zatoshis$/, "");
      // Future pool keys are retained without claiming they are shielded.
      const zatoshis = amount.parse(value);
      return { id, name: POOL_NAMES[id] ?? id, zec: zatoshis / ZATS_PER_ZEC, shielded: SHIELDED_POOLS.has(id) };
    });
  const poolTotalZec = pools.reduce((sum, pool) => sum + pool.zec, 0);
  const shieldedZec = pools.filter((pool) => pool.shielded).reduce((sum, pool) => sum + pool.zec, 0);
  const at = Math.min(dashboard.at, sample?.at ?? dashboard.at);
  const synced = info.status === "synced" && Math.abs(info.chain_tip - info.best_block) <= 1;
  return {
    fetchedAt: new Date(at).toISOString(),
    stale: dashboard.stale || !!sample?.stale || !synced
      || Date.now() - latest.time * 1_000 > 15 * 60_000,
    height: latest.height,
    chainTip: info.chain_tip,
    indexedHeight: info.best_block,
    synced,
    lastBlockAt: new Date(latest.time * 1_000).toISOString(),
    targetBlockSeconds: info.target_block_spacing_secs,
    difficulty: info.difficulty,
    averageDifficulty,
    solrateGsols: averageDifficulty * info.work_per_difficulty / info.target_block_spacing_secs / 1e9,
    averageBlockSeconds: heightSpan > 0 && span > 0 ? span / heightSpan : null,
    averageTxsPerBlock: usable.reduce((sum, block) => sum + block.tx_count, 0) / usable.length,
    averageFeesZecPerBlock: fees.every((fee) => fee != null)
      ? fees.reduce((sum: number, fee) => sum + (fee ?? 0), 0) / usable.length / ZATS_PER_ZEC : null,
    sampleBlocks: usable.length,
    totalSupplyZec: balances.total_supply_zatoshis / ZATS_PER_ZEC,
    poolTotalZec,
    shieldedZec,
    shieldedPercent: poolTotalZec > 0 ? shieldedZec / poolTotalZec * 100 : 0,
    pools,
    recentBlocks: recentBlocks.slice(0, 10).map((block) => ({
      height: block.height, hash: block.hash, time: new Date(block.time * 1_000).toISOString(),
      txCount: block.tx_count, sizeBytes: block.size,
      pool: block.miner?.pool_name ?? "Unknown",
      feesZec: block.transaction_fees_zatoshis == null ? null : block.transaction_fees_zatoshis / ZATS_PER_ZEC,
      status: block.status ?? null,
    })),
    emission: emission(info, latest),
  };
}

export async function getNetworkSnapshot(period: NetworkPeriod = "day"): Promise<NetworkSnapshot> {
  const range = RANGES[period];
  const [activity, economics, dashboard, blocks, mining, mempool] = await Promise.all([
    getNetworkActivity(period),
    getNetworkEconomics(),
    resource("/dashboard", 30_000, dashboardSchema),
    resource("/blocks?limit=100", 30_000, blocksSchema),
    resource(`/mining/pools?interval=${range}`, 60_000, miningSchema),
    resource("/mempool", 30_000, mempoolSchema),
  ]);
  let core: NetworkCore | null = null;
  if (dashboard) {
    try { core = coreData(dashboard, blocks); } catch { /* Invalid or unusable current-chain readings are unavailable. */ }
  }
  const miningSection: NetworkMining | null = mining ? {
    fetchedAt: mining.fetchedAt,
    stale: mining.stale,
    totalBlocks: mining.data.total_blocks,
    pools: mining.data.pools.map((pool) => ({
      name: pool.pool_name ?? "Unknown", blocks: pool.block_count, sharePercent: pool.share_percentage,
    })).sort((a, b) => b.blocks - a.blocks),
  } : null;
  const mempoolSection = mempool ? {
    fetchedAt: mempool.fetchedAt, stale: mempool.stale,
    count: mempool.data.size, bytes: mempool.data.bytes,
  } : null;
  // Block counts and solrate share one activity feed, so count its health once.
  const sections = {
    core,
    "activity.current": activity.current,
    "activity.solrate": activity.solrate,
    "activity.blockTime": activity.blockTime,
    mining: miningSection,
    mempool: mempoolSection,
    inflation: economics.inflation,
    market: economics.market,
  };
  const available = Object.values(sections).filter((section) => section !== null);
  const unavailableSections = Object.entries(sections).filter(([, section]) => !section).map(([name]) => name);
  const status = available.length === 0 ? "unavailable"
    : available.every((section) => section.stale) ? "stale"
    : unavailableSections.length > 0 || available.some((section) => section.stale) ? "partial" : "live";
  return {
    period, source: SOURCE, status,
    fetchedAt: core?.fetchedAt ?? available.map((section) => section.fetchedAt).sort().at(-1) ?? null,
    stale: !!core?.stale || status === "stale",
    core, activity, ...economics, mining: miningSection, mempool: mempoolSection, unavailableSections,
  };
}
