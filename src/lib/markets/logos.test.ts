import { describe, expect, it } from "vitest";
import { marketLogo } from "./logos";

describe("market brand identity", () => {
  it("distinguishes HyperJump from Hyperliquid", () => {
    expect(marketLogo("hyperjump · BNB Chain")).toBe(
      "/logos/markets/hyperjump.png",
    );
    expect(marketLogo("Hyperliquid · UZEC")).toBe(
      "/logos/markets/hyperliquid.png",
    );
  });

  it("never assigns a chain or another brand to an unknown venue", () => {
    for (const name of [
      "Unregistered DEX · Solana",
      "0xCe8fd65646F2a2a897755A1188C04aCe94D2B8D0 · BNB Chain",
      "zerofi · Solana",
      "Not Coinbase",
      "HyperExample",
      "__proto__",
    ]) {
      expect(marketLogo(name)).toBeNull();
    }
  });

  it("keeps the protocol's own mark on different networks", () => {
    expect(marketLogo("Rhea Finance · NEAR")).toBe("/logos/markets/rhea.png");
    expect(marketLogo("PumpSwap · Solana")).toBe("/logos/markets/pumpswap.png");
    expect(marketLogo("hydrex · Base")).toBe("/logos/markets/hydrex.png");
    expect(marketLogo("Unit · Hyperliquid bridge")).toBe("/logos/markets/unit.png");
  });

  it("identifies THORChain in the highlight card and the market list", () => {
    expect(marketLogo("THORChain")).toBe("/logos/markets/thorchain.png");
    expect(marketLogo("Thor Exchange")).toBeNull();
  });

  it("identifies the exchanges read from their own API", () => {
    expect(marketLogo("Bitget")).toBe("/logos/markets/bitget.png");
    expect(marketLogo("BingX")).toBe("/logos/markets/bingx.png");
    expect(marketLogo("Bitstamp")).toBe("/logos/markets/bitstamp.png");
    expect(marketLogo("Bitstamp by Robinhood")).toBe(
      "/logos/markets/bitstamp.png",
    );
    expect(marketLogo("Bitgetx")).toBeNull();
  });

  it("preserves known aliases and custody labels", () => {
    expect(marketLogo("Grayscale Zcash Trust")).toBe(
      marketLogo("Grayscale · The Zcash ETF"),
    );
    expect(marketLogo("Coinbase Cold Wallet")).toBe(marketLogo("Coinbase"));
    expect(marketLogo("raydium-clmm · Solana")).toBe(marketLogo("Raydium"));
    expect(marketLogo("BYDFi (Spot)")).toBe("/logos/markets/bydfi-spot.png");
    expect(marketLogo("Starknet")).toBe("/logos/markets/starknet.png");
  });
});
