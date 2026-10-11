import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NetworkActivity, NetworkPeriod, NetworkSeries } from "./types";

vi.mock("server-only", () => ({}));
const { activityMock, economicsMock } = vi.hoisted(() => ({ activityMock: vi.fn(), economicsMock: vi.fn() }));
vi.mock("./economics", () => ({ getNetworkEconomics: economicsMock }));
vi.mock("./zecblock", () => ({ getNetworkActivity: activityMock }));

const fetchMock = vi.fn();
const start = new Date("2026-10-11T00:00:00Z");
const seconds = Math.floor(start.getTime() / 1_000);
const height = 3_513_500;

function activity(period: NetworkPeriod = "day"): NetworkActivity {
  const fetchedAt = new Date().toISOString();
  const source = { name: "ZecBlock", url: "https://zecblock.com/", docsUrl: "https://zecblock.com/api" };
  const series = (metric: NetworkSeries["metric"], value: number): NetworkSeries => ({
    fetchedAt, stale: false, source, metric, windowLabel: "24-hour window",
    observedAt: fetchedAt, coverageAt: fetchedAt, coverageHeight: height,
    period, truncated: false, points: [{ time: fetchedAt, value, current: true }],
  });
  return {
    current: { fetchedAt, stale: false, source, observedAt: fetchedAt, coverageAt: fetchedAt,
      coverageHeight: height, windowSeconds: 86_400, solrateGsols: 31,
      difficulty: 210_000_000, blocks24h: 1_140, averageTxsPerBlock: 4, chainSizeBytes: 282_000_000_000 },
    solrate: series("solrate", 31),
    blocks: series("blocks", 1_140),
    blockTime: series("blockTime", 75),
  };
}

function economics() {
  const source = { name: "ZecBlock", url: "https://zecblock.com/", docsUrl: "https://zecblock.com/docs" };
  const fetchedAt = new Date().toISOString();
  return {
    inflation: { source, fetchedAt, stale: false, day: "2026-10-10", observedAt: "2026-10-10T23:59:59Z",
      dailyIssuanceZec: 1_800, supplyZec: 17_000_000, annualizedPercent: 3.86 },
    market: { source: { name: "CoinGecko", url: "https://coingecko.com/", docsUrl: "https://docs.coingecko.com/" },
      fetchedAt, stale: false, observedAt: fetchedAt, zecBtc: 0.015, btcPercent: 1.5 },
  };
}

