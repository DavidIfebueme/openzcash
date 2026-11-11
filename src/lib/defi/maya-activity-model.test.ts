import { describe, expect, it } from "vitest";
import {
  parseMayaHealth,
  parseMayaNetwork,
  mayaIndexCurrent,
  midgardIndexRecent,
  parseMayaPool,
  parseSwapSummary,
  parseVolumeHistory,
  volumeSeries,
} from "./maya-activity-model";

// Public Midgard ZEC.ZEC response, checked September 22, 2026. USD fields
// are cents; the sum includes trade and synth activity as well as native swaps.
const totals = {
  startTime: "1678700896",
  endTime: "1790039428",
  totalCount: "924489",
  totalVolumeUSD: "27390369218",
  toAssetVolumeUSD: "4621447659",
  toRuneVolumeUSD: "2160049966",
  toTradeVolumeUSD: "8879620319",
  fromTradeVolumeUSD: "11090278564",
  synthMintVolumeUSD: "317832021",
  synthRedeemVolumeUSD: "321140689",
};
const interval = (month: number, volume: string, count = "1") => ({
  startTime: String(Date.UTC(2026, month - 1, 1) / 1000),
  endTime: String(Date.UTC(2026, month, 1) / 1000),
  totalVolumeUSD: volume,
  totalCount: count,
});

