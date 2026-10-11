import "server-only";

import { z } from "zod";
import type {
  NetworkActivity, NetworkCurrent, NetworkFreshness, NetworkPeriod, NetworkSeries,
  NetworkSeriesPoint,
} from "./types";

const API_URL = "https://api.zecblock.com/v1";
const SOURCE = { name: "ZecBlock", url: "https://zecblock.com/", docsUrl: "https://zecblock.com/docs" };
const DAY_SECONDS = 86_400;
const MAX_AGE_MS = 5 * 60_000;
const FUTURE_TOLERANCE_MS = 60_000;
const RETRY_MS = 10_000;
const METHOD = "target-work-v1";
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const positive = z.number().finite().positive();
const iso = z.iso.datetime({ offset: true });
const unix = integer.max(253_402_300_799);

const metaSchema = z.object({
  network: z.literal("mainnet"),
  indexedHeight: integer.nullable().optional(),
  source: z.object({ observedAt: iso.nullable().optional() }).optional(),
  freshness: z.object({ status: z.string(), ageSeconds: z.number().finite().nonnegative().nullable().optional() }).optional(),
});

const windowSchema = z.object({
  hashrate: z.number().finite().nonnegative().nullable(),
  blockCount: integer,
  windowSeconds: positive,
  windowStart: iso,
  windowEnd: iso,
  expectedWork: z.string().regex(/^\d+$/).nullable(),
  unavailableReason: z.string().nullable(),
  method: z.string(),
}).superRefine((value, context) => {
  if (Date.parse(value.windowEnd) - Date.parse(value.windowStart) !== value.windowSeconds * 1_000) {
    context.addIssue({ code: "custom", message: "Invalid estimation window" });
  }
  if (value.hashrate !== null) {
    const expectedRate = value.expectedWork === null ? NaN : Number(value.expectedWork) / value.windowSeconds;
    if (value.unavailableReason !== null || value.blockCount < 2 || !Number.isFinite(expectedRate)
      || expectedRate <= 0 || Math.abs(expectedRate - value.hashrate) > Math.max(1, expectedRate * 1e-9)) {
      context.addIssue({ code: "custom", message: "Invalid expected-work estimate" });
    }
  } else if (value.unavailableReason === null) {
    context.addIssue({ code: "custom", message: "Missing estimate reason" });
  }
});

const statsSchema = z.object({
  data: z.object({
    mining: z.object({
      difficulty: positive,
      hashrateEstimate: z.object({
        asOf: iso, tipHash: z.string().regex(/^[0-9a-f]{64}$/i), tipHeight: integer,
        tipTimestamp: unix, windows: z.object({ "24h": windowSchema }),
      }),
    }),
    blockchain: z.object({ tx24h: integer.nullable(), sizeBytes: integer.positive().nullable().optional().catch(null) }),
  }),
  meta: metaSchema,
}).superRefine((value, context) => {
  const estimate = value.data.mining.hashrateEstimate;
  const window = estimate.windows["24h"];
  if (window.method !== METHOD || window.windowSeconds !== DAY_SECONDS
    || Date.parse(window.windowEnd) !== Date.parse(estimate.asOf)
    || !validTime(estimate.asOf)
    || !validTime(new Date(estimate.tipTimestamp * 1_000).toISOString())) {
    context.addIssue({ code: "custom", message: "Invalid current observation" });
  }
});

const historySchema = z.object({
  data: z.object({
    period: z.enum(["7d", "30d"]), window: z.literal("24h"), method: z.literal(METHOD),
    sampledAt: iso,
    points: z.array(windowSchema.safeExtend({ date: iso }).superRefine((value, context) => {
      if (Date.parse(value.date) !== Date.parse(value.windowEnd)
        || Date.parse(value.windowEnd) % (DAY_SECONDS * 1_000) !== 0
        || value.windowSeconds !== DAY_SECONDS || value.method !== METHOD) {
        context.addIssue({ code: "custom", message: "Mismatched historical estimate" });
      }
    })),
  }),
  meta: metaSchema,
}).superRefine((value, context) => {
  const sampled = Date.parse(value.data.sampledAt);
  const ends = value.data.points.map((point) => Date.parse(point.windowEnd)).sort((a, b) => a - b);
  if (ends.some((end, index) => index > 0 && end - ends[index - 1] !== DAY_SECONDS * 1_000)
    || !validTime(value.data.sampledAt) || sampled % (DAY_SECONDS * 1_000) !== 0
    || value.data.points.some((point) => Date.parse(point.windowEnd) > sampled)) {
    context.addIssue({ code: "custom", message: "Invalid historical observation" });
  }
});

