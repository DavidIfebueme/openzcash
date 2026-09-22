import { describe, expect, it } from "vitest";
import {
  comparison,
  groupHolders,
  holderIdentity,
  parse21Shares,
  parseAddressDetail,
  parseAddressZec,
  parseCypherpunk,
  parseGrayscale,
  parseHyperliquid,
  parseMarkets,
  parseNearExplorer,
  parseSupply,
  simulateShift,
  type AddressBalance,
} from "./model";

const now = Date.parse("2026-09-22T22:00:00Z");
const exchanges = [
  { id: "cex", type: ["cex"] },
  { id: "dex", type: ["dex"] },
  { id: "hyperliquid", type: ["dex"] },
];
const market = {
  exchange_id: "cex",
  exchange_name: "Example CEX",
  pair: "ZEC/USD",
  base_currency_id: "zec-zcash",
  quote_currency_id: "usd-us-dollars",
  category: "Spot",
  outlier: false,
  last_updated: "2026-09-22T21:59:00Z",
  quotes: { USD: { price: 1500, volume_24h: 900 } },
};
const address = "t1Ku2KLyndDPsR32jwnrTMd3yvi9tfFP8ML";
const renderData = (data: unknown) =>
  `<script>self.__next_f.push([1,${JSON.stringify(`1:${JSON.stringify(data)}`)}])</script>`;

describe("fair volume comparison", () => {
  it("uses one denominator and distinguishes new activity from migration", () => {
    const m = comparison(900, 100)!;
    expect(m).toMatchObject({
      cexPct: 90,
      dexPct: 10,
      gap: 800,
      shiftToParity: 400,
      multiplier: 9,
      reached: false,
    });
    expect(simulateShift(900, 100, 50)).toMatchObject({
      cex: 450,
      dex: 550,
      total: 1000,
      reached: true,
    });
    expect(comparison(500, 500)).toMatchObject({ tied: true, reached: false });
  });
  it("does not turn a missing side into zero or invent an infinite growth number", () => {
    expect(comparison(null, 100)).toBeNull();
    expect(comparison(0, 0)).toBeNull();
    expect(comparison(900, 0)).toMatchObject({
      dexPct: 0,
      multiplier: null,
      gap: 900,
    });
    expect(comparison(0, 100)).toMatchObject({ dexPct: 100, reached: true });
    expect(comparison(NaN, 1)).toBeNull();
  });
  it("keeps every valid market and independently excludes derivatives, stale rows, outliers and duplicates", () => {
    const rows = [
      market,
      market,
      { ...market, exchange_id: "dex" },
      { ...market, category: "Futures" },
      { ...market, outlier: true },
      { ...market, last_updated: "2026-09-21T00:00:00Z" },
      { ...market, exchange_id: "unclassified" },
      { ...market, exchange_id: "hyperliquid" },
      { ...market, quotes: { USD: { price: 1 } } },
    ];
    const parsed = parseMarkets(rows, exchanges, now);
    expect(parsed.included).toBe(2);
    expect(parsed.received).toBe(9);
    expect(parsed.excluded).toHaveLength(7);
    expect(parsed.venues.map((v) => v.volumeUsd)).toEqual([900, 900]);
    expect(
      parsed.excluded.some(
        (e) => e.reason === "Replaced by the direct protocol source",
      ),
    ).toBe(true);
  });
  it("handles ZEC as quote and zero activity, but rejects impossible timestamps", () => {
    const p = parseMarkets(
      [
        {
          ...market,
          base_currency_id: "btc-bitcoin",
          quote_currency_id: "zec-zcash",
          pair: "BTC/ZEC",
          quotes: { USD: { price: 1, volume_24h: 0 } },
        },
        { ...market, last_updated: "2026-09-23T00:00:00Z" },
      ],
      exchanges,
      now,
    );
    expect(p.included).toBe(1);
    expect(p.venues[0].volumeUsd).toBe(0);
  });
  it("joins Hyperliquid by market name, never array position or a ZEC-like ticker", () => {
    const meta = {
      tokens: [
        { index: 0, name: "USDC", tokenId: "usd" },
        {
          index: 419,
          name: "UZEC",
          tokenId: "0x1c994ad3381d31c86c8c2d74ed89a365",
        },
        { index: 376, name: "IZEC", tokenId: "unrelated" },
      ],
      universe: [{ name: "@272", tokens: [419, 0] }],
    };
    const contexts = [
      { coin: "@256", dayNtlVlm: "999999", dayBaseVlm: "1" },
      { coin: "@272", dayNtlVlm: "1000.25", dayBaseVlm: "2" },
    ];
    expect(parseHyperliquid([meta, contexts])).toEqual({
      volumeUsd: 1000.25,
      baseVolume: 2,
    });
    expect(() => parseHyperliquid([meta, contexts.slice(0, 1)])).toThrow();
  });
  it("reads one filtered NEAR token total without adding the repeated filter total", () => {
    const volume = {
      lastDay: "$$7,000",
      last7Days: "$$42,000",
      last30Days: "$$100,000",
      fetchedAt: new Date(now).toISOString(),
      isStale: false,
    };
    const raw = {
      toTokenId: ["nep141:zec.omft.near"],
      fromVolume: volume,
      toVolume: volume,
    };
    expect(parseNearExplorer(renderData(raw), now).volumeUsd).toBe(7000);
    expect(() =>
      parseNearExplorer(renderData({ ...raw, toTokenId: ["btc"] }), now),
    ).toThrow();
    expect(() =>
      parseNearExplorer(
        renderData({ ...raw, toVolume: { ...volume, isStale: true } }),
        now,
      ),
    ).toThrow();
  });
});

