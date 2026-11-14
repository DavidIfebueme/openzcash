import { describe, expect, it } from "vitest";
import {
  chainContext,
  nextHalvingHeight,
  priceHistoryContext,
  requestedPeriod,
  type DaysDoc,
} from "./chain";

const supply = {
  zec: 16_950_000,
  height: 3_500_000,
  pools: [
    { id: "transparent", zec: 12_000_000 },
    { id: "sprout", zec: 50_000 },
    { id: "sapling", zec: 900_000 },
    { id: "orchard", zec: 3_850_000 },
    { id: "lockbox", zec: 150_000 },
  ],
  lockedZec: 150_000,
  shieldedZec: 4_800_000,
  fetchedAt: "2026-09-28T09:58:00.000Z",
  stale: false,
};
const circulating = {
  zec: 16_945_106,
  quotedAt: "2026-09-28T09:50:00.000Z",
  fetchedAt: "2026-09-28T09:55:00.000Z",
  stale: false,
  sourceUrl: "https://api.coingecko.com/api/v3/coins/markets",
};
const now = Date.parse("2026-09-28T10:00:00.000Z");

describe("Chain facts", () => {
  it("knows the protocol halving heights", () => {
    expect(nextHalvingHeight(1_000_000)).toBe(1_046_400);
    expect(nextHalvingHeight(2_726_399)).toBe(2_726_400);
    expect(nextHalvingHeight(2_726_400)).toBe(6_132_390);
    expect(nextHalvingHeight(3_500_000)).toBe(6_132_390);
    expect(nextHalvingHeight(6_132_389)).toBe(6_132_390);
    expect(nextHalvingHeight(6_132_390)).toBe(11_172_390);
    expect(nextHalvingHeight(11_172_390)).toBe(16_212_390);
  });
  it("estimates a pre-NU7 tip across the spacing change and a post-NU7 tip at 25 seconds", () => {
    const base = { readAt: "2026-11-13T10:00:00.000Z", supply: null, circulating: null };
    const pre = chainContext({ ...base, height: 3_500_000 }, now);
    // 43,404 blocks at 75 s up to block 3,543,404, then 2,588,986 blocks at 25 s.
    const preSeconds = 43_404 * 75 + 2_588_986 * 25;
    expect(pre.halving?.estimatedAt).toBe(new Date(now + preSeconds * 1000).toISOString());
    const post = chainContext({ ...base, height: 4_000_000 }, now);
    expect(post.halving).toMatchObject({
      nextHeight: 6_132_390,
      blocksRemaining: 2_132_390,
      subsidyZecPerBlock: 0.52083333,
      subsidyAfterNextZecPerBlock: 0.26041666,
    });
    expect(post.halving?.estimatedAt).toBe(new Date(now + 2_132_390 * 25_000).toISOString());
    expect(post.halving?.basis).toContain("25 seconds");
    expect(post.halving?.basis).toContain("6,132,390");
    expect(post.halving?.basis).not.toMatch(/75-second|4,406,400/);
  });
  it("carries a time or height on every figure and estimates the halving from a pre-NU7 tip", () => {
    const data = chainContext(
      {
        height: 3_500_000,
        readAt: "2026-09-28T10:00:00.000Z",
        supply,
        circulating,
      },
      now,
    );
    expect(data.tip).toMatchObject({
      height: 3_500_000,
      readAt: "2026-09-28T10:00:00.000Z",
    });
    expect(data.halving).toMatchObject({
      nextHeight: 6_132_390,
      blocksRemaining: 2_632_390,
      estimatedDaysRemaining: 786.8,
      halvingsSoFar: 2,
      subsidyZecPerBlock: 1.5625,
      subsidyAfterNextZecPerBlock: 0.26041666,
    });
    expect(data.halving?.estimatedAt).toBe(
      new Date(now + (43_404 * 75 + 2_588_986 * 25) * 1000).toISOString(),
    );
    expect(data.supply).toMatchObject({
      chainSupplyZec: 16_950_000,
      atHeight: 3_500_000,
      shieldedZec: 4_800_000,
      transparentZec: 12_000_000,
      lockboxZec: 150_000,
      fetchedAt: supply.fetchedAt,
      stale: false,
    });
    expect(data.circulating).toMatchObject({
      zec: 16_945_106,
      quotedAt: circulating.quotedAt,
    });
    expect(data.tipNote).toBeUndefined();
    expect(data.supplyNote).toBeUndefined();
  });
  it("leaves unavailable readings null with a note and never estimates a height or a date without a tip", () => {
    const data = chainContext(
      {
        height: 0,
        readAt: "2026-09-28T10:00:00.000Z",
        supply: null,
        circulating: null,
      },
      now,
    );
    expect(data).toMatchObject({
      tip: null,
      halving: null,
      supply: null,
      circulating: null,
    });
    expect(data.tipNote).toContain("unavailable");
    expect(data.halvingNote).toContain("cannot be estimated");
    expect(data.supplyNote).toContain("unavailable");
    expect(data.circulatingNote).toContain("unavailable");
    expect(JSON.stringify(data)).not.toMatch(/NaN|4406400|4,406,400/);
  });
});