const noActivity: NetworkActivity = { current: null, solrate: null, blocks: null, blockTime: null };

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
  activityMock.mockReset().mockImplementation(async (period: NetworkPeriod) => activity(period));
  economicsMock.mockReset().mockImplementation(async () => economics());
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
    expect(snapshot.activity).toEqual(activity());
    expect(snapshot.source.name).toBe("Zcash Info");
    expect(snapshot.activity.current?.source.name).toBe("ZecBlock");
    expect(snapshot).not.toHaveProperty("history");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(expect.arrayContaining([
      "https://api.zcashinfo.com/api/v1/dashboard",
      "https://api.zcashinfo.com/api/v1/blocks?limit=100",
      "https://api.zcashinfo.com/api/v1/mining/pools?interval=24h",
      "https://api.zcashinfo.com/api/v1/mempool",
    ]));
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
    expect(fetchMock).toHaveBeenCalledTimes(4);
    await getNetworkSnapshot("week");
    await getNetworkSnapshot("month");
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock.mock.calls.map(([url]) => url)).toContain("https://api.zcashinfo.com/api/v1/mining/pools?interval=1m");
    expect(activityMock.mock.calls.map(([period]) => period)).toEqual(["day", "day", "week", "month"]);
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

  it("keeps the adapter's independent source windows and readings intact", async () => {
    const reading = activity("month");
    reading.blockTime = { ...reading.blockTime!, period: "day", truncated: true,
      windowLabel: "Rolling 120 block intervals", coverageHeight: height - 2 };
    activityMock.mockResolvedValue(reading);
    const { getNetworkSnapshot } = await import("./provider");
    const snapshot = await getNetworkSnapshot("month");
    expect(activityMock).toHaveBeenCalledWith("month");
    expect(snapshot.activity).toBe(reading);
    expect(snapshot.activity.current?.solrateGsols).toBe(31);
    expect(snapshot.activity.solrate?.points.at(-1)?.value).toBe(31);
    expect(snapshot.activity.blockTime).toMatchObject({ period: "day", truncated: true,
      windowLabel: "Rolling 120 block intervals", coverageHeight: height - 2 });
    expect(snapshot.core?.difficulty).toBe(200_000_000);
    expect(snapshot.activity.current?.difficulty).toBe(210_000_000);
  });

  it("keeps valid legacy sections when the activity source is unavailable", async () => {
    activityMock.mockResolvedValue(noActivity);
    const { getNetworkSnapshot } = await import("./provider");
    const snapshot = await getNetworkSnapshot();
    expect(snapshot).toMatchObject({ status: "partial", stale: false, activity: noActivity,
      unavailableSections: ["activity.current", "activity.solrate", "activity.blockTime"] });
    expect(snapshot.core?.stale).toBe(false);
    expect(snapshot.mining?.stale).toBe(false);
    expect(snapshot.mempool).toMatchObject({ count: 0, bytes: 0, stale: false });
  });

  it.each(["current", "solrate", "blockTime"] as const)(
    "reports a stale activity %s reading without marking fresh core data stale", async (section) => {
      const reading = activity();
      reading[section]!.stale = true;
      reading[section]!.fetchedAt = new Date(start.getTime() - 20 * 3_600_000).toISOString();
      activityMock.mockResolvedValue(reading);
      const { getNetworkSnapshot } = await import("./provider");
      const snapshot = await getNetworkSnapshot();
      expect(snapshot).toMatchObject({ status: "partial", stale: false, unavailableSections: [] });
      expect(snapshot.core?.stale).toBe(false);
      expect(snapshot.activity[section]).toBe(reading[section]);
      expect(snapshot.activity[section]?.stale).toBe(true);
    },
  );

  it("counts the shared solrate and block count feed only once in source health", async () => {
    const reading = activity();
    reading.solrate = null;
    reading.blocks = null;
    activityMock.mockResolvedValue(reading);
    const { getNetworkSnapshot } = await import("./provider");
    expect(await getNetworkSnapshot()).toMatchObject({ status: "partial",
      unavailableSections: ["activity.solrate"] });
  });

  it("retains fresh activity when every legacy endpoint fails on a cold cache", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { getNetworkSnapshot } = await import("./provider");
    const snapshot = await getNetworkSnapshot();
    expect(snapshot).toMatchObject({ status: "partial", fetchedAt: start.toISOString(),
      core: null, mining: null, mempool: null, unavailableSections: ["core", "mining", "mempool"] });
    expect(snapshot.activity).toEqual(activity());
  });

  it("reports cached feed loss as stale when every remaining section is stale", async () => {
    const reading = activity();
    const { getNetworkSnapshot } = await import("./provider");
    const initial = await getNetworkSnapshot();
    vi.setSystemTime(new Date(start.getTime() + 130_000));
    fetchMock.mockRejectedValue(new Error("offline"));
    for (const section of Object.values(reading)) if (section) section.stale = true;
    const staleEconomics = economics();
    staleEconomics.inflation.stale = true;
    staleEconomics.market.stale = true;
    economicsMock.mockResolvedValue(staleEconomics);
    activityMock.mockResolvedValue(reading);
    const snapshot = await getNetworkSnapshot();
    expect(snapshot).toMatchObject({ status: "stale", stale: true, fetchedAt: initial.fetchedAt,
      unavailableSections: [] });
    expect(snapshot.core).toEqual({ ...initial.core, stale: true });
    expect(snapshot.mining).toEqual({ ...initial.mining, stale: true });
    expect(snapshot.mempool).toEqual({ ...initial.mempool, stale: true });
    expect(snapshot.activity).toBe(reading);
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
    expect(await getNetworkSnapshot()).toMatchObject({ status: "partial", core: null, mempool: null });
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

  it("reports a missing market quote independently while retaining the latest inflation reading", async () => {
    const reading = economics();
    economicsMock.mockResolvedValue({ ...reading, market: null });
    const snapshot = await (await import("./provider")).getNetworkSnapshot();
    expect(snapshot).toMatchObject({ status: "partial", market: null, unavailableSections: ["market"] });
    expect(snapshot.inflation).toBe(reading.inflation);
    expect(snapshot.core?.stale).toBe(false);
  });

  it("reports stale economics without changing its timestamps or marking core data stale", async () => {
    const reading = economics();
    reading.market.stale = true;
    reading.market.observedAt = "2026-10-10T23:30:00Z";
    economicsMock.mockResolvedValue(reading);
    const snapshot = await (await import("./provider")).getNetworkSnapshot();
    expect(snapshot).toMatchObject({ status: "partial", stale: false, unavailableSections: [] });
    expect(snapshot.market).toBe(reading.market);
  });

  it("reports complete cold-cache feed loss as unavailable", async () => {
    economicsMock.mockResolvedValue({ inflation: null, market: null });
    fetchMock.mockRejectedValue(new Error("offline"));
    activityMock.mockResolvedValue(noActivity);
    const { getNetworkSnapshot } = await import("./provider");
    expect(await getNetworkSnapshot()).toMatchObject({ status: "unavailable", fetchedAt: null,
      core: null, activity: noActivity, mining: null, mempool: null,
      unavailableSections: ["core", "activity.current", "activity.solrate", "activity.blockTime", "mining", "mempool", "inflation", "market"] });
  });
});
