import { describe, expect, it } from "vitest";
import {
  BLOCKS_PER_DAY,
  BLOCK_SUBSIDY_ZEC,
  LOCKBOX_START_HEIGHT,
  LOCKBOX_ZEC_PER_BLOCK,
  MINER_ZEC_PER_BLOCK,
  NU7_HEIGHT,
  THIRD_HALVING_HEIGHT,
  ZCG_ZEC_PER_BLOCK,
  blockRewardsAt,
  lockboxAccruedZec,
  lockboxZecAt,
} from "./lockbox";

describe("blockRewardsAt", () => {
  it("is the 75-second split before NU7", () => {
    expect(blockRewardsAt(NU7_HEIGHT - 1)).toEqual({
      subsidyZec: 1.5625,
      lockboxZec: 0.1875,
      zcgZec: 0.125,
      minerZec: 1.25,
      blocksPerDay: 1_152,
      targetSpacingSeconds: 75,
    });
  });

  it("is a third of it, rounded down per stream, from NU7 (observed at 3,543,405)", () => {
    expect(blockRewardsAt(NU7_HEIGHT)).toEqual({
      subsidyZec: 0.52083333,
      lockboxZec: 0.06249999,
      zcgZec: 0.04166666,
      minerZec: 0.41666668,
      blocksPerDay: 3_456,
      targetSpacingSeconds: 25,
    });
  });

  it("pays the streams nothing from the third halving", () => {
    const after = blockRewardsAt(THIRD_HALVING_HEIGHT);
    expect(after.lockboxZec).toBe(0);
    expect(after.zcgZec).toBe(0);
    expect(after.minerZec).toBe(after.subsidyZec);
  });
});

describe("current-era constants", () => {
  it("name the split in force since NU7", () => {
    expect(BLOCK_SUBSIDY_ZEC).toBe(0.52083333);
    expect(LOCKBOX_ZEC_PER_BLOCK).toBe(0.06249999);
    expect(ZCG_ZEC_PER_BLOCK).toBe(0.04166666);
    expect(MINER_ZEC_PER_BLOCK).toBe(0.41666668);
    expect(BLOCKS_PER_DAY).toBe(3_456);
    expect(THIRD_HALVING_HEIGHT).toBe(6_132_390);
  });
});

describe("lockboxAccruedZec", () => {
  it("is zero for an empty or reversed range", () => {
    expect(lockboxAccruedZec(3_500_000, 3_500_000)).toBe(0);
    expect(lockboxAccruedZec(3_500_000, 3_400_000)).toBe(0);
  });

  it("adds 0.1875 ZEC a block before NU7", () => {
    expect(lockboxAccruedZec(3_500_000, 3_500_008)).toBe(1.5);
  });

  it("adds 0.06249999 ZEC a block from NU7", () => {
    expect(lockboxAccruedZec(3_565_794, 3_569_378)).toBe(223.99996416);
  });

  it("switches rate at the NU7 block when the range crosses it", () => {
    // Two 75-second blocks, then the activation block and one more.
    expect(lockboxAccruedZec(NU7_HEIGHT - 3, NU7_HEIGHT + 1)).toBe(0.49999998);
  });

  it("reproduces the sheet's own post-NU7 step between two snapshots", () => {
    // Coinholder sheet: 145,641.94 ZEC at 3,548,854 and 146,700.87 at 3,565,794.
    const step = lockboxAccruedZec(3_548_854, 3_565_794);
    expect(step).toBeCloseTo(146_700.87 - 145_641.94, 0);
  });

  it("stops at the last block before the third halving", () => {
    expect(
      lockboxAccruedZec(THIRD_HALVING_HEIGHT - 2, THIRD_HALVING_HEIGHT + 500),
    ).toBe(0.06249999);
    expect(
      lockboxAccruedZec(THIRD_HALVING_HEIGHT, THIRD_HALVING_HEIGHT + 500),
    ).toBe(0);
  });
});

describe("lockboxZecAt", () => {
  it("is zero at and before NU6 activation", () => {
    expect(lockboxZecAt(LOCKBOX_START_HEIGHT)).toBe(0);
    expect(lockboxZecAt(LOCKBOX_START_HEIGHT - 1000)).toBe(0);
    expect(lockboxZecAt(0)).toBe(0);
  });

  it("accrues 0.1875 ZEC per block from NU6 to NU7", () => {
    expect(lockboxZecAt(LOCKBOX_START_HEIGHT + 1)).toBe(0.1875);
    expect(lockboxZecAt(LOCKBOX_START_HEIGHT + 1000)).toBe(187.5);
  });

  it("matches the on-chain order of magnitude near mid-2026", () => {
    // ~662,800 blocks after NU6 ≈ 124k ZEC (the spreadsheet snapshot was ~122k).
    const zec = lockboxZecAt(3_389_210);
    expect(zec).toBeGreaterThan(120_000);
    expect(zec).toBeLessThan(130_000);
  });

  it("slows to 0.06249999 ZEC per block after NU7", () => {
    expect(lockboxZecAt(NU7_HEIGHT + 100) - lockboxZecAt(NU7_HEIGHT)).toBeCloseTo(
      6.249999,
      8,
    );
  });

  it("stops accruing after the 3rd halving", () => {
    const atEnd = lockboxZecAt(THIRD_HALVING_HEIGHT);
    expect(lockboxZecAt(THIRD_HALVING_HEIGHT + 50_000)).toBe(atEnd);
  });
});