const blockTimeSchema = z.object({
  data: z.object({
    period: z.enum(["24h", "7d"]), source: z.literal("canonical-block-header-timestamps"),
    observedAt: iso, rollingIntervals: positive.int().max(10_000),
    nodeHeight: integer, indexedHeight: integer, truncated: z.boolean(),
    downsampleEvery: positive.int(),
    points: z.array(z.object({
      height: integer, timestamp: unix,
      intervalSeconds: z.number().finite().nullable(),
      averageSeconds: positive.nullable(), targetSeconds: positive, intervals: integer,
    })).min(1),
  }),
  meta: metaSchema,
}).superRefine((value, context) => {
  if (!validTime(value.data.observedAt)
    || value.data.points.some((point) => !validTime(new Date(point.timestamp * 1_000).toISOString()))) {
    context.addIssue({ code: "custom", message: "Invalid block-time observation" });
  }
});

type Resource<T> = NetworkFreshness & { data: T; at: number };
const cache = new Map<string, Resource<unknown>>();
const pending = new Map<string, Promise<Resource<unknown> | null>>();
const retryAfter = new Map<string, number>();

async function resource<T>(path: string, ttlMs: number, schema: z.ZodType<T>): Promise<Resource<T> | null> {
  const previous = cache.get(path) as Resource<T> | undefined;
  const now = Date.now();
  const fallback = () => previous ? { ...previous, stale: true } : null;
  if (now < (retryAfter.get(path) ?? 0)) return fallback();
  if (previous && now - previous.at < ttlMs) return { ...previous, stale: false };
  const inFlight = pending.get(path);
  if (inFlight) return inFlight as Promise<Resource<T> | null>;
  const request = (async (): Promise<Resource<T> | null> => {
    try {
      const response = await fetch(`${API_URL}${path}`, {
        headers: { accept: "application/json" }, cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error("ZecBlock unavailable");
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

type Meta = z.infer<typeof metaSchema>;
type Stats = z.infer<typeof statsSchema>;
type History = z.infer<typeof historySchema>;
type BlockTime = z.infer<typeof blockTimeSchema>;

function validTime(time: string, now = Date.now()): boolean {
  const at = Date.parse(time);
  return Number.isFinite(at) && at <= now + FUTURE_TOLERANCE_MS;
}

function delayed(meta: Meta, observedAt: string, coverageAt?: string | null, coverageHeight?: number): boolean {
  const now = Date.now();
  const times = [observedAt, coverageAt, meta.source?.observedAt].filter((value): value is string => !!value);
  return times.some((value) => !validTime(value, now) || now - Date.parse(value) > MAX_AGE_MS)
    || ["stale", "unavailable", "expired"].includes(meta.freshness?.status.toLowerCase() ?? "")
    || (meta.freshness?.ageSeconds != null && meta.freshness.ageSeconds * 1_000 > MAX_AGE_MS)
    || (coverageHeight != null && meta.indexedHeight != null && meta.indexedHeight - coverageHeight > 10);
}

function currentData(stats: Resource<Stats> | null): NetworkCurrent | null {
  if (!stats) return null;
  const { data, meta } = stats.data;
  const estimate = data.mining.hashrateEstimate;
  const window = estimate.windows["24h"];
  const coverageAt = new Date(estimate.tipTimestamp * 1_000).toISOString();
  if (window.method !== METHOD || window.windowSeconds !== DAY_SECONDS
    || Date.parse(window.windowEnd) !== Date.parse(estimate.asOf)
    || !validTime(estimate.asOf) || !validTime(coverageAt)) return null;
  const averageTxsPerBlock = data.blockchain.tx24h === null || window.blockCount === 0
    ? null : data.blockchain.tx24h / window.blockCount;
  return {
    source: SOURCE, fetchedAt: stats.fetchedAt,
    stale: stats.stale || delayed(meta, estimate.asOf, coverageAt, estimate.tipHeight),
    observedAt: estimate.asOf, coverageAt, coverageHeight: estimate.tipHeight,
    windowSeconds: DAY_SECONDS, solrateGsols: window.hashrate === null ? null : window.hashrate / 1e9,
    difficulty: data.mining.difficulty, blocks24h: window.blockCount, averageTxsPerBlock,
    chainSizeBytes: data.blockchain.sizeBytes ?? null,
  };
}

function estimationSeries(
  history: Resource<History> | null, current: NetworkCurrent | null,
  period: NetworkPeriod, metric: "solrate" | "blocks",
): NetworkSeries | null {
  if (!history) return null;
  const { data, meta } = history.data;
  const requestedRange = period === "month" ? "30d" : "7d";
  if (data.period !== requestedRange || !validTime(data.sampledAt)
    || Date.parse(data.sampledAt) % (DAY_SECONDS * 1_000) !== 0) return null;
  const now = Date.now();
  const cutoff = now - (period === "month" ? 30 : period === "week" ? 7 : 1) * DAY_SECONDS * 1_000;
  const byTime = new Map<number, NetworkSeriesPoint>();
  for (const point of data.points) {
    const at = Date.parse(point.windowEnd);
    if (at < cutoff || at > now + FUTURE_TOLERANCE_MS || at > Date.parse(data.sampledAt)) continue;
    byTime.set(at, { time: point.windowEnd, current: false,
      value: metric === "solrate" ? point.hashrate === null ? null : point.hashrate / 1e9 : point.blockCount });
  }
  const lastHistorical = Math.max(...byTime.keys());
  if (current && Date.parse(current.observedAt) >= lastHistorical) {
    byTime.set(Date.parse(current.observedAt), { time: current.observedAt, current: true,
      value: metric === "solrate" ? current.solrateGsols : current.blocks24h });
  }
  const points = [...byTime.entries()].sort(([a], [b]) => a - b).map(([, point]) => point);
  // Midnight points are completed 24h windows, not an indexing timestamp.
  // Their expected daily cadence must not reuse the five-minute live threshold.
  const missedMidnight = Date.parse(data.sampledAt) < Math.floor(now / (DAY_SECONDS * 1_000)) * DAY_SECONDS * 1_000;
  const missingMidnight = !data.points.some((point) => Date.parse(point.windowEnd) === Date.parse(data.sampledAt));
  const stale = history.stale || missedMidnight || missingMidnight || current === null || current.stale
    || (meta.freshness?.status.toLowerCase() === "stale")
    || (meta.source?.observedAt != null && delayed(meta, meta.source.observedAt));
  return {
    source: SOURCE, metric, period, windowLabel: "Rolling 24h", points, truncated: false,
    fetchedAt: history.fetchedAt, stale,
    observedAt: current?.observedAt ?? data.sampledAt,
    coverageAt: current?.coverageAt ?? null, coverageHeight: current?.coverageHeight ?? null,
  };
}

function blockTimeData(value: Resource<BlockTime> | null, period: NetworkPeriod): NetworkSeries | null {
  if (!value) return null;
  const { data, meta } = value.data;
  const actualPeriod = period === "day" ? "day" : "week";
  if (data.period !== (actualPeriod === "day" ? "24h" : "7d") || !validTime(data.observedAt)) return null;
  const newest = data.points.reduce<BlockTime["data"]["points"][number] | null>(
    (latest, point) => !latest || point.height > latest.height ? point : latest, null,
  );
  const coverageAt = newest ? new Date(newest.timestamp * 1_000).toISOString() : null;
  if (coverageAt && !validTime(coverageAt)) return null;
  const byTime = new Map<number, { height: number; point: NetworkSeriesPoint }>();
  for (const point of data.points) {
    const time = point.timestamp * 1_000;
    if (time > Date.now() + FUTURE_TOLERANCE_MS) continue;
    if ((byTime.get(time)?.height ?? -1) > point.height) continue;
    byTime.set(time, { height: point.height, point: {
      time: new Date(time).toISOString(), value: point.averageSeconds,
      current: point.height === newest?.height,
    } });
  }
  return {
    source: SOURCE, metric: "blockTime", period: actualPeriod,
    windowLabel: `${data.rollingIntervals} block intervals`, truncated: data.truncated,
    fetchedAt: value.fetchedAt,
    stale: value.stale || delayed(meta, data.observedAt, coverageAt, newest?.height)
      || (newest != null && data.nodeHeight - newest.height > 10),
    observedAt: data.observedAt, coverageAt, coverageHeight: newest?.height ?? null,
    points: [...byTime.entries()].sort(([a], [b]) => a - b).map(([, value]) => value.point),
  };
}

/** Public current observations and daily 24h estimates; no finalized-only feed. */
export async function getNetworkActivity(period: NetworkPeriod): Promise<NetworkActivity> {
  const historyRange = period === "month" ? "30d" : "7d";
  const cadenceRange = period === "day" ? "24h" : "7d";
  const [stats, history, cadence] = await Promise.all([
    resource("/network/stats", 30_000, statsSchema),
    resource(`/mining/hashrate-history?period=${historyRange}&window=24h`, 60_000, historySchema),
    resource(`/network/block-time?period=${cadenceRange}`, 30_000, blockTimeSchema),
  ]);
  let current = currentData(stats);
  // Across midnight, a cached stats observation can precede the newest completed
  // historical window. Withhold it until current catches up, rather than append
  // an older endpoint or label a historical value as the current quote.
  if (current && history && Date.parse(current.observedAt) < Date.parse(history.data.data.sampledAt)) current = null;
  return {
    current,
    solrate: estimationSeries(history, current, period, "solrate"),
    blocks: estimationSeries(history, current, period, "blocks"),
    blockTime: blockTimeData(cadence, period),
  };
}
