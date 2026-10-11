import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const fetchMock = vi.fn();
const start = new Date("2026-10-11T00:00:00Z");
const seconds = Math.floor(start.getTime() / 1_000);
const height = 3_513_500;

function block(index = 0) {
  return {
    height: height - index, hash: (index + 1).toString(16).padStart(64, "0"),
    time: seconds - index * 75, difficulty: 200_000_000,
    tx_count: index + 1, size: 2_000, miner: { pool_name: "ViaBTC" },
    total_minted_zatoshis: 156_250_000, miner_subsidy_zatoshis: 125_000_000,
    transaction_fees_zatoshis: index * 10_000, status: "PENDING",
  };
}

function dashboard() {
  return {
    info: { best_block: height, chain_tip: height, difficulty: 200_000_000,
      status: "synced", target_block_spacing_secs: 75, work_per_difficulty: 8_192 },
    pools: { total_supply_zatoshis: 1_000_000_000_000_000,
      transparent_zatoshis: 500_000_000_000_000, ironwood_zatoshis: 200_000_000_000_000,
      orchard_zatoshis: 100_000_000_000_000, sapling_zatoshis: 100_000_000_000_000,
      sprout_zatoshis: 50_000_000_000_000, lockbox_zatoshis: 50_000_000_000_000 },
    recent_blocks: [block(), block(1), block(2)],
  };
}

function apiResponse(url: string) {
  if (url.includes("/dashboard")) return dashboard();
  if (url.includes("/blocks?")) return { blocks: [block(), block(1), block(2)] };
  if (url.includes("/blocks/latest/canonical")) return [block(1)];
  if (url.includes("/mining/history?")) return { buckets: [
    { timestamp: seconds - 7_200, avg_difficulty: 190_000_000,
      avg_network_hashrate_gsols: 20.75, block_count: 48, min_height: height - 97, max_height: height - 50 },
    { timestamp: seconds - 3_600, avg_difficulty: 190_000_000,
      avg_network_hashrate_gsols: 20.75, block_count: 48, min_height: height - 49, max_height: height - 1 },
  ] };
  if (url.includes("/mining/pools?")) return { total_blocks: 100, pools: [
    { pool_name: null, block_count: 40, share_percentage: 40 },
    { pool_name: "ViaBTC", block_count: 60, share_percentage: 60 },
  ] };
  if (url.includes("/mempool")) return { size: 0, bytes: 0 };
  throw new Error("Unexpected endpoint");
}

