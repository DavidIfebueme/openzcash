import { describe, expect, it } from "vitest";
import {
  parseThorAllTime,
  parseThorPoolDepth,
  parseThorWindow,
  thorVenue,
  thorWindowUrl,
} from "./thorchain";

// Public THORChain Midgard ZEC.ZEC responses, checked November 11, 2026. USD
// fields are integer cents. The total includes trade-asset and secured-asset
// legs, all executed against the same native pool.
const from = 1794285258;
const to = 1794371658;
const window = {
  intervals: [],
  meta: {
    startTime: String(from),
    endTime: String(to),
    totalCount: "79967",
    totalVolumeUSD: "334507968",
    toAssetVolumeUSD: "151649380",
    toRuneVolumeUSD: "25652210",
    toTradeVolumeUSD: "768632",
    fromTradeVolumeUSD: "123240008",
    toSecuredVolumeUSD: "14812784",
    fromSecuredVolumeUSD: "18384954",
    synthMintVolumeUSD: "0",
    synthRedeemVolumeUSD: "0",
  },
};
const registry = [
  { asset: "BTC.BTC", assetDepth: "66300412345", status: "available" },
  { asset: "ZEC.ZEC", assetDepth: "3067101330", status: "available" },
];

describe("THORChain ZEC pool", () => {
  it("reads the native pool depth by exact asset name", () => {
    expect(parseThorPoolDepth(registry)).toBeCloseTo(30.6710133, 7);
  });

  it("reports an absent pool as not listed instead of zero", () => {
    expect(parseThorPoolDepth([registry[0]])).toBeNull();
    expect(
      parseThorPoolDepth([{ asset: "ETH.ZEC-0X1234", assetDepth: "1" }]),
    ).toBeNull();
  });

  it("rejects a registry it cannot verify", () => {
    expect(() => parseThorPoolDepth({ pools: registry })).toThrow();
    expect(() =>
      parseThorPoolDepth([{ asset: "ZEC.ZEC", assetDepth: "-5" }]),
    ).toThrow();
    expect(() =>
      parseThorPoolDepth([
        { asset: "ZEC.ZEC", assetDepth: "2100000100000000" },
      ]),
    ).toThrow();
  });

  it("converts the 24-hour window from cents, secured legs included", () => {
    const summary = parseThorWindow(window, from, to);
    expect(summary.volumeUsd).toBe(3_345_079.68);
    expect(summary.count).toBe(79_967);
  });

  it("requires the returned window to be the requested one", () => {
    expect(() => parseThorWindow(window, from - 3_600, to)).toThrow();
    expect(() => parseThorWindow(window, from, to + 121)).toThrow();
    expect(() => parseThorWindow({ meta: {} }, from, to)).toThrow();
    expect(parseThorWindow(window, from + 60, to - 60).volumeUsd).toBe(
      3_345_079.68,
    );
  });

  it("builds one protocol-level DEX venue with its own source", () => {
    const url = thorWindowUrl(from, to);
    expect(url).toBe(
      `https://gateway.liquify.com/chain/thorchain_midgard/v2/history/swaps?pool=ZEC.ZEC&from=${from}&to=${to}`,
    );
    expect(thorVenue(parseThorWindow(window, from, to), url)).toEqual({
      id: "thorchain",
      name: "THORChain",
      kind: "dex",
      volumeUsd: 3_345_079.68,
      pairs: 1,
      asOf: new Date(to * 1000).toISOString(),
      source: url,
      note: "ZEC pool swaps, including trade and secured assets. Midgard USD cents converted to dollars. Counted once at protocol level.",
    });
  });

  it("keeps the all-time total only while the index is following the chain", () => {
    const allTime = {
      meta: {
        startTime: "1618012800",
        endTime: String(to),
        totalCount: "289372",
        totalVolumeUSD: "983069012",
      },
    };
    expect(parseThorAllTime(allTime, to * 1000 + 30_000)).toEqual({
      volumeAllTimeUsd: 9_830_690.12,
    });
    expect(() => parseThorAllTime(allTime, to * 1000 + 601_000)).toThrow();
    expect(() => parseThorAllTime(allTime, to * 1000 - 61_000)).toThrow();
    expect(() => parseThorAllTime({}, to * 1000)).toThrow();
  });
});