describe("on-chain denominator and labeled custody", () => {
  const node = {
    chain: "main",
    blocks: 3492766,
    bestblockhash: "a".repeat(64),
    verificationprogress: 1,
    chainSupply: { chainValueZat: 1000000000 },
    valuePools: [
      { id: "transparent", chainValueZat: 500000000 },
      { id: "sapling", chainValueZat: 100000000 },
      { id: "orchard", chainValueZat: 100000000 },
      { id: "ironwood", chainValueZat: 200000000 },
      { id: "lockbox", chainValueZat: 100000000 },
    ],
  };
  it("includes new shielded pools and lockbox and reconciles to the exact zatoshi", () => {
    expect(parseSupply(node)).toMatchObject({
      zec: 10,
      shieldedZec: 4,
      lockedZec: 1,
      reconciled: true,
    });
    expect(() =>
      parseSupply({ ...node, chainSupply: { chainValueZat: 1000000001 } }),
    ).toThrow();
    expect(() => parseSupply({ ...node, chain: "test" })).toThrow();
    expect(() =>
      parseSupply({
        ...node,
        valuePools: [...node.valuePools, node.valuePools[0]],
      }),
    ).toThrow();
  });
  it("handles the different CipherScan units without a 100-million-fold error", () => {
    expect(
      parseAddressZec({ balance: 499.24, balanceZat: "49924000000" }),
    ).toBe(499.24);
    expect(parseAddressDetail({ address, balance: 49924000000 }, address)).toBe(
      499.24,
    );
    expect(parseAddressDetail({ address, balance: 0 }, address)).toBe(0);
    expect(() =>
      parseAddressDetail({ address, error: "Not found" }, address),
    ).toThrow();
  });
  it("separates funds and bridges from CEX despite the upstream category", () => {
    const label = {
      address,
      label: "Grayscale Zcash Trust",
      category: "exchange",
      verified: true,
    };
    expect(holderIdentity(label).kind).toBe("fund");
    expect(
      holderIdentity({ ...label, label: "Hyperunit Hot Wallet" }).kind,
    ).toBe("dex");
    expect(
      holderIdentity({ ...label, label: "Coinbase Prime Custody" }),
    ).toEqual({ id: "coinbase", name: "Coinbase", kind: "cex" });
  });
  it("deduplicates addresses and preserves unknown balances", () => {
    const a: AddressBalance = {
      address,
      label: "Binance",
      category: "exchange",
      verified: true,
      zec: 10,
      source: "https://cipherscan.app/",
    };
    const groups = groupHolders([a, a, { ...a, address: "other", zec: null }]);
    expect(groups[0]).toMatchObject({ zec: 10, missing: 1 });
    expect(groups[0].addresses).toHaveLength(2);
    expect(groupHolders([{ ...a, zec: null }])[0].zec).toBeNull();
  });
});

describe("issuer disclosures", () => {
  it("calculates 21shares holdings from units and entitlement rather than AUM / market price", () => {
    expect(
      parse21Shares({
        success: true,
        data: {
          ticker: "ZCASH",
          total_units_outstanding: 5000,
          valuation_date: "2026-09-22",
          constituents: [
            { ticker: "ZEC", coin_entitlement_per_share: 0.013152544622 },
          ],
        },
      }),
    ).toMatchObject({ zec: 65.76272311, asOf: "2026-09-22" });
  });
  it("retains the company disclosure date and rejects an altered page", () => {
    const page = renderData({
      zecHoldings: 326417.51,
      treasuryTxns: [
        {
          asset: "ZEC",
          date: "2026-08-31T12:00:00.000Z",
          amount: 3023.13,
          type: "mined",
        },
      ],
      end: true,
    });
    expect(parseCypherpunk(page)).toMatchObject({
      zec: 326417.51,
      asOf: "2026-08-31",
    });
    expect(() => parseCypherpunk("<p>Loading…</p>")).toThrow();
  });
  it("keeps Grayscale's actual as-of date, rejecting security checkpoint HTML", () => {
    expect(
      parseGrayscale(
        "<h2>Key Fund Information</h2><p>As of 09/08/2026</p><p>TOTAL ZEC IN FUND</p><p>464,514.8551</p>",
      ),
    ).toMatchObject({ zec: 464514.8551, asOf: "2026-09-08" });
    expect(() => parseGrayscale("Vercel Security Checkpoint")).toThrow();
  });
});