const ok = (data: unknown) => ({ ok: true, json: async () => data });

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(start);
  fetchMock.mockReset().mockImplementation(async (url: string) => ok(apiResponse(url)));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Zcash network public data", () => {
  it("normalizes real source units, includes Ironwood and deferred funds, and keeps zero mempool values", async () => {
    const { getNetworkSnapshot } = await import("./provider");
    const snapshot = await getNetworkSnapshot();
    expect(snapshot).toMatchObject({ status: "live", period: "day", stale: false });
    expect(snapshot.core).toMatchObject({
      height, targetBlockSeconds: 75, sampleBlocks: 3, averageBlockSeconds: 75,
      averageTxsPerBlock: 2, averageFeesZecPerBlock: 0.0001,
      totalSupplyZec: 10_000_000, poolTotalZec: 10_000_000,
      shieldedZec: 4_500_000, shieldedPercent: 45,
      lastBlockAt: start.toISOString(), fetchedAt: start.toISOString(),
      emission: { nextHalvingHeight: 4_406_400, blocksRemaining: 892_900,
        blockSubsidyZec: 1.5625, minerSubsidyZec: 1.25, nextBlockSubsidyZec: 0.78125 },
    });
    expect(snapshot.core?.solrateGsols).toBeCloseTo(200_000_000 * 8_192 / 75 / 1e9);
    expect(snapshot.core?.pools).toContainEqual({ id: "ironwood", name: "Ironwood", zec: 2_000_000, shielded: true });
    expect(snapshot.core?.pools).toContainEqual({ id: "lockbox", name: "Deferred Lockbox", zec: 500_000, shielded: false });
    expect(snapshot.mining?.pools[0]).toEqual({ name: "ViaBTC", blocks: 60, sharePercent: 60 });
    expect(snapshot.mining?.pools[1].name).toBe("Unknown");
    expect(snapshot.mempool).toMatchObject({ count: 0, bytes: 0, stale: false });
    expect(snapshot.history).toMatchObject({ coverageAt: new Date(start.getTime() - 75_000).toISOString(),
      coverageHeight: height - 1, lagBlocks: 1, bucketSeconds: 3_600 });
    expect(snapshot.history?.points.at(-1)?.partial).toBe(true);
    expect(snapshot.history?.points[0].partial).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("withholds core metrics when every dashboard and sample block is stale", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/dashboard")) return ok({ ...dashboard(),
        recent_blocks: dashboard().recent_blocks.map((value) => ({ ...value, status: "STALE" })),
      });
      if (url.includes("/blocks?")) return ok({ blocks: [block(), block(1)].map((value) => ({
        ...value, status: "STALE",
      })) });
      return ok(apiResponse(url));
    });
    const { getNetworkSnapshot } = await import("./provider");
    const snapshot = await getNetworkSnapshot();
    expect(snapshot).toMatchObject({ status: "partial", core: null, unavailableSections: ["core"] });
  });

  it("uses valid dashboard blocks if the larger sample contains only stale blocks", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/blocks?")) return ok({ blocks: [{ ...block(), status: "STALE" }] });
      return ok(apiResponse(url));
    });
    const { getNetworkSnapshot } = await import("./provider");
    expect((await getNetworkSnapshot()).core).toMatchObject({
      height, sampleBlocks: 3, averageTxsPerBlock: 2, stale: false,
    });
  });

  it.each([
    { indexed: 4_406_400, observed: 4_406_399, minted: 156_250_000,
      nextHeight: 4_406_400, remaining: 1, nextSubsidy: 0.78125 },
    { indexed: 4_406_399, observed: 4_406_400, minted: 78_125_000,
      nextHeight: 6_086_400, remaining: 1_680_000, nextSubsidy: 0.390625 },
  ])("keeps halving era, amount and ETA aligned to observed height $observed", async (value) => {
    const observedBlock = (index = 0) => ({ ...block(index),
      height: value.observed - index, total_minted_zatoshis: value.minted,
    });
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/dashboard")) return ok({ ...dashboard(),
        info: { ...dashboard().info, best_block: value.indexed, chain_tip: value.observed },
        recent_blocks: [observedBlock(), observedBlock(1), observedBlock(2)],
      });
      if (url.includes("/blocks?")) return ok({ blocks: [observedBlock(), observedBlock(1)] });
      return ok(apiResponse(url));
    });
    const { getNetworkSnapshot } = await import("./provider");
    const snapshot = await getNetworkSnapshot();
    expect(snapshot.core?.emission).toMatchObject({
      nextHalvingHeight: value.nextHeight, blocksRemaining: value.remaining,
      nextBlockSubsidyZec: value.nextSubsidy,
      estimatedHalvingAt: new Date(start.getTime() + value.remaining * 75_000).toISOString(),
    });
  });

  it("deduplicates parallel page requests and caches shared core data across selected periods", async () => {
    const { getNetworkSnapshot } = await import("./provider");
    const [first, second] = await Promise.all([getNetworkSnapshot(), getNetworkSnapshot()]);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    await getNetworkSnapshot("week");
    await getNetworkSnapshot("month");
    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect(fetchMock.mock.calls.map(([url]) => url)).toContain("https://api.zcashinfo.com/api/v1/mining/history?range=1w");
    expect(fetchMock.mock.calls.map(([url]) => url)).toContain("https://api.zcashinfo.com/api/v1/mining/pools?interval=1m");
  });

  it("preserves the last core reading and its timestamp on failure while other sections refresh", async () => {
    const { getNetworkSnapshot } = await import("./provider");
    const initial = await getNetworkSnapshot();
    vi.setSystemTime(new Date(start.getTime() + 31_000));
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/dashboard") || url.includes("/blocks?")) throw new Error("offline");
      return ok(apiResponse(url));
    });
    const stale = await getNetworkSnapshot();
    expect(stale).toMatchObject({ status: "partial", stale: true, fetchedAt: initial.fetchedAt });
    expect(stale.core).toEqual({ ...initial.core, stale: true });
    expect(stale.mempool).toMatchObject({ fetchedAt: new Date(start.getTime() + 31_000).toISOString(), stale: false });
    const count = fetchMock.mock.calls.length;
    await getNetworkSnapshot();
    expect(fetchMock).toHaveBeenCalledTimes(count);
  });

  it("flags an old indexer history even when its HTTP request succeeds", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const data = apiResponse(url);
      if (url.includes("/mining/history?")) {
        return ok({ buckets: [{ timestamp: seconds - 20 * 3_600,
          avg_difficulty: 100, avg_network_hashrate_gsols: 10, block_count: 3,
          min_height: height - 1_002, max_height: height - 1_000 }] });
      }
      return ok(data);
    });
    const { getNetworkSnapshot } = await import("./provider");
    const snapshot = await getNetworkSnapshot();
    expect(snapshot.status).toBe("partial");
    expect(snapshot.core?.stale).toBe(false);
    expect(snapshot.history).toMatchObject({ stale: true, fetchedAt: start.toISOString(),
      lastPointAt: new Date(start.getTime() - 20 * 3_600_000).toISOString() });
  });

  it("detects stalled daily history across every period using indexed block time and marks the last count partial", async () => {
    const indexedTime = seconds - 21 * 3_600;
    const indexedHeight = height - 1_000;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/blocks/latest/canonical")) return ok([{ height: indexedHeight, time: indexedTime }]);
      if (url.includes("/mining/history?")) return ok({ buckets: [
        { timestamp: seconds - 2 * 86_400, avg_difficulty: 100,
          avg_network_hashrate_gsols: 10, block_count: 1_152,
          min_height: indexedHeight - 1_346, max_height: indexedHeight - 195 },
        { timestamp: seconds - 86_400, avg_difficulty: 100,
          avg_network_hashrate_gsols: 10, block_count: 195,
          min_height: indexedHeight - 194, max_height: indexedHeight },
      ] });
      return ok(apiResponse(url));
    });
    const { getNetworkSnapshot } = await import("./provider");
    for (const period of ["day", "week", "month"] as const) {
      const snapshot = await getNetworkSnapshot(period);
      expect(snapshot.status).toBe("partial");
      expect(snapshot.core?.stale).toBe(false);
      expect(snapshot.history).toMatchObject({ stale: true, bucketSeconds: 86_400,
        coverageAt: new Date(indexedTime * 1_000).toISOString(), coverageHeight: indexedHeight, lagBlocks: 1_000 });
      expect(snapshot.history?.points[0].partial).toBe(false);
      expect(snapshot.history?.points.at(-1)).toMatchObject({ partial: true, blocks: 195 });
    }
  });

  it("does not certify the final bucket using an independent canonical reading", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/mining/history?")) return ok({ buckets: [
        { timestamp: seconds - 7_320, avg_difficulty: 100,
          avg_network_hashrate_gsols: 10, block_count: 48, min_height: height - 100, max_height: height - 51 },
        { timestamp: seconds - 3_720, avg_difficulty: 100,
          avg_network_hashrate_gsols: 10, block_count: 48, min_height: height - 50, max_height: height - 2 },
      ] });
      return ok(apiResponse(url));
    });
    const { getNetworkSnapshot } = await import("./provider");
    const snapshot = await getNetworkSnapshot();
    expect(snapshot.history).toMatchObject({ stale: false, lagBlocks: 2,
      coverageAt: new Date(block(2).time * 1_000).toISOString() });
    expect(snapshot.history?.points.at(-1)?.partial).toBe(true);
  });

  it("does not promote a cached partial bucket when canonical data refreshes first", async () => {
    const { getNetworkSnapshot } = await import("./provider");
    const first = await getNetworkSnapshot();
    expect(first.history?.points.at(-1)?.partial).toBe(true);
    vi.setSystemTime(new Date(start.getTime() + 31_000));
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/blocks/latest/canonical")) return ok([{ ...block(), time: seconds + 1 }]);
      if (url.includes("/mining/history?")) {
        const previousHistory = apiResponse(url);
        if (!("buckets" in previousHistory) || !Array.isArray(previousHistory.buckets)) {
          throw new Error("Expected history fixture");
        }
        return ok({ buckets: [
          ...previousHistory.buckets,
          { timestamp: seconds, avg_difficulty: 190_000_000,
            avg_network_hashrate_gsols: 20.75, block_count: 1, min_height: height, max_height: height },
        ] });
      }
      return ok(apiResponse(url));
    });
    const cached = await getNetworkSnapshot();
    expect(cached.history?.fetchedAt).toBe(first.history?.fetchedAt);
    expect(cached.history?.points).toEqual(first.history?.points);
    expect(fetchMock.mock.calls.filter(([url]) => url.includes("/mining/history?")).length).toBe(1);

    vi.setSystemTime(new Date(start.getTime() + 121_000));
    const refreshed = await getNetworkSnapshot();
    expect(refreshed.history?.points.at(-2)?.partial).toBe(false);
    expect(refreshed.history?.points.at(-1)?.partial).toBe(true);
    expect(fetchMock.mock.calls.filter(([url]) => url.includes("/mining/history?")).length).toBe(2);
  });

  it("does not infer a bucket width from a single point or invent an unmatched coverage timestamp", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/mining/history?")) return ok({ buckets: [
        { timestamp: seconds - 3_600, avg_difficulty: 100,
          avg_network_hashrate_gsols: 10, block_count: 48, min_height: height - 52, max_height: height - 4 },
      ] });
      return ok(apiResponse(url));
    });
    const { getNetworkSnapshot } = await import("./provider");
    expect((await getNetworkSnapshot()).history).toMatchObject({ coverageAt: null, bucketSeconds: null,
      coverageHeight: height - 4, lagBlocks: 4, points: [{ partial: true }] });
  });

  it("returns missing sections without fabricated metrics and rejects malformed core values", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/dashboard")) return ok({ ...dashboard(), pools: { ...dashboard().pools, ironwood_zatoshis: -1 } });
      if (url.includes("/mempool")) return { ok: false };
      return ok(apiResponse(url));
    });
    const { getNetworkSnapshot } = await import("./provider");
    const snapshot = await getNetworkSnapshot();
    expect(snapshot).toMatchObject({ status: "partial", core: null, mempool: null,
      unavailableSections: ["core", "mempool"] });
    fetchMock.mockRejectedValue(new Error("offline"));
    vi.setSystemTime(new Date(start.getTime() + 130_000));
    expect(await getNetworkSnapshot()).toMatchObject({ status: "stale", core: null, mempool: null });
  });

  it("retains extra future value pools without assuming they are private or hiding their balances", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/dashboard")) return ok({ ...dashboard(), pools: {
        ...dashboard().pools, future_pool_zatoshis: 100_000_000,
      } });
      return ok(apiResponse(url));
    });
    const { getNetworkSnapshot } = await import("./provider");
    const snapshot = await getNetworkSnapshot();
    expect(snapshot.core?.poolTotalZec).toBe(10_000_001);
    expect(snapshot.core?.pools).toContainEqual({ id: "future_pool", name: "future_pool", zec: 1, shielded: false });
    expect(snapshot.core?.shieldedPercent).toBeCloseTo(4_500_000 / 10_000_001 * 100);
  });

  it("uses the source block target and withholds a halving projection for changed consensus", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/dashboard")) return ok({ ...dashboard(), info: {
        ...dashboard().info, target_block_spacing_secs: 25,
      } });
      return ok(apiResponse(url));
    });
    const { getNetworkSnapshot } = await import("./provider");
    const snapshot = await getNetworkSnapshot();
    expect(snapshot.core?.targetBlockSeconds).toBe(25);
    expect(snapshot.core?.solrateGsols).toBeCloseTo(200_000_000 * 8_192 / 25 / 1e9);
    expect(snapshot.core?.emission).toMatchObject({ blockSubsidyZec: 1.5625,
      nextHalvingHeight: null, blocksRemaining: null, estimatedHalvingAt: null });
  });

  it("reports complete cold-cache feed loss as unavailable", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { getNetworkSnapshot } = await import("./provider");
    expect(await getNetworkSnapshot()).toMatchObject({ status: "unavailable", fetchedAt: null,
      core: null, history: null, mining: null, mempool: null });
  });
});
