import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BINGX,
  BITGET,
  BITSTAMP,
  DIRECT_EXCHANGES,
  directVenue,
  readDirectExchange,
} from "./exchanges-direct";
import { marketLogo } from "./logos";
import { DIRECT_EXCHANGE_IDS, HOUR } from "./model";

// Public ZEC spot tickers, checked November 11, 2026. None needs a key. All
// three exchanges were absent from the aggregator's ZEC market list that day.
const bitget = {
  code: "00000",
  msg: "success",
  requestTime: 1794376575827,
  data: [
    {
      open: "1160.65",
      symbol: "ZECUSDT",
      high24h: "1199.26",
      low24h: "994.41",
      lastPr: "1020.47",
      quoteVolume: "38126843.12",
      baseVolume: "35255.631",
      usdtVolume: "38126843.11945",
      ts: "1794376574684",
      bidPr: "1019.91",
      askPr: "1020.13",
      bidSz: "0.821",
      askSz: "5.074",
      openUtc: "1045.23",
      changeUtc24h: "-0.02298",
      change24h: "-0.12078",
    },
  ],
};
const bingx = {
  code: 0,
  timestamp: 1794376576973,
  data: [
    {
      symbol: "ZEC-USDT",
      openPrice: 1162.35,
      highPrice: 1198.91,
      lowPrice: 1000.0,
      lastPrice: 1019.78,
      priceChange: -142.57,
      priceChangePercent: "-12.27%",
      volume: 6757.31,
      quoteVolume: 7297241.83,
      openTime: 1794290176973,
      closeTime: 1794376576973,
      askPrice: 1019.96,
      askQty: 0.89449,
      bidPrice: 1019.71,
      bidQty: 0.0054,
    },
  ],
};
const bitstamp = {
  timestamp: "1794376577",
  open: "1045.31",
  high: "1196.97",
  low: "986.22",
  last: "1020.63",
  volume: "4972.72085",
  vwap: "1051.14",
  bid: "1018.75",
  ask: "1019.05",
  side: "0",
  open_24: "1160.00",
  percent_change_24: "-12.01",
  market_type: "SPOT",
};

// A few seconds after the three tickers were stamped.
const now = 1794376580000;
const samples = [
  { exchange: BITGET, raw: bitget, at: 1794376574684 },
  { exchange: BINGX, raw: bingx, at: 1794376576973 },
  { exchange: BITSTAMP, raw: bitstamp, at: 1794376577000 },
];
const withRow = <T extends { data: object[] }>(body: T, patch: object) => ({
  ...body,
  data: [{ ...body.data[0], ...patch }],
});

