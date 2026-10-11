export type NetworkPeriod = "day" | "week" | "month";

export type NetworkFreshness = {
  fetchedAt: string;
  stale: boolean;
};

export type NetworkSource = { name: string; url: string; docsUrl: string };
export type NetworkMetric = "solrate" | "blockTime" | "blocks";

export type NetworkSeriesPoint = {
  time: string;
  /** Null samples remain gaps, never interpolated as source observations. */
  value: number | null;
  current: boolean;
};

export type NetworkSeries = NetworkFreshness & {
  source: NetworkSource;
  metric: NetworkMetric;
  windowLabel: string;
  observedAt: string | null;
  coverageAt: string | null;
  coverageHeight: number | null;
  /** The actual available range, which may differ by metric. */
  period: NetworkPeriod;
  truncated: boolean;
  points: NetworkSeriesPoint[];
};

export type NetworkCurrent = NetworkFreshness & {
  source: NetworkSource;
  observedAt: string;
  coverageAt: string;
  coverageHeight: number;
  windowSeconds: number;
  solrateGsols: number | null;
  difficulty: number;
  blocks24h: number;
  averageTxsPerBlock: number | null;
};

export type NetworkActivity = {
  current: NetworkCurrent | null;
  solrate: NetworkSeries | null;
  blocks: NetworkSeries | null;
  blockTime: NetworkSeries | null;
};

export type NetworkValuePool = {
  id: string;
  name: string;
  zec: number;
  shielded: boolean;
};

export type NetworkBlock = {
  height: number;
  hash: string;
  time: string;
  txCount: number;
  sizeBytes: number;
  pool: string;
  feesZec: number | null;
  status: string | null;
};

export type NetworkEmission = {
  blockSubsidyZec: number | null;
  minerSubsidyZec: number | null;
  nextHalvingHeight: number | null;
  blocksRemaining: number | null;
  estimatedHalvingAt: string | null;
  eraProgressPercent: number | null;
  nextBlockSubsidyZec: number | null;
};

export type NetworkCore = NetworkFreshness & {
  height: number;
  chainTip: number;
  indexedHeight: number;
  synced: boolean;
  lastBlockAt: string;
  targetBlockSeconds: number;
  difficulty: number;
  averageDifficulty: number;
  solrateGsols: number;
  averageBlockSeconds: number | null;
  averageTxsPerBlock: number;
  averageFeesZecPerBlock: number | null;
  sampleBlocks: number;
  /** Upstream reported on-chain supply; not a market circulating supply quote. */
  totalSupplyZec: number;
  /** Sum of every reported value pool, including deferred Lockbox funds. */
  poolTotalZec: number;
  shieldedZec: number;
  /** Shielded share of all reported value pools; Lockbox is in the denominator. */
  shieldedPercent: number;
  pools: NetworkValuePool[];
  recentBlocks: NetworkBlock[];
  emission: NetworkEmission;
};

export type NetworkMining = NetworkFreshness & {
  totalBlocks: number;
  pools: { name: string; blocks: number; sharePercent: number }[];
};

export type NetworkMempool = NetworkFreshness & {
  count: number;
  bytes: number;
};

export type NetworkSnapshot = {
  period: NetworkPeriod;
  source: { name: string; url: string; docsUrl: string };
  status: "live" | "partial" | "stale" | "unavailable";
  fetchedAt: string | null;
  stale: boolean;
  core: NetworkCore | null;
  activity: NetworkActivity;
  mining: NetworkMining | null;
  mempool: NetworkMempool | null;
  unavailableSections: string[];
};
