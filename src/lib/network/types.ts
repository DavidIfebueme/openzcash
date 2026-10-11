export type NetworkPeriod = "day" | "week" | "month";

export type NetworkFreshness = {
  fetchedAt: string;
  stale: boolean;
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

export type NetworkHistoryPoint = {
  time: string;
  solrateGsols: number;
  difficulty: number;
  blocks: number;
  minHeight: number;
  maxHeight: number;
  /** A bucket that has not been proven complete must not imply an activity drop. */
  partial: boolean;
};

export type NetworkHistory = NetworkFreshness & {
  /** Last bucket start; this is not the time through which the source indexed. */
  lastPointAt: string | null;
  /** Exact timestamp of the last block included, when another fetched block confirms it. */
  coverageAt: string | null;
  coverageHeight: number | null;
  lagBlocks: number | null;
  /** Inferred from returned bucket starts; never assumed from the requested period. */
  bucketSeconds: number | null;
  points: NetworkHistoryPoint[];
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
  history: NetworkHistory | null;
  mining: NetworkMining | null;
  mempool: NetworkMempool | null;
  unavailableSections: string[];
};