describe("exchanges read from their own public API", () => {
  it("reads Bitget's 24-hour USDT turnover for the exact ZECUSDT symbol", () => {
    expect(directVenue(BITGET, bitget, now)).toEqual({
      id: "bitget",
      name: "Bitget",
      kind: "cex",
      volumeUsd: 38_126_843.11945,
      pairs: 1,
      asOf: "2026-11-11T05:56:14.684Z",
      source:
        "https://api.bitget.com/api/v2/spot/market/tickers?symbol=ZECUSDT",
      note: "ZEC/USDT spot, 24-hour turnover reported by the exchange's public API. USDT treated as USD.",
    });
  });

  it("rejects a Bitget response it cannot verify", () => {
    for (const body of [
      withRow(bitget, { symbol: "ZECUSDC" }),
      withRow(bitget, { symbol: "XZECUSDT" }),
      withRow(bitget, { usdtVolume: "-1" }),
      withRow(bitget, { usdtVolume: "NaN" }),
      withRow(bitget, { usdtVolume: undefined }),
      withRow(bitget, { ts: "soon" }),
      { ...bitget, data: [...bitget.data, ...bitget.data] },
      { ...bitget, data: [] },
      // The live reply to an unknown symbol.
      {
        code: "40034",
        msg: "Parameter ZECXUSDT does not exist",
        requestTime: 1794376783504,
        data: null,
      },
    ])
      expect(() => directVenue(BITGET, body, now)).toThrow();
  });

  it("reads BingX's USDT turnover and links the endpoint without the request clock", () => {
    expect(directVenue(BINGX, bingx, now)).toEqual({
      id: "bingx",
      name: "BingX",
      kind: "cex",
      volumeUsd: 7_297_241.83,
      pairs: 1,
      asOf: "2026-11-11T05:56:16.973Z",
      source:
        "https://open-api.bingx.com/openApi/spot/v1/ticker/24hr?symbol=ZEC-USDT",
      note: "ZEC/USDT spot, turnover over the exchange's stated 24-hour window. USDT treated as USD.",
    });
  });

  it("requires BingX's exact symbol and a 24-hour window", () => {
    for (const body of [
      withRow(bingx, { symbol: "ZEC-USDC" }),
      withRow(bingx, { symbol: "ZEC-USDT-PERP" }),
      withRow(bingx, { quoteVolume: -5 }),
      withRow(bingx, { quoteVolume: "many" }),
      withRow(bingx, { openTime: bingx.data[0].closeTime - HOUR }),
      withRow(bingx, { openTime: bingx.data[0].closeTime - 48 * HOUR }),
      withRow(bingx, { openTime: undefined }),
      { ...bingx, data: [...bingx.data, ...bingx.data] },
      // The live reply to an unknown symbol.
      { code: 100204, msg: "symbol is not found.", timestamp: 1794376782127 },
    ])
      expect(() => directVenue(BINGX, body, now)).toThrow();
    // Clock jitter inside the stated window is not a different window.
    expect(
      directVenue(
        BINGX,
        withRow(bingx, { openTime: bingx.data[0].openTime + 30_000 }),
        now,
      ).volumeUsd,
    ).toBe(7_297_241.83);
  });

  it("prices Bitstamp's ZEC volume at its own 24-hour average", () => {
    // 4,972.72085 ZEC × 1,051.14 USD.
    expect(directVenue(BITSTAMP, bitstamp, now)).toEqual({
      id: "bitstamp",
      name: "Bitstamp",
      kind: "cex",
      volumeUsd: 5_227_025.79,
      pairs: 1,
      asOf: "2026-11-11T05:56:17.000Z",
      source: "https://www.bitstamp.net/api/v2/ticker/zecusd/",
      note: "ZEC/USD spot: 24-hour ZEC volume × the exchange's 24-hour volume-weighted average price. The smaller ZEC/EUR book is not added.",
    });
  });

  it("rejects a Bitstamp response it cannot verify", () => {
    for (const body of [
      // An unknown pair is answered with every ticker on the exchange.
      [bitstamp, bitstamp],
      { ...bitstamp, market_type: "PERPETUAL" },
      { ...bitstamp, market_type: undefined },
      { ...bitstamp, vwap: undefined },
      { ...bitstamp, volume: "-1" },
      { ...bitstamp, vwap: "1e400" },
      { ...bitstamp, timestamp: "2026-11-11" },
    ])
      expect(() => directVenue(BITSTAMP, body, now)).toThrow();
  });

  it("applies the aggregator's freshness window to every ticker", () => {
    for (const { exchange, raw, at } of samples) {
      expect(
        directVenue(exchange, raw, at + 2 * HOUR).volumeUsd,
      ).toBeGreaterThan(0);
      expect(() => directVenue(exchange, raw, at + 2 * HOUR + 1_000)).toThrow();
      expect(directVenue(exchange, raw, at - 5 * 60_000).asOf).toBe(
        new Date(at).toISOString(),
      );
      expect(() =>
        directVenue(exchange, raw, at - 5 * 60_000 - 1_000),
      ).toThrow();
    }
  });

  it("keeps a reported zero as a value", () => {
    expect(
      directVenue(BITGET, withRow(bitget, { usdtVolume: "0" }), now).volumeUsd,
    ).toBe(0);
    expect(
      directVenue(BITSTAMP, { ...bitstamp, volume: "0.00000000" }, now)
        .volumeUsd,
    ).toBe(0);
  });

  it("requests each endpoint once and records the endpoint as the venue's source", async () => {
    const requested: string[] = [];
    const replies = new Map<string, unknown>([
      [BITGET.endpoint, bitget],
      [`${BINGX.endpoint}&timestamp=${now}`, bingx],
      [BITSTAMP.endpoint, bitstamp],
    ]);
    const venues = await Promise.all(
      DIRECT_EXCHANGES.map((exchange) =>
        readDirectExchange(
          exchange,
          async (url) => {
            requested.push(url);
            return replies.get(url);
          },
          now,
        ),
      ),
    );
    expect(venues.map((v) => v.id)).toEqual(["bitget", "bingx", "bitstamp"]);
    expect(requested).toEqual([
      BITGET.endpoint,
      `${BINGX.endpoint}&timestamp=${now}`,
      BITSTAMP.endpoint,
    ]);
    expect(venues.map((v) => v.source)).toEqual(
      DIRECT_EXCHANGES.map((e) => e.endpoint),
    );
    expect(venues.every((v) => v.kind === "cex")).toBe(true);
    await expect(
      readDirectExchange(BITGET, async () => ({ code: "50000" }), now),
    ).rejects.toThrow();
  });

  it("is the single source for its exchanges and has a local mark for each", () => {
    expect(DIRECT_EXCHANGES.map((e) => e.id).sort()).toEqual(
      [...DIRECT_EXCHANGE_IDS].sort(),
    );
    for (const exchange of DIRECT_EXCHANGES) {
      const logo = marketLogo(exchange.name);
      expect(logo).toBe(`/logos/markets/${exchange.id}.png`);
      expect(existsSync(`public${logo}`)).toBe(true);
      expect(exchange.coverage.length).toBeGreaterThan(0);
    }
  });
});
