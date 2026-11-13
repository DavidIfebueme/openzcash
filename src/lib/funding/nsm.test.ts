import { describe, expect, it } from "vitest";
import { HEIGHTS } from "./consensus";
import {
  NSM,
  nsmFeeContribution,
  nsmMinerFees,
  nsmReissuance,
} from "./nsm";

/** Fee splits observed on mainnet (Zcash Info block API, 2026-11-13). */
const OBSERVED: { height: number; fees: number; nsm: number; miner: number }[] =
  [
    // The last 75-second block: the mechanism is not active yet.
    { height: 3_543_404, fees: 271_960, nsm: 0, miner: 271_960 },
    // The NU7 activation block.
    { height: 3_543_405, fees: 300_000, nsm: 180_000, miner: 120_000 },
    { height: 3_569_000, fees: 55_000, nsm: 33_000, miner: 22_000 },
    { height: 3_569_377, fees: 45_000, nsm: 27_000, miner: 18_000 },
    { height: 3_569_378, fees: 25_000, nsm: 15_000, miner: 10_000 },
    { height: 3_569_383, fees: 0, nsm: 0, miner: 0 },
  ];

describe("the constants ZIP 237 and ZIP 259 publish for mainnet", () => {
  it("activates with NU7", () => {
    expect(NSM.activationHeight).toBe(HEIGHTS.nu7);
  });

  it("seeds the balance with 368.58445520 ZEC", () => {
    expect(NSM.initialBalanceZat).toBe(36_858_445_520);
  });

  it("starts reissuance at 16,026,474 - 2A, after the third halving", () => {
    expect(NSM.reissuanceHeight).toBe(16_026_474 - 2 * HEIGHTS.nu7);
    expect(NSM.reissuanceHeight).toBe(8_939_664);
    expect(NSM.reissuanceHeight).toBeGreaterThan(HEIGHTS.thirdHalving);
  });
});

describe("60% of a block's fees leave circulation (ZIP 235)", () => {
  for (const { height, fees, nsm, miner } of OBSERVED) {
    it(`height ${height}`, () => {
      expect(nsmFeeContribution(height, fees)).toBe(nsm);
      expect(nsmMinerFees(height, fees)).toBe(miner);
    });
  }

  it("rounds down, in the miner's favour", () => {
    expect(nsmFeeContribution(HEIGHTS.nu7, 1)).toBe(0);
    expect(nsmFeeContribution(HEIGHTS.nu7, 4)).toBe(2);
    expect(nsmFeeContribution(HEIGHTS.nu7, 9)).toBe(5);
    expect(nsmMinerFees(HEIGHTS.nu7, 9)).toBe(4);
  });

  it("rejects fees that are not whole, non-negative zatoshis", () => {
    expect(() => nsmFeeContribution(HEIGHTS.nu7, -1)).toThrow(RangeError);
    expect(() => nsmFeeContribution(HEIGHTS.nu7, 0.5)).toThrow(RangeError);
  });
});

describe("reissuance through the block subsidy (ZIP 237)", () => {
  it("adds nothing before the reissuance height", () => {
    expect(nsmReissuance(NSM.reissuanceHeight - 1, 37_770_939_035)).toBe(0);
  });

  it("adds ceiling(1375 / 10^10 of the balance) from that height", () => {
    // ZIP 237's example: 100,000 ZEC in the balance, about 0.01375 ZEC a block.
    expect(nsmReissuance(NSM.reissuanceHeight, 10_000_000_000_000)).toBe(
      1_375_000,
    );
    // The balance observed at height 3,569,378, if it were reissued today.
    expect(nsmReissuance(NSM.reissuanceHeight, 37_770_939_035)).toBe(5_194);
    expect(nsmReissuance(NSM.reissuanceHeight, 1)).toBe(1);
    expect(nsmReissuance(NSM.reissuanceHeight, 0)).toBe(0);
  });

  it("stays exact for a balance near the whole supply", () => {
    // 21M ZEC x 1375 overflows a double; the sum must not.
    expect(nsmReissuance(NSM.reissuanceHeight, 2_100_000_000_000_000)).toBe(
      288_750_000,
    );
  });

  it("never reissues more than the balance holds", () => {
    for (const balance of [1, 7, 7_272, 7_273, 36_858_445_520])
      expect(nsmReissuance(NSM.reissuanceHeight, balance)).toBeLessThanOrEqual(
        balance,
      );
  });
});
