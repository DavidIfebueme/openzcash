import { describe, it, expect } from "vitest";
import {
  parseKaminoRegistry,
  parseKaminoMetrics,
  WRAPPED_ASSETS,
  parseWrappedPools,
  aggregateWrappedPools,
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
  it("counts a pool once even when returned for both ZEC tokens and multiple indexers", () => {
    const other = WRAPPED_ASSETS.find((a) => a.id === "universal-base")!;
    const pair = { ...pool, quoteToken: { address: other.token } };
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
      { kind: "dex", volumeUsd: 120, pairs: 1 },
    ]);
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
