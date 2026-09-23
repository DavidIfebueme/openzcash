import { describe, expect, it } from "vitest";
import {
  comparison,
  groupHolders,
  holderIdentity,
  parse21Shares,
  parseAddressDetail,
  parseAddressZec,
  parseCustodyRegistry,
  parseCypherpunk,
  parseGrayscale,
  parseHyperliquid,
  parseMarkets,
  parseNearExplorer,
  parseNearConfidential,
  parseSupply,
  dexMilestone,
  spotBenchmark,
  type Venue,
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
  it("distinguishes share of total from the DEX/CEX ratio, without clamping ratios above 100%", () => {
    const m = comparison(900, 100)!;
    expect(m).toMatchObject({
      cexPct: 90,
      dexPct: 10,
      gap: 800,
      multiplier: 9,
      growthRequiredPct: 800,
      reached: false,
    });
    expect(m.dexCexRatioPct).toBeCloseTo(11.111111);
    expect(comparison(500, 500)).toMatchObject({
      tied: true,
      reached: false,
      dexPct: 50,
      dexCexRatioPct: 100,
    });
    expect(comparison(400, 600)).toMatchObject({
      dexPct: 60,
      dexCexRatioPct: 150,
      reached: true,
      growthRequiredPct: 0,
    });
  });
  it("does not turn a missing side into zero or invent an infinite growth number", () => {
    expect(comparison(null, 100)).toBeNull();
    expect(comparison(0, 0)).toBeNull();
    expect(comparison(900, 0)).toMatchObject({
      dexPct: 0,
      multiplier: null,
      gap: 900,
    });
    expect(comparison(0, 100)).toMatchObject({
      dexPct: 100,
      reached: true,
      dexCexRatioPct: null,
    });
    expect(comparison(NaN, 1)).toBeNull();
  });
  it("recalculates the total as DEX grows to a milestone while CEX stays fixed", () => {
    // A 25% share at CEX=900 needs DEX=300, not 25% of the old 1,000 total.
    expect(dexMilestone(900, 100, 25)).toEqual({
      targetPct: 25,
      requiredDex: 300,
      additionalDex: 200,
      multiple: 3,
      achieved: false,
    });
    const parity = dexMilestone(900, 100, 50)!;
    expect(parity.requiredDex).toBe(900);
    expect(parity.additionalDex).toBe(800);
    expect(comparison(900, parity.requiredDex)).toMatchObject({
      dexPct: 50,
      tied: true,
      reached: false,
    });
    expect(dexMilestone(900, 900, 50)?.achieved).toBe(true);
    expect(dexMilestone(900, 400, 25)).toMatchObject({
      additionalDex: 0,
      achieved: true,
    });
  });
  it("keeps milestones unavailable for invalid targets and represents a zero DEX baseline honestly", () => {
    for (const target of [0, 100, -1, Infinity, NaN])
      expect(dexMilestone(900, 100, target)).toBeNull();
    expect(dexMilestone(0, 100, 50)).toBeNull();
    expect(dexMilestone(-10, 100, 50)).toBeNull();
    expect(dexMilestone(900, 0, 50)).toMatchObject({
      requiredDex: 900,
      additionalDex: 900,
      multiple: null,
      achieved: false,
    });
  });
  it("excludes routed activity from spot execution totals and does not fill a missing DEX side with intents", () => {
    const venue: Venue = {
      id: "cex",
      name: "Exchange",
      kind: "cex",
      volumeUsd: 900,
      pairs: 1,
      asOf: new Date(now).toISOString(),
      source: "https://example.com",
      note: "",
    };
    const dex: Venue = { ...venue, id: "dex", kind: "dex", volumeUsd: 100 };
    const intent: Venue = {
      ...dex,
      id: "near-intents",
      role: "routing",
      volumeUsd: 2000,
    };
    const result = spotBenchmark([venue, dex, intent]);
    expect(result.venues.map((v) => v.id)).toEqual(["cex", "dex"]);
    expect(result.metrics).toMatchObject({
      cex: 900,
      dex: 100,
      total: 1000,
      dexPct: 10,
    });
    expect(spotBenchmark([venue, intent]).metrics).toBeNull();
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
  it("counts Coinbase and Gemini unified dollar books once without merging other venues' stablecoin markets", () => {
    const quotes = [
      ["USD", "usd-us-dollars"],
      ["USDC", "usdc-usd-coin"],
      ["GUSD", "gusd-gemini-dollar"],
      ["RLUSD", "rlusd-ripple-usd"],
    ];
    const row = (id: string, quote: string[], volume: number) => ({
      ...market,
      exchange_id: id,
      exchange_name: id,
      pair: `ZEC/${quote[0]}`,
      quote_currency_id: quote[1],
      quotes: { USD: { price: 1500, volume_24h: volume } },
    });
    const registry = ["coinbase", "gemini", "binance"].map((id) => ({
      id,
      type: ["cex"],
    }));
    const parsed = parseMarkets(
      [
        // Put aliases first to prove that upstream ordering cannot multiply volume.
        row("coinbase", quotes[1], 999),
        row("coinbase", quotes[0], 1000),
        ...quotes
          .slice()
          .reverse()
          .map((q) => row("gemini", q, 100)),
        row("binance", quotes[0], 200),
        row("binance", quotes[1], 300),
      ],
      registry,
      now,
    );
    expect(parsed.venues.map((v) => [v.id, v.volumeUsd, v.pairs])).toEqual([
      ["coinbase", 1000, 1],
      ["binance", 500, 2],
      ["gemini", 100, 1],
    ]);
    expect(parsed.excluded).toHaveLength(4);
    expect(
      parsed.excluded.every(
        (e) => e.reason === "Shared order book already counted",
      ),
    ).toBe(true);
  });
  it("uses a valid shared-book alias if the preferred USD market is stale or rejected", () => {
    const usd = { ...market, exchange_id: "coinbase" };
    const alias = {
      ...usd,
      pair: "ZEC/USDC",
      quote_currency_id: "usdc-usd-coin",
      last_updated: "2026-09-22T21:58:00Z",
      quotes: { USD: { price: 1500, volume_24h: 899 } },
    };
    const registry = [{ id: "coinbase", type: ["cex"] }];
    for (const bad of [
      { ...usd, last_updated: "2026-09-21T00:00:00Z" },
      { ...usd, outlier: true },
    ]) {
      const parsed = parseMarkets([bad, alias], registry, now);
      expect(parsed.included).toBe(1);
      expect(parsed.venues[0].volumeUsd).toBe(899);
    }
  });
  it("deduplicates the verified HitBTC shared BTC and USDT books across branded feeds", () => {
    const ids = ["bequant", "fmfwio", "gleec-btc-exchange", "hitbtc"];
    const registry = ids.map((id) => ({ id, type: ["cex"] }));
    const rows = ids.flatMap((id) =>
      ["btc-bitcoin", id === "fmfwio" ? "usd-us-dollars" : "usdt-tether"].map(
        (quote) => ({
          ...market,
          exchange_id: id,
          exchange_name: id,
          quote_currency_id: quote,
          pair: `ZEC/${quote}`,
        }),
      ),
    );
    const parsed = parseMarkets(rows, registry, now);
    expect(parsed.venues).toHaveLength(1);
    expect(parsed.venues[0]).toMatchObject({
      id: "hitbtc",
      volumeUsd: 1800,
      pairs: 2,
    });
    expect(parsed.excluded).toHaveLength(6);
    expect(
      parsed.excluded.every(
        (e) => e.reason === "Shared order book already counted",
      ),
    ).toBe(true);
    // A missing preferred branded feed must not remove the actual shared book.
    const fallback = parseMarkets(
      rows.filter((r) => r.exchange_id !== "hitbtc"),
      registry,
      now,
    );
    expect(fallback.venues[0]).toMatchObject({
      id: "gleec-btc-exchange",
      volumeUsd: 1800,
      pairs: 2,
    });
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
      allTime: "$$2,000,000",
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
    expect(parseNearExplorer(renderData(raw), now)).toMatchObject({
      volumeUsd: 7000,
      volumeAllTimeUsd: 2000000,
    });
    expect(() =>
      parseNearExplorer(
        renderData({
          ...raw,
          toTokenId: "$undefined",
          fromTokenId: "$undefined",
        }),
        now,
      ),
    ).toThrow();
    expect(
      parseNearExplorer(
        renderData({
          ...raw,
          toTokenId: "$undefined",
          fromTokenId: "$undefined",
        }),
        now,
        "all",
      ).volumeUsd,
    ).toBe(7000);
    expect(() => parseNearExplorer(renderData(raw), now, "all")).toThrow();
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
  it("retains new rich-list labels without inventing owners for unlabeled whales", () => {
    const known = {
      address,
      label: "Binance Cold Wallet",
      category: "exchange",
      verified: true,
    };
    const newAddress = "t1" + "A".repeat(33);
    const unknownAddress = "t1" + "B".repeat(33);
    const rows = [
      { ...known, label: "Older name", balanceZat: "2000000000000" },
      {
        address: newAddress,
        label: "Whale 7",
        category: "whale",
        verified: true,
        balanceZat: "1500000000000",
      },
      {
        address: unknownAddress,
        label: null,
        category: null,
        verified: null,
        balanceZat: "9000000000000",
      },
    ];
    const parsed = parseCustodyRegistry(
      { labels: [known], count: 1 },
      { success: true, addresses: [...rows, rows[0]] },
    );
    expect(parsed.labels).toHaveLength(2);
    expect(parsed.labels[0].label).toBe("Binance Cold Wallet");
    expect(parsed.labels[1]).toMatchObject({
      label: "Whale 7",
      verified: true,
    });
    expect(parsed.addresses).toHaveLength(3);
    expect(parsed.addresses[0]).toMatchObject({
      address: unknownAddress,
      zec: 90000,
      label: null,
    });
    expect(parsed.balances.get(address)).toBe(20000);
    expect(holderIdentity(parsed.labels[1]).kind).toBe("other");
  });
  it("rejects conflicting rich-list balances and incomplete label registries", () => {
    const known = {
      address,
      label: "Binance",
      category: "exchange",
      verified: true,
    };
    const rich = {
      success: true,
      addresses: [
        { address, balanceZat: "100000000" },
        { address, balanceZat: "200000000" },
      ],
    };
    expect(() =>
      parseCustodyRegistry({ labels: [known], count: 1 }, rich),
    ).toThrow("Conflicting");
    expect(() =>
      parseCustodyRegistry({ labels: [known], count: 2 }, rich),
    ).toThrow("Incomplete");
    expect(() =>
      parseCustodyRegistry({ labels: [known, known], count: 2 }, rich),
    ).toThrow("Duplicate");
  });
  it("never upgrades a newly published label to verified when its flag is absent", () => {
    const known = {
      address,
      label: "Binance",
      category: "exchange",
      verified: true,
    };
    const parsed = parseCustodyRegistry(
      { labels: [known], count: 1 },
      {
        success: true,
        addresses: [
          {
            address: "t1" + "C".repeat(33),
            label: "New whale",
            balanceZat: "1230000000000",
          },
        ],
      },
    );
    expect(parsed.labels[1]).toMatchObject({
      verified: false,
      category: "other",
    });
  });
  it("shows a sourced public attribution in labels and whales without claiming CipherScan verification", () => {
    const whale = "t1gGCYpyURMo2FcYDSqeR8pgp2Kx9rnT72V";
    const attribution = {
      address: whale,
      label: "Garrett Jin",
      publisher: "Ember",
      source: "https://www.binance.com/en/square/post/368329271524964",
      asOf: "2026-09-19",
    };
    const parsed = parseCustodyRegistry(
      { labels: [{ address, label: "Binance", category: "exchange", verified: true }], count: 1 },
      { success: true, addresses: [{ address: whale, balanceZat: "20207620700000", label: null }] },
      [attribution],
    );
    expect(parsed.labels.find((a) => a.address === whale)).toMatchObject({
      label: "Garrett Jin",
      verified: false,
      attribution: { publisher: "Ember", source: attribution.source, asOf: attribution.asOf },
    });
    expect(parsed.addresses[0]).toMatchObject({
      address: whale,
      zec: 202076.207,
      label: { label: "Garrett Jin", verified: false },
    });
    expect(parsed.cipherLabelCount).toBe(1);
    expect(parsed.publicLabelCount).toBe(1);
  });
  it("keeps upstream labels ahead of public reports and does not invent a reported address balance", () => {
    const absent = "t1" + "D".repeat(33);
    const report = {
      label: "Reported whale",
      publisher: "Example researcher",
      source: "https://example.com/report",
      asOf: "2026-09-19",
    };
    const parsed = parseCustodyRegistry(
      { labels: [{ address, label: "Binance", category: "exchange", verified: true }], count: 1 },
      { success: true, addresses: [{ address, balanceZat: "10000000000000" }] },
      [{ ...report, address }, { ...report, address: absent }, { ...report, address: absent }],
    );
    expect(parsed.labels).toHaveLength(2);
    expect(parsed.labels[0]).toMatchObject({ label: "Binance", verified: true });
    expect(parsed.labels[0].attribution).toBeUndefined();
    expect(parsed.balances.has(absent)).toBe(false);
    expect(parsed.addresses).toHaveLength(1);
    expect(parsed.publicLabelCount).toBe(1);
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

describe("confidential NEAR data is TVL, not ZEC trading", () => {
  const page = (currentTvl: number, date = "2026-09-21") =>
    "NEAR Intents Confidential TVL " +
    renderData({ data: [{ date, value: 113248972.55 }], currentTvl });
  it("keeps a dated, reconciled TVL observation", () => {
    expect(parseNearConfidential(page(113248972.55), now)).toEqual({
      tvlUsd: 113248972.55,
      asOf: "2026-09-21",
    });
  });
  it("rejects a mismatched or outdated observation", () => {
    expect(() => parseNearConfidential(page(99), now)).toThrow();
    expect(() =>
      parseNearConfidential(page(113248972.55, "2026-08-01"), now),
    ).toThrow();
    expect(() =>
      parseNearConfidential(page(113248972.55, "2026-09-24"), now),
    ).toThrow();
  });
});