describe("Maya ZEC activity", () => {
  it("keeps halted trading separate from available pool status", () => {
    expect(
      parseMayaNetwork([
        { chain: "ZEC", halted: true, chain_trading_paused: false },
      ]).paused,
    ).toBe(true);
    expect(
      parseMayaNetwork([
        { chain: "ZEC", halted: false, chain_trading_paused: true },
      ]).paused,
    ).toBe(true);
    expect(
      parseMayaNetwork([
        { chain: "ZEC", halted: false, chain_trading_paused: false },
      ]).paused,
    ).toBe(false);
    expect(() => parseMayaNetwork([])).toThrow();
    expect(() =>
      parseMayaNetwork([{ chain: "ZEC", halted: "false" }]),
    ).toThrow();
  });
  it("reads a node that publishes only the halt flag", () => {
    // MayaNode's inbound_addresses row for ZEC, checked November 11, 2026,
    // carries `halted` and no trading-pause fields.
    expect(parseMayaNetwork([{ chain: "ZEC", halted: false }]).paused).toBe(
      false,
    );
    expect(parseMayaNetwork([{ chain: "ZEC", halted: true }]).paused).toBe(
      true,
    );
    expect(
      parseMayaNetwork([
        {
          chain: "ZEC",
          halted: false,
          chain_trading_paused: false,
          global_trading_paused: true,
        },
      ]).paused,
    ).toBe(true);
    expect(() =>
      parseMayaNetwork([
        { chain: "ZEC", halted: false, chain_trading_paused: "no" },
      ]),
    ).toThrow();
  });
  it("judges a Midgard index by its block age when inSync is not published reliably", () => {
    const now = Date.UTC(2026, 10, 11);
    const health = (age: number, inSync = false) => ({
      inSync,
      indexedAt: new Date(now - age).toISOString(),
    });
    expect(midgardIndexRecent(health(80_000), now)).toBe(true);
    expect(midgardIndexRecent(health(301_000), now)).toBe(false);
    expect(midgardIndexRecent(health(-61_000), now)).toBe(false);
    expect(midgardIndexRecent({ inSync: true, indexedAt: null }, now)).toBe(
      false,
    );
    expect(midgardIndexRecent(null, now)).toBe(false);
    // Maya keeps requiring both.
    expect(mayaIndexCurrent(health(80_000), now)).toBe(false);
    expect(mayaIndexCurrent(health(80_000, true), now)).toBe(true);
  });
  it("rejects a frozen index even when inSync remains true", () => {
    const now = Date.UTC(2026, 8, 23);
    const health = (age: number) => ({
      inSync: true,
      indexedAt: new Date(now - age).toISOString(),
    });
    expect(mayaIndexCurrent(health(10_000), now)).toBe(true);
    expect(mayaIndexCurrent(health(301_000), now)).toBe(false);
    expect(mayaIndexCurrent(health(-61_000), now)).toBe(false);
    expect(mayaIndexCurrent({ inSync: true, indexedAt: null }, now)).toBe(
      false,
    );
  });
  it("converts historical USD cents once and reconciles all three swap categories", () => {
    const result = parseSwapSummary({ meta: totals })!;
    expect(result.volumeUsd).toBe(273_903_692.18);
    expect(result.count).toBe(924_489);
    expect(result.breakdown).toEqual({
      native: 67_814_976.25,
      trade: 199_698_988.83,
      synth: 6_389_727.1,
    });
    expect(
      Object.values(result.breakdown!).reduce((s, v) => s + v, 0),
    ).toBeCloseTo(result.volumeUsd, 2);
  });
  it("does not mistake missing, unsafe or malformed data for zero activity", () => {
    for (const value of [
      undefined,
      null,
      "",
      "NaN",
      "Infinity",
      "-1",
      "1e8",
      "9007199254740993",
    ]) {
      expect(
        parseSwapSummary({ meta: { ...totals, totalVolumeUSD: value } }),
      ).toBeNull();
    }
    expect(parseSwapSummary({})).toBeNull();
    expect(
      parseSwapSummary({ meta: { ...totals, endTime: totals.startTime } }),
    ).toBeNull();
  });
  it("preserves a genuine zero returned by the API", () => {
    expect(parseSwapSummary({ meta: interval(9, "0", "0") })).toMatchObject({
      volumeUsd: 0,
      count: 0,
      breakdown: null,
    });
  });
  it("withholds incomplete or inconsistent category totals", () => {
    expect(
      parseSwapSummary({ meta: { ...totals, fromTradeVolumeUSD: undefined } })
        ?.breakdown,
    ).toBeNull();
    expect(
      parseSwapSummary({ meta: { ...totals, toAssetVolumeUSD: "999" } })
        ?.breakdown,
    ).toBeNull();
  });
  it("orders months and keeps zero-activity gaps and the partial trailing month", () => {
    const result = parseVolumeHistory({
      intervals: [
        interval(9, "0", "0"),
        interval(5, "0", "0"),
        interval(8, "200"),
        interval(6, "100"),
        interval(7, "0", "0"),
      ],
    })!;
    expect(result.map((m) => m.month)).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
    expect(result.map((m) => m.volumeUsd)).toEqual([1, 0, 2, 0]);
  });
  it("rejects a partial or duplicated history instead of silently undercounting it", () => {
    expect(
      parseVolumeHistory({
        intervals: [
          interval(6, "100"),
          { ...interval(7, "200"), totalVolumeUSD: null },
        ],
      }),
    ).toBeNull();
    expect(
      parseVolumeHistory({
        intervals: [interval(6, "100"), interval(6, "200")],
      }),
    ).toBeNull();
    expect(parseVolumeHistory({ intervals: [] })).toBeNull();
  });
  it("retains lifetime cumulative volume when narrowing the displayed range", () => {
    const months = parseVolumeHistory({
      intervals: [interval(5, "100"), interval(6, "200"), interval(7, "300")],
    })!;
    expect(volumeSeries(months, true, 2).map((m) => m.value)).toEqual([3, 6]);
    expect(volumeSeries(months, false, 2).map((m) => m.value)).toEqual([2, 3]);
  });
  it("uses ZEC's 8 decimals and CACAO's 10 decimals for pool depth", () => {
    expect(
      parseMayaPool({
        asset: "ZEC.ZEC",
        assetDepth: "264935302008",
        runeDepth: "206779402443146258",
        assetPriceUSD: "237.9296358125416",
        status: "available",
      }),
    ).toMatchObject({
      zec: 2649.35302008,
      cacao: 20677940.244314626,
      status: "available",
    });
    expect(
      parseMayaPool({
        asset: "BTC.BTC",
        assetDepth: "1",
        runeDepth: "1",
        status: "available",
      }),
    ).toBeNull();
    expect(
      parseMayaPool({
        asset: "ZEC.ZEC",
        assetDepth: "NaN",
        runeDepth: "1",
        status: "available",
      }),
    ).toBeNull();
  });
  it("does not invent a liquidity value when a USD quote is missing", () => {
    expect(
      parseMayaPool({
        asset: "ZEC.ZEC",
        assetDepth: "100000000",
        runeDepth: "20000000000",
        status: "available",
      })?.quotedTvlUsd,
    ).toBeNull();
  });
  it("retains source sync state and timestamp, including an out-of-sync response", () => {
    expect(
      parseMayaHealth({
        inSync: false,
        lastAggregated: { timestamp: 1790039491 },
      }),
    ).toEqual({
      inSync: false,
      indexedAt: new Date(1790039491 * 1000).toISOString(),
    });
    expect(parseMayaHealth({ inSync: "true" })).toBeNull();
  });
});
