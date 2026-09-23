import { describe, it, expect } from "vitest";
import {
  parseKaminoRegistry,
  parseKaminoMetrics,
  WRAPPED_ASSETS,
  parseWrappedPools,
  aggregateWrappedPools,
  resolveWrappedPools,
  resolveWrappedCoverage,
  readGeckoPoolCoverage,
  normalizeDexId,
  parseSolanaSupply,
  tokenUnits,
  rpcHex,
  parseGeckoPools,
} from "./wrapped";
const asset = WRAPPED_ASSETS[0],
  sol = WRAPPED_ASSETS[1];
const asOf = "2026-09-22T23:00:00Z";
const pool = {
  chainId: "base",
  dexId: "aerodrome",
  pairAddress: "0xAbc",
  baseToken: { address: asset.token.toUpperCase() },
  quoteToken: { address: "0xusd" },
  volume: { h24: 120 },
};
describe("issuer-identified ZEC pools", () => {
  const geckoPage = (page: number, count = 20) => ({
    data: Array.from({ length: count }, (_, i) => ({
      attributes: {
        address: `pool-${page}-${i}`,
        volume_usd: { h24: "10" },
      },
      relationships: {
        base_token: { data: { id: `solana_${sol.token}` } },
        quote_token: { data: { id: "solana_USDC" } },
        dex: { data: { id: "orca" } },
      },
    })),
  });
  it("retains verified pages and flags partial coverage after a later page fails", async () => {
    const coverage = await readGeckoPoolCoverage(
      sol,
      async (page) => {
        if (page === 2) throw new Error("Rate limited");
        return geckoPage(page);
      },
      asOf,
    );
    expect(coverage).toMatchObject({
      partial: true,
      limited: false,
      failedSources: 1,
    });
    expect(coverage.pools).toHaveLength(20);
    expect(aggregateWrappedPools(coverage.pools).venues[0].volumeUsd).toBe(200);
    const resolved = resolveWrappedCoverage([
      { status: "fulfilled", value: coverage },
      { status: "fulfilled", value: [coverage.pools[0]] },
    ]);
    expect(resolved.pools).toHaveLength(20);
    expect(resolved.partial).toBe(true);
    expect(resolved.failedSources).toBe(1);
  });
  it("distinguishes a reached page limit from a fully returned index", async () => {
    const bounded = await readGeckoPoolCoverage(
      sol,
      async (page) => geckoPage(page),
      asOf,
    );
    expect(bounded.pools).toHaveLength(60);
    expect(bounded).toMatchObject({
      partial: true,
      limited: true,
      failedSources: 0,
    });
    const complete = await readGeckoPoolCoverage(
      sol,
      async (page) => geckoPage(page, page === 1 ? 20 : 1),
      asOf,
    );
    expect(complete.pools).toHaveLength(21);
    expect(complete.pools[20].source).toContain("page=2");
    expect(complete).toMatchObject({
      partial: false,
      limited: false,
      failedSources: 0,
    });
  });
  it("retains source failures and never converts unavailable pagination into zero", async () => {
    const unavailable = await readGeckoPoolCoverage(
      sol,
      async () => {
        throw new Error("Rate limited");
      },
      asOf,
    );
    expect(() =>
      resolveWrappedCoverage([
        { status: "fulfilled", value: [] },
        { status: "fulfilled", value: unavailable },
      ]),
    ).toThrow("Pool coverage unavailable");
    const available = parseWrappedPools([pool], asset, asOf);
    expect(
      resolveWrappedCoverage([
        { status: "fulfilled", value: available },
        { status: "rejected", reason: new Error("Rate limited") },
      ]),
    ).toMatchObject({
      pools: available,
      partial: true,
      limited: false,
      failedSources: 1,
    });
  });
  it("rejects the mismatched page while retaining earlier verified pools", async () => {
    const coverage = await readGeckoPoolCoverage(
      sol,
      async (page) => {
        const batch = geckoPage(page);
        if (page === 2)
          batch.data[0].relationships.base_token.data.id = "solana_OTHER";
        return batch;
      },
      asOf,
    );
    expect(coverage.pools).toHaveLength(20);
    expect(coverage).toMatchObject({ partial: true, failedSources: 1 });
    expect(coverage.pools.some((p) => p.id.includes("pool-2"))).toBe(false);
  });
  it("keeps populated fallback coverage but never disguises a failed index as an empty market", () => {
    const failed = {
      status: "rejected" as const,
      reason: new Error("Rate limit"),
    };
    const empty = { status: "fulfilled" as const, value: [] };
    const populated = {
      status: "fulfilled" as const,
      value: parseWrappedPools([pool], asset, asOf),
    };
    expect(resolveWrappedPools([failed, populated])).toHaveLength(1);
    expect(resolveWrappedPools([empty, empty])).toEqual([]);
    expect(() => resolveWrappedPools([empty, failed])).toThrow(
      "Pool coverage unavailable",
    );
    expect(() => resolveWrappedPools([failed, failed])).toThrow(
      "Pool coverage unavailable",
    );
  });
  it("counts a pool once even when returned for both ZEC tokens and multiple indexers", () => {
    const other = WRAPPED_ASSETS.find((a) => a.id === "universal-base")!;
    const pair = {
      ...pool,
      quoteToken: { address: other.token },
      liquidity: { usd: 500 },
    };
    const pools = [
      ...parseWrappedPools(
        [pair, { ...pair, pairAddress: "0xabc" }],
        asset,
        asOf,
      ),
      ...parseWrappedPools([pair], other, asOf),
    ];
    const merged = aggregateWrappedPools(pools);
    expect(merged.pools).toHaveLength(1);
    expect(merged.venues).toMatchObject([
      { kind: "dex", volumeUsd: 120, liquidityUsd: 500, pairs: 1 },
    ]);
  });
  it("sums known liquidity in USD and keeps any missing reserve unknown", () => {
    const known = parseWrappedPools(
      [
        { ...pool, liquidity: { usd: 450.25 } },
        { ...pool, pairAddress: "0xDEF", liquidity: { usd: 100.75 } },
      ],
      asset,
      asOf,
    );
    expect(aggregateWrappedPools(known).venues[0]).toMatchObject({
      liquidityUsd: 551,
      volumeUsd: 240,
    });
    const absent = parseWrappedPools(
      [{ ...pool, pairAddress: "0x123" }],
      asset,
      asOf,
    );
    expect(absent[0].liquidityUsd).toBeNull();
    expect(
      aggregateWrappedPools([...known, ...absent]).venues[0].liquidityUsd,
    ).toBeNull();
    expect(
      parseWrappedPools([{ ...pool, liquidity: { usd: 0 } }], asset, asOf)[0]
        .liquidityUsd,
    ).toBe(0);
    expect(() =>
      parseWrappedPools([{ ...pool, liquidity: { usd: -1 } }], asset, asOf),
    ).toThrow();
  });
  it("normalizes verified provider protocol aliases while retaining other venues", () => {
    for (const id of [
      "uniswap-v2-bsc",
      "uniswap-bsc",
      "uniswap-v3-base",
      "uniswap-v4-base",
    ])
      expect(normalizeDexId(id)).toBe("uniswap");
    for (const id of [
      "pancakeswap-v3-bsc",
      "pancakeswap_v2",
      "pancakeswap-infinity-clmm-base",
    ])
      expect(normalizeDexId(id)).toBe("pancakeswap");
    expect(normalizeDexId("aerodrome-slipstream-3")).toBe(
      "aerodrome-slipstream-3",
    );
    expect(normalizeDexId("uniswap-clone")).toBe("uniswap-clone");
  });
  it("reads Gecko USD reserves without token scaling and deduplicates aliases", () => {
    const raw = {
      data: [
        {
          attributes: {
            address: "0xABC",
            volume_usd: { h24: "120" },
            reserve_in_usd: "500.75",
          },
          relationships: {
            base_token: { data: { id: `base_${asset.token}` } },
            quote_token: { data: { id: "base_USDC" } },
            dex: { data: { id: "uniswap-v3-base" } },
          },
        },
      ],
    };
    const gecko = parseGeckoPools(raw, asset, asOf);
    const ds = parseWrappedPools(
      [{ ...pool, dexId: "uniswap", liquidity: { usd: 500.75 } }],
      asset,
      asOf,
    );
    expect(gecko[0]).toMatchObject({ liquidityUsd: 500.75, dex: "uniswap" });
    expect(aggregateWrappedPools([...ds, ...gecko]).venues).toMatchObject([
      { liquidityUsd: 500.75, volumeUsd: 120, pairs: 1 },
    ]);
    raw.data[0].attributes.reserve_in_usd = "5.6e-9";
    expect(parseGeckoPools(raw, asset, asOf)[0].liquidityUsd).toBe(5.6e-9);
  });
  it("accepts ZEC on the quote side and rejects another token or network", () => {
    expect(
      parseWrappedPools(
        [{ ...pool, baseToken: pool.quoteToken, quoteToken: pool.baseToken }],
        asset,
        asOf,
      ),
    ).toHaveLength(1);
    expect(() =>
      parseWrappedPools([{ ...pool, chainId: "polygon" }], asset, asOf),
    ).toThrow();
    expect(() =>
      parseWrappedPools(
        [{ ...pool, baseToken: { address: "0xfake" } }],
        asset,
        asOf,
      ),
    ).toThrow();
    expect(() =>
      parseWrappedPools([{ ...pool, volume: {} }], asset, asOf),
    ).toThrow();
  });
  it("keeps Solana mints case sensitive and retains empty coverage", () => {
    expect(parseWrappedPools([], sol, asOf)).toEqual([]);
    expect(() =>
      parseWrappedPools(
        [
          {
            ...pool,
            chainId: "solana",
            baseToken: { address: sol.token.toLowerCase() },
          },
        ],
        sol,
        asOf,
      ),
    ).toThrow();
  });
  it("validates GeckoTerminal identity before merging duplicate pools", () => {
    const raw = {
      data: [
        {
          attributes: { address: "POOL", volume_usd: { h24: "150" } },
          relationships: {
            base_token: { data: { id: `solana_${sol.token}` } },
            quote_token: { data: { id: "solana_USDC" } },
            dex: { data: { id: "orca" } },
          },
        },
      ],
    };
    const g = parseGeckoPools(raw, sol, asOf);
    expect(g[0]).toMatchObject({
      id: "solana:POOL",
      dex: "orca",
      volumeUsd: 150,
    });
    const d = parseWrappedPools(
      [
        {
          ...pool,
          chainId: "solana",
          pairAddress: "POOL",
          baseToken: { address: sol.token },
        },
      ],
      sol,
      asOf,
    );
    expect(aggregateWrappedPools([...d, ...g]).venues[0].volumeUsd).toBe(120);
    raw.data[0].relationships.base_token.data.id = "solana_FAKE";
    expect(() => parseGeckoPools(raw, sol, asOf)).toThrow();
  });
});
describe("read-only token supply", () => {
  it("uses integer token units and actual decimals", () => {
    expect(tokenUnits("12345678901234567890123", 18)).toBeCloseTo(
      12345.678901234568,
    );
    expect(
      parseSolanaSupply({
        result: {
          context: { slot: 123 },
          value: { amount: "10075755721548", decimals: 8 },
        },
      }),
    ).toEqual({ zec: 100757.55721548, block: "123" });
    expect(rpcHex({ result: "0x08" })).toBe("0x08");
  });
  it("rejects RPC errors, malformed amounts and unbounded supply", () => {
    expect(() => rpcHex({ error: { message: "Unavailable" } })).toThrow();
    expect(() =>
      parseSolanaSupply({ error: { message: "Unavailable" } }),
    ).toThrow();
    expect(() => tokenUnits("2100000100000000", 8)).toThrow();
    expect(() => tokenUnits("1e8", 8)).toThrow();
    expect(() => tokenUnits("100", 255)).toThrow();
  });
});

