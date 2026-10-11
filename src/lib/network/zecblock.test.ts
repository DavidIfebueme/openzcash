import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const fetchMock = vi.fn();
const start = new Date("2026-10-11T03:30:00Z");
const height = 3_513_633;
const meta = () => ({ network: "mainnet", generatedAt: start.toISOString(), indexedHeight: height,
  source: { observedAt: null }, freshness: { status: "unknown", ageSeconds: null } });

function estimate(end: string, hashrate: number | null = 30e9, blockCount = 1_200) {
  return { hashrate, blockCount, windowSeconds: 86_400,
    windowStart: new Date(Date.parse(end) - 86_400_000).toISOString(), windowEnd: end,
    expectedWork: hashrate === null ? null : String(hashrate * 86_400),
    unavailableReason: hashrate === null ? "missing-targets" : null, method: "target-work-v1" };
}
function stats() {
  return { data: { mining: { difficulty: 300_000_000,
    // This separate 1000-block statistic must never feed the 120-interval tile.
    avgBlockTime: 999,
    hashrateEstimate: { asOf: start.toISOString(), tipHeight: height, tipHash: "a".repeat(64),
      tipTimestamp: start.getTime() / 1_000 - 90, windows: { "24h": estimate(start.toISOString()) } } },
    blockchain: { tx24h: 3_600 } }, meta: meta() };
}
function history(period = "7d") {
  return { data: { period, window: "24h", method: "target-work-v1",
    sampledAt: "2026-10-11T00:00:00Z", points: [
      { date: "2026-10-09T00:00:00Z", ...estimate("2026-10-09T00:00:00Z", 20e9, 1_000) },
      { date: "2026-10-10T00:00:00Z", ...estimate("2026-10-10T00:00:00Z", null, 1_100) },
      { date: "2026-10-11T00:00:00Z", ...estimate("2026-10-11T00:00:00Z", 25e9, 1_150) },
    ] }, meta: meta() };
}
function blockTime(period = "24h") {
  return { data: { period, source: "canonical-block-header-timestamps", observedAt: start.toISOString(),
    rollingIntervals: 120, nodeHeight: height, indexedHeight: height, truncated: false, downsampleEvery: 2,
    points: [
      { height: height - 2, timestamp: start.getTime() / 1_000 - 240,
        intervalSeconds: 75, averageSeconds: null, targetSeconds: 75, intervals: 119 },
      { height: height - 1, timestamp: start.getTime() / 1_000 - 165,
        intervalSeconds: 75, averageSeconds: 76, targetSeconds: 75, intervals: 120 },
      { height, timestamp: start.getTime() / 1_000 - 90,
        intervalSeconds: 75, averageSeconds: 75, targetSeconds: 75, intervals: 120 },
    ] }, meta: meta() };
}
function apiResponse(url: string) {
  const parsed = new URL(url);
  if (parsed.pathname.endsWith("/network/stats")) return stats();
  if (parsed.pathname.endsWith("/hashrate-history")) return history(parsed.searchParams.get("period")!);
  if (parsed.pathname.endsWith("/block-time")) return blockTime(parsed.searchParams.get("period")!);
  throw new Error("Unexpected endpoint");
}
const ok = (data: unknown) => ({ ok: true, json: async () => data });
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(start);
  fetchMock.mockReset().mockImplementation(async (url: string) => ok(apiResponse(url)));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("ZecBlock public current observations", () => {
  it("uses one work-based 24h quote for the headline and current chart endpoint", async () => {
    const { getNetworkActivity } = await import("./zecblock");
    const value = await getNetworkActivity("week");
    expect(value.current).toMatchObject({ source: { name: "ZecBlock" }, stale: false,
      observedAt: start.toISOString(), coverageHeight: height, solrateGsols: 30,
      windowSeconds: 86_400, blocks24h: 1_200, averageTxsPerBlock: 3, difficulty: 300_000_000 });
    expect(value.solrate?.points.at(-1)).toEqual({ time: start.toISOString(), value: 30, current: true });
    expect(value.blocks?.points.at(-1)?.value).toBe(value.current?.blocks24h);
    expect(value.solrate?.points.at(-1)?.value).toBe(value.current?.solrateGsols);
    expect(value.solrate?.windowLabel).toBe("Rolling 24h");
    expect(value.solrate?.points[1].value).toBeNull();
    expect(value.blocks?.points[1].value).toBe(1_100);
    expect(value.blockTime?.points.find((point) => point.current)?.value).toBe(75);
    expect(value.blockTime?.windowLabel).toBe("120 block intervals");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.every(([, options]) => options.cache === "no-store"
      && options.signal instanceof AbortSignal && !options.headers.authorization)).toBe(true);
  });

  it("uses source bytes without copying the upstream mislabeled GiB field", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const body = apiResponse(url);
      if (!url.endsWith("/stats")) return ok(body);
      const data = stats();
      return ok({ ...data, data: { ...data.data, blockchain: {
        ...data.data.blockchain, sizeBytes: 282_244_954_280, sizeGB: 262.86,
      } } });
    });
    expect((await (await import("./zecblock")).getNetworkActivity("day")).current?.chainSizeBytes)
      .toBe(282_244_954_280);
  });

  it.each([undefined, -1, Number.MAX_SAFE_INTEGER + 1, "282GB"])(
    "withholds invalid storage %s without losing network activity", async (sizeBytes) => {
      fetchMock.mockImplementation(async (url: string) => {
        if (!url.endsWith("/stats")) return ok(apiResponse(url));
        const data = stats();
        return ok({ ...data, data: { ...data.data, blockchain: { ...data.data.blockchain, sizeBytes } } });
      });
      expect((await (await import("./zecblock")).getNetworkActivity("day")).current)
        .toMatchObject({ solrateGsols: 30, chainSizeBytes: null });
    },
  );

  it("filters day to its real samples and reports the supported block-time range", async () => {
    const { getNetworkActivity } = await import("./zecblock");
    const day = await getNetworkActivity("day");
    expect(day.solrate?.points.map((point) => point.time)).toEqual(["2026-10-11T00:00:00Z", start.toISOString()]);
    expect(day.blockTime?.period).toBe("day");
    const month = await getNetworkActivity("month");
    expect(month.solrate?.period).toBe("month");
    expect(month.blockTime?.period).toBe("week");
    expect(fetchMock.mock.calls.map(([url]) => url)).toContain("https://api.zecblock.com/v1/network/block-time?period=7d");
    expect(fetchMock.mock.calls.map(([url]) => url)).toContain("https://api.zecblock.com/v1/mining/hashrate-history?period=30d&window=24h");
  });

  it("keeps missing target-work estimates as gaps while retaining observed block counts", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const body = apiResponse(url);
      if (url.endsWith("/stats")) {
        const data = stats();
        data.data.mining.hashrateEstimate.windows["24h"] = estimate(start.toISOString(), null);
        return ok(data);
      }
      return ok(body);
    });
    const value = await (await import("./zecblock")).getNetworkActivity("week");
    expect(value.current?.solrateGsols).toBeNull();
    expect(value.solrate?.points.at(-1)).toMatchObject({ value: null, current: true });
    expect(value.current?.blocks24h).toBe(1_200);
  });

  it.each(["method", "window", "windowEnd"])("refuses a mismatched current %s", async (field) => {
    fetchMock.mockImplementation(async (url: string) => {
      if (!url.endsWith("/stats")) return ok(apiResponse(url));
      const data = stats(); const window = data.data.mining.hashrateEstimate.windows["24h"];
      if (field === "method") window.method = "legacy-difficulty";
      if (field === "window") window.windowSeconds = 604_800;
      if (field === "windowEnd") window.windowEnd = "2026-10-11T03:29:00Z";
      return ok(data);
    });
    const value = await (await import("./zecblock")).getNetworkActivity("week");
    expect(value.current).toBeNull();
    expect(value.solrate?.points.some((point) => point.current)).toBe(false);
    expect(value.blockTime).not.toBeNull();
  });

  it("does not relabel a successful response containing old source data as live", async () => {
    vi.setSystemTime(new Date(start.getTime() + 6 * 60_000));
    const value = await (await import("./zecblock")).getNetworkActivity("week");
    expect(value.current).toMatchObject({ stale: true, observedAt: start.toISOString(),
      fetchedAt: new Date(start.getTime() + 6 * 60_000).toISOString() });
    expect(value.solrate?.stale).toBe(true);
    expect(value.blockTime?.stale).toBe(true);
  });

  it("honors stale metadata even with a recent endpoint-specific observation", async () => {
    fetchMock.mockImplementation(async (url: string) => ok({ ...apiResponse(url),
      meta: { ...meta(), freshness: { status: "stale", ageSeconds: 360 } } }));
    const value = await (await import("./zecblock")).getNetworkActivity("week");
    expect(value.current?.stale).toBe(true);
    expect(value.solrate?.stale).toBe(true);
    expect(value.blockTime?.stale).toBe(true);
  });

  it("rejects future observation timestamps and a different network", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/stats")) {
        const body = stats(); body.data.mining.hashrateEstimate.asOf = "2026-10-12T03:30:00Z";
        body.data.mining.hashrateEstimate.windows["24h"] = estimate(body.data.mining.hashrateEstimate.asOf);
        return ok(body);
      }
      return ok({ ...apiResponse(url), meta: { ...meta(), network: "testnet" } });
    });
    expect(await (await import("./zecblock")).getNetworkActivity("week")).toEqual({
      current: null, solrate: null, blocks: null, blockTime: null,
    });
  });

  it.each([NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1])("rejects unsafe counts %s", async (count) => {
    fetchMock.mockImplementation(async (url: string) => {
      if (!url.endsWith("/stats")) return ok(apiResponse(url));
      const data = stats(); data.data.mining.hashrateEstimate.windows["24h"].blockCount = count;
      return ok(data);
    });
    expect((await (await import("./zecblock")).getNetworkActivity("week")).current).toBeNull();
  });

  it("keeps observation resources independent when a historical request fails", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("hashrate-history")) throw new Error("Unavailable");
      return ok(apiResponse(url));
    });
    const value = await (await import("./zecblock")).getNetworkActivity("day");
    expect(value.current?.stale).toBe(false);
    expect(value.blockTime?.stale).toBe(false);
    expect(value.solrate).toBeNull(); expect(value.blocks).toBeNull();
  });

  it("preserves original retrieval and observation times on a warm request failure", async () => {
    const { getNetworkActivity } = await import("./zecblock");
    const initial = await getNetworkActivity("day");
    vi.setSystemTime(new Date(start.getTime() + 31_000));
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/stats")) throw new Error("Unavailable");
      return ok(apiResponse(url));
    });
    const fallback = await getNetworkActivity("day");
    expect(fallback.current).toMatchObject({ fetchedAt: initial.current?.fetchedAt,
      observedAt: initial.current?.observedAt, stale: true });
    expect(fallback.solrate?.stale).toBe(true);
    expect(fallback.blockTime?.stale).toBe(false);
    const attempts = fetchMock.mock.calls.length;
    vi.setSystemTime(new Date(start.getTime() + 35_000));
    expect((await getNetworkActivity("day")).current?.stale).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(attempts);
    vi.setSystemTime(new Date(start.getTime() + 42_000));
    await getNetworkActivity("day");
    expect(fetchMock).toHaveBeenCalledTimes(attempts + 1);
  });

  it("does not replace a valid warm snapshot with a successful but invalid future response", async () => {
    const { getNetworkActivity } = await import("./zecblock");
    const initial = await getNetworkActivity("week");
    vi.setSystemTime(new Date(start.getTime() + 31_000));
    fetchMock.mockImplementation(async (url: string) => {
      if (!url.endsWith("/stats")) return ok(apiResponse(url));
      const body = stats(); body.data.mining.hashrateEstimate.asOf = "2026-10-12T03:30:00Z";
      body.data.mining.hashrateEstimate.windows["24h"] = estimate(body.data.mining.hashrateEstimate.asOf);
      return ok(body);
    });
    expect((await getNetworkActivity("week")).current).toMatchObject({
      stale: true, observedAt: initial.current?.observedAt, fetchedAt: initial.current?.fetchedAt,
      solrateGsols: initial.current?.solrateGsols,
    });
  });

  it("withholds an empty cadence feed while preserving independently valid current observations", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (!url.includes("block-time")) return ok(apiResponse(url));
      const body = blockTime("7d"); body.data.points = []; return ok(body);
    });
    const value = await (await import("./zecblock")).getNetworkActivity("week");
    expect(value.blockTime).toBeNull();
    expect(value.current?.solrateGsols).toBe(30);
  });

  it("deduplicates concurrent requests and shares canonical resources across chart ranges", async () => {
    const { getNetworkActivity } = await import("./zecblock");
    await Promise.all([getNetworkActivity("day"), getNetworkActivity("day"), getNetworkActivity("day")]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await getNetworkActivity("week");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    await getNetworkActivity("month");
    expect(fetchMock).toHaveBeenCalledTimes(5);
    await getNetworkActivity("day");
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("never claims yesterday's completed windows are today's live history", async () => {
    vi.setSystemTime(new Date("2026-10-12T00:02:00Z"));
    const value = await (await import("./zecblock")).getNetworkActivity("week");
    expect(value.solrate?.stale).toBe(true);
    expect(value.blocks?.stale).toBe(true);
  });

  it("detects missing latest midnight samples and preserves a null latest sample", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (!url.includes("hashrate-history")) return ok(apiResponse(url));
      const body = history(); body.data.points.pop(); return ok(body);
    });
    expect((await (await import("./zecblock")).getNetworkActivity("week")).solrate?.stale).toBe(true);
  });

  it("withholds a cached current observation that precedes the latest completed history window", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (!url.endsWith("/stats")) return ok(apiResponse(url));
      const body = stats(); body.data.mining.hashrateEstimate.asOf = "2026-10-10T23:59:00Z";
      body.data.mining.hashrateEstimate.windows["24h"] = estimate(body.data.mining.hashrateEstimate.asOf);
      return ok(body);
    });
    const value = await (await import("./zecblock")).getNetworkActivity("week");
    expect(value.current).toBeNull();
    expect(value.solrate?.points.at(-1)?.current).toBe(false);
  });

  it("does not connect omitted historical days as if the source observed a continuous curve", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (!url.includes("hashrate-history")) return ok(apiResponse(url));
      const body = history(); body.data.points.splice(1, 1); return ok(body);
    });
    const value = await (await import("./zecblock")).getNetworkActivity("week");
    expect(value.solrate).toBeNull(); expect(value.blocks).toBeNull();
    expect(value.current?.solrateGsols).toBe(30);
  });

  it("keeps the highest height at an equal timestamp even when upstream rows are unordered", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (!url.includes("block-time")) return ok(apiResponse(url));
      const body = blockTime("7d"); body.data.points[2].timestamp = body.data.points[1].timestamp;
      body.data.points.reverse(); return ok(body);
    });
    const value = await (await import("./zecblock")).getNetworkActivity("week");
    expect(value.blockTime?.points.filter((point) => point.current)).toHaveLength(1);
    expect(value.blockTime?.points.find((point) => point.current)?.value).toBe(75);
    expect(value.blockTime?.coverageHeight).toBe(height);
  });

  it("marks the highest canonical height as current without altering nonmonotonic header timestamps", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (!url.includes("block-time")) return ok(apiResponse(url));
      const body = blockTime("7d"); body.data.points[2].timestamp = body.data.points[1].timestamp - 1;
      body.data.points[2].intervalSeconds = -1; return ok(body);
    });
    const value = await (await import("./zecblock")).getNetworkActivity("week");
    expect(value.blockTime?.coverageHeight).toBe(height);
    expect(value.blockTime?.points.find((point) => point.current)).toMatchObject({ value: 75,
      time: new Date((start.getTime() / 1_000 - 166) * 1_000).toISOString() });
    expect(value.blockTime?.points.at(-1)?.current).toBe(false);
  });
});
