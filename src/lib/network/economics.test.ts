import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const fetchMock = vi.fn();
const start = new Date("2026-10-11T17:30:00Z");
const DAY_MS = 86_400_000;
const ok = (data: unknown) => ({ ok: true, json: async () => data });
function emission() {
  return { data: { supplyHistory: [
    { date: "2026-10-08T23:59:59.000Z", circulatingZat: 1_697_582_047_804_480, height: 3_511_160 },
    { date: "2026-10-09T23:59:59.000Z", circulatingZat: 1_697_762_047_804_480, height: 3_512_312 },
    { date: "2026-10-10T23:59:59.000Z", circulatingZat: 1_697_942_672_804_480, height: 3_513_468 },
    { date: "2026-10-11T17:00:01.418Z", circulatingZat: 1_698_068_610_304_480, height: 3_514_274 },
  ], dailyEmissionEstimate: 9_999 }, meta: { network: "mainnet", freshness: { status: "unknown" } } };
}
function price() { return { zcash: { btc: 0.01528339, last_updated_at: start.getTime() / 1_000 - 20 } }; }
function fallbackPrice() {
  return { id: "zec-zcash", last_updated: "2026-10-11T17:29:30Z", quotes: { BTC: { price: 0.0153 } } };
}
function response(url: string) { return url.includes("/emission?") ? emission() : price(); }
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(start);
  fetchMock.mockReset().mockImplementation(async (url: string) => ok(response(url)));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Network economics", () => {
  it("annualizes net issued supply over the last complete UTC day, never a partial day or projection", async () => {
    const { inflation } = await (await import("./economics")).getNetworkEconomics();
    expect(inflation).toMatchObject({ day: "2026-10-10", observedAt: "2026-10-10T23:59:59.000Z",
      dailyIssuanceZec: 1_806.25, supplyZec: 16_979_426.7280448, stale: false, source: { name: "ZecBlock" } });
    expect(inflation?.annualizedPercent).toBeCloseTo(1_806.25 * 365 / 16_979_426.7280448 * 100, 10);
  });

  it("expresses the price of one ZEC as a percentage of one BTC", async () => {
    const { market } = await (await import("./economics")).getNetworkEconomics();
    expect(market).toMatchObject({ zecBtc: 0.01528339,
      observedAt: "2026-10-11T17:29:40.000Z", fetchedAt: start.toISOString(), stale: false,
      source: { name: "CoinGecko" } });
    expect(market?.btcPercent).toBeCloseTo(1.528339, 10);
    expect(fetchMock.mock.calls.some(([url]) => url.includes("vs_currencies=btc"))).toBe(true);
  });

  it("deduplicates concurrent requests and uses a shared ten-minute cache", async () => {
    const { getNetworkEconomics } = await import("./economics");
    const [first, second] = await Promise.all([getNetworkEconomics(), getNetworkEconomics()]);
    expect(first).toEqual(second);
    vi.setSystemTime(new Date(start.getTime() + 60_000));
    expect(await getNetworkEconomics()).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([, options]) => options.cache === "no-store"
      && options.signal instanceof AbortSignal && !options.headers.authorization)).toBe(true);
  });

  it("preserves both timestamps and marks cached quotes stale on source failure", async () => {
    const { getNetworkEconomics } = await import("./economics");
    const initial = await getNetworkEconomics();
    vi.setSystemTime(new Date(start.getTime() + 11 * 60_000));
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await getNetworkEconomics()).toEqual({
      inflation: { ...initial.inflation, stale: true }, market: { ...initial.market, stale: true },
    });
    await getNetworkEconomics();
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("keeps inflation available when market data fails and returns null on a cold cache", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("coingecko")) throw new Error("offline");
      return ok(emission());
    });
    const value = await (await import("./economics")).getNetworkEconomics();
    expect(value.inflation?.stale).toBe(false);
    expect(value.market).toBeNull();
  });

  it.each([0, -1, NaN, Infinity, Number.MAX_VALUE])("rejects invalid BTC quotes %s", async (btc) => {
    fetchMock.mockImplementation(async (url: string) => ok(url.includes("coingecko")
      ? { zcash: { ...price().zcash, btc } } : emission()));
    expect((await (await import("./economics")).getNetworkEconomics()).market).toBeNull();
  });

  it("retains a good quote when the refreshed source claims a future time", async () => {
    const { getNetworkEconomics } = await import("./economics");
    const first = await getNetworkEconomics();
    vi.setSystemTime(new Date(start.getTime() + 11 * 60_000));
    fetchMock.mockImplementation(async (url: string) => ok(url.includes("coingecko")
      ? { zcash: { ...price().zcash, last_updated_at: Date.now() / 1_000 + 3_600 } } : emission()));
    expect((await getNetworkEconomics()).market).toEqual({ ...first.market, stale: true });
  });

  it("keeps old market observation time stale even when a request succeeds now", async () => {
    vi.setSystemTime(new Date(start.getTime() + 11 * 60_000));
    const value = await (await import("./economics")).getNetworkEconomics();
    expect(value.market).toMatchObject({ stale: true, observedAt: "2026-10-11T17:29:40.000Z",
      fetchedAt: new Date().toISOString() });
  });

  it("marks a missing daily update stale rather than moving its observation date", async () => {
    vi.setSystemTime(new Date(start.getTime() + DAY_MS));
    const value = await (await import("./economics")).getNetworkEconomics();
    expect(value.inflation).toMatchObject({ stale: true, day: "2026-10-10", observedAt: "2026-10-10T23:59:59.000Z" });
  });

  it.each(["gap", "unsafe", "testnet", "duplicate"])("withholds annualization for %s supply readings", async (invalid) => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("coingecko")) return ok(price());
      const body = emission();
      if (invalid === "gap") body.data.supplyHistory.splice(1, 1);
      if (invalid === "unsafe") body.data.supplyHistory[2].circulatingZat = Number.MAX_SAFE_INTEGER + 1;
      if (invalid === "testnet") body.meta.network = "testnet";
      if (invalid === "duplicate") body.data.supplyHistory.push({ ...body.data.supplyHistory[2] });
      return ok(body);
    });
    expect((await (await import("./economics")).getNetworkEconomics()).inflation).toBeNull();
  });

  it.each(["gap", "duplicate"])("retains the last valid inflation observation on refreshed %s days", async (invalid) => {
    const { getNetworkEconomics } = await import("./economics");
    const first = await getNetworkEconomics();
    vi.setSystemTime(new Date(start.getTime() + 11 * 60_000));
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("coingecko")) return ok(price());
      const body = emission();
      if (invalid === "gap") body.data.supplyHistory.splice(1, 1);
      else body.data.supplyHistory.push({ ...body.data.supplyHistory[2] });
      return ok(body);
    });
    expect((await getNetworkEconomics()).inflation).toEqual({ ...first.inflation, stale: true });
  });


  it("uses CoinPaprika's direct BTC price and observation time when CoinGecko returns 403", async () => {
    fetchMock.mockImplementation(async (url: string) => url.includes("coingecko")
      ? { ok: false, status: 403 } : ok(url.includes("coinpaprika") ? fallbackPrice() : emission()));
    const { getNetworkEconomics } = await import("./economics");
    const [first, second] = await Promise.all([getNetworkEconomics(), getNetworkEconomics()]);
    expect(first.market).toMatchObject({ zecBtc: 0.0153, btcPercent: 1.53,
      observedAt: "2026-10-11T17:29:30.000Z", fetchedAt: start.toISOString(), stale: false,
      source: { name: "CoinPaprika", url: "https://coinpaprika.com/coin/zec-zcash/" } });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith("zec-zcash?quotes=BTC"))).toBe(true);
    await getNetworkEconomics();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("prefers a fresh fallback over an available but stale primary quote", async () => {
    fetchMock.mockImplementation(async (url: string) => ok(url.includes("coingecko")
      ? { zcash: { ...price().zcash, last_updated_at: start.getTime() / 1_000 - 3_600 } }
      : url.includes("coinpaprika") ? fallbackPrice() : emission()));
    expect((await (await import("./economics")).getNetworkEconomics()).market)
      .toMatchObject({ source: { name: "CoinPaprika" }, stale: false });
  });

  it("preserves fallback attribution and both timestamps when both sources later fail", async () => {
    fetchMock.mockImplementation(async (url: string) => url.includes("coingecko")
      ? { ok: false, status: 403 } : ok(url.includes("coinpaprika") ? fallbackPrice() : emission()));
    const { getNetworkEconomics } = await import("./economics");
    const first = await getNetworkEconomics();
    vi.setSystemTime(new Date(start.getTime() + 11 * 60_000));
    fetchMock.mockRejectedValue(new Error("offline"));
    expect((await getNetworkEconomics()).market).toEqual({ ...first.market, stale: true });
  });

  it("returns no quote when both sources fail on a cold cache", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (!url.includes("/emission?")) throw new Error("offline");
      return ok(emission());
    });
    expect((await (await import("./economics")).getNetworkEconomics()).market).toBeNull();
  });

  it.each(["future", "invalid", "missing", "zero", "negative", "overflow", "wrong-coin"])(
    "rejects invalid fallback %s readings without replacing a previous valid quote", async (invalid) => {
      fetchMock.mockImplementation(async (url: string) => url.includes("coingecko")
        ? { ok: false, status: 403 } : ok(url.includes("coinpaprika") ? fallbackPrice() : emission()));
      const { getNetworkEconomics } = await import("./economics");
      const first = await getNetworkEconomics();
      vi.setSystemTime(new Date(start.getTime() + 11 * 60_000));
      const body: Record<string, unknown> = fallbackPrice();
      if (invalid === "future") body.last_updated = new Date(Date.now() + 3_600_000).toISOString();
      if (invalid === "invalid") body.last_updated = "not a date";
      if (invalid === "missing") delete body.last_updated;
      if (invalid === "zero") body.quotes = { BTC: { price: 0 } };
      if (invalid === "negative") body.quotes = { BTC: { price: -1 } };
      if (invalid === "overflow") body.quotes = { BTC: { price: Number.MAX_VALUE } };
      if (invalid === "wrong-coin") body.id = "btc-bitcoin";
      fetchMock.mockImplementation(async (url: string) => url.includes("coingecko")
        ? { ok: false, status: 403 } : ok(url.includes("coinpaprika") ? body : emission()));
      expect((await getNetworkEconomics()).market).toEqual({ ...first.market, stale: true });
    },
  );

  it("keeps zero net issuance zero, including a transfer of already-issued lockbox coins", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("coingecko")) return ok(price());
      const body = emission();
      body.data.supplyHistory[2].circulatingZat = body.data.supplyHistory[1].circulatingZat;
      return ok(body);
    });
    expect((await (await import("./economics")).getNetworkEconomics()).inflation)
      .toMatchObject({ dailyIssuanceZec: 0, annualizedPercent: 0 });
  });
});