describe("Kamino deposit identity", () => {
  const reserve = {
    name: "ZEC Borrow Market",
    lendingMarket: "market",
    collateralReserve: "reserve",
    collateralMint: sol.token,
  };
  it("counts a collateral reserve once and keeps deposits separate from borrowing", () => {
    const registry = parseKaminoRegistry({
      collateralReserves: [reserve, { ...reserve }],
    });
    expect(registry.reserves).toHaveLength(1);
    expect(
      parseKaminoMetrics(
        [
          {
            reserve: "reserve",
            liquidityTokenMint: sol.token,
            totalSupply: "2114.65",
            totalBorrow: "0",
          },
          {
            reserve: "USDC",
            liquidityTokenMint: "USDC",
            totalSupply: "30000000",
            totalBorrow: "0",
          },
        ],
        registry.reserves,
      ),
    ).toMatchObject([{ zec: 2114.65, borrowedZec: 0, mint: sol.token }]);
  });
  it("flags unknown ZEC mints and rejects a changed reserve mint", () => {
    expect(
      parseKaminoRegistry({
        collateralReserves: [{ ...reserve, collateralMint: "FAKE" }],
      }),
    ).toMatchObject({
      reserves: [],
      unidentified: [{ collateralMint: "FAKE" }],
    });
    expect(() =>
      parseKaminoMetrics(
        [
          {
            reserve: "reserve",
            liquidityTokenMint: "FAKE",
            totalSupply: "99",
            totalBorrow: "0",
          },
        ],
        [reserve],
      ),
    ).toThrow();
  });
});
