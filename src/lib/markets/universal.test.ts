import { describe, expect, it } from "vitest";
import { parseUniversalPools, UNIVERSAL_ASSETS } from "./universal";

const asset = UNIVERSAL_ASSETS[0];
const asOf = "2026-09-22T23:00:00Z";
const pool = {
  chainId: "base",
  dexId: "aerodrome",
  pairAddress: "0xAbc",
  baseToken: { address: asset.token.toUpperCase() },
  quoteToken: { address: "0xusd" },
  volume: { h24: 120 },
};
describe("issuer-identified wrapped ZEC pools", () => {
  it("checks base and quote contracts and counts each pool once", () => {
    const rows = [
      pool,
      { ...pool, pairAddress: "0xabc" },
      {
        ...pool,
        pairAddress: "0xdef",
        baseToken: pool.quoteToken,
        quoteToken: pool.baseToken,
        volume: { h24: 30 },
      },
    ];
    expect(parseUniversalPools(rows, asset, asOf)).toMatchObject([
      { kind: "dex", volumeUsd: 150, pairs: 2, asOf },
    ]);
  });
  it("rejects a wrong chain, impersonating token, or missing volume", () => {
    expect(() =>
      parseUniversalPools([{ ...pool, chainId: "polygon" }], asset, asOf),
    ).toThrow();
    expect(() =>
      parseUniversalPools(
        [{ ...pool, baseToken: { address: "0xfake" } }],
        asset,
        asOf,
      ),
    ).toThrow();
    expect(() =>
      parseUniversalPools([{ ...pool, volume: {} }], asset, asOf),
    ).toThrow();
  });
  it("keeps Solana addresses case sensitive and does not fabricate venues", () => {
    const sol = UNIVERSAL_ASSETS[4];
    expect(parseUniversalPools([], sol, asOf)).toEqual([]);
    expect(() =>
      parseUniversalPools(
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
});