const doc: DaysDoc = {
  generatedAt: "2026-09-24T23:03:33.568Z",
  through: { date: "2026-09-23", height: 3_493_963 },
  sources: {
    prices: "https://api-pub.bitfinex.com/v2/candles/trade:1D:tZECUSD/hist",
    note: "Bitfinex daily close",
  },
  rows: [
    ["2016-10-28", 0, 629, null],
    ["2025-12-31", 3_100_000, 3_101_151, 410.5],
    ["2026-01-01", 3_101_152, 3_102_303, 400],
    ["2026-01-02", 3_102_304, 3_103_455, 380.25],
    ["2026-01-03", 3_103_456, 3_104_607, 420],
    ["2026-02-01", 3_140_000, 3_141_151, 500],
    ["2026-09-23", 3_492_812, 3_493_963, 1_532.71],
  ],
};
describe("Historical ZEC/USD closes", () => {
  it("reads a day, month or year from English and Portuguese questions", () => {
    expect(requestedPeriod("What was the ZEC price in January 2026?")).toEqual({
      kind: "month",
      value: "2026-01",
    });
    expect(
      requestedPeriod("Qual era o preço do ZEC em 2 de janeiro de 2026?"),
    ).toEqual({ kind: "day", value: "2026-01-02" });
    expect(requestedPeriod("price on Jan 3rd, 2026")).toEqual({
      kind: "day",
      value: "2026-01-03",
    });
    expect(requestedPeriod("ZEC price history 2025")).toEqual({
      kind: "year",
      value: "2025",
    });
    expect(requestedPeriod("ZEC price on 2026-02-01")).toEqual({
      kind: "day",
      value: "2026-02-01",
    });
    expect(requestedPeriod("current price")).toBeNull();
  });
  it("summarizes the requested period with dated low, high and average, from the dataset only", () => {
    const month = priceHistoryContext("ZEC price in January 2026", doc);
    expect(month).toMatchObject({
      requested: { kind: "month", value: "2026-01" },
      covered: { from: "2026-01-01", to: "2026-01-03" },
      summary: {
        firstClose: 400,
        lastClose: 420,
        low: { date: "2026-01-02", usd: 380.25 },
        high: { date: "2026-01-03", usd: 420 },
        averageClose: 400.08,
        daysWithPrice: 3,
        daysWithoutPrice: 0,
      },
      through: "2026-09-23",
      source: doc.sources.prices,
    });
    expect(month.days).toHaveLength(3);
    const year = priceHistoryContext("preço do ZEC em 2026", doc);
    expect(year.months?.map((m) => m.month)).toEqual([
      "2026-01",
      "2026-02",
      "2026-09",
    ]);
    expect(year.days).toBeUndefined();
    expect(priceHistoryContext("2016-10-28", doc).summary).toBeNull();
  });
  it("says when a period is outside the dataset instead of estimating", () => {
    const missing = priceHistoryContext("ZEC price in December 2026", doc);
    expect(missing).toMatchObject({ covered: null, summary: null, days: [] });
    expect(missing.note).toContain("Do not estimate");
    expect(priceHistoryContext("", doc).requested).toEqual({
      kind: "recent",
      value: "last 30 recorded days",
    });
  });
});
