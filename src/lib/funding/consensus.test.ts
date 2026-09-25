import { describe, expect, it } from "vitest";
import {
  HEIGHTS,
  LOCKBOX_DISBURSEMENT,
  STREAM_IDS,
  ZAT_PER_ZEC,
  allocationAt,
  allocationBetween,
  blockSubsidy,
  halving,
  lockboxBalanceAt,
  type StreamId,
} from "./consensus";

/**
 * Mandatory coinbase outputs observed on mainnet (CipherScan block API,
 * 2026-09-24). Founders' Reward and funding-stream outputs are required by
 * consensus to pay exactly the stream value, so they pin the rules down.
 */
const COINBASE: {
  height: number;
  expected: Partial<Record<StreamId, number>>;
}[] = [
  { height: 1, expected: { foundersReward: 12_500 } },
  { height: 2, expected: { foundersReward: 25_000 } },
  { height: 9_999, expected: { foundersReward: 124_987_500 } },
  { height: 10_000, expected: { foundersReward: 125_012_500 } },
  { height: 19_999, expected: { foundersReward: 250_000_000 } },
  { height: 20_000, expected: { foundersReward: 250_000_000 } },
  { height: 653_599, expected: { foundersReward: 250_000_000 } },
  { height: 653_600, expected: { foundersReward: 125_000_000 } },
  { height: 1_046_399, expected: { foundersReward: 125_000_000 } },
  {
    height: 1_046_400,
    expected: {
      devFundEcc: 21_875_000,
      devFundMajorGrants: 25_000_000,
      devFundZf: 15_625_000,
    },
  },
  {
    height: 2_726_399,
    expected: {
      devFundEcc: 21_875_000,
      devFundMajorGrants: 25_000_000,
      devFundZf: 15_625_000,
    },
  },
  { height: 2_726_400, expected: { zcg: 12_500_000 } },
  { height: 3_146_399, expected: { zcg: 12_500_000 } },
  { height: 3_146_400, expected: { zcg: 12_500_000 } },
  { height: 3_364_600, expected: { zcg: 12_500_000 } },
  { height: 3_428_143, expected: { zcg: 12_500_000 } },
  { height: 3_490_000, expected: { zcg: 12_500_000 } },
];

const zec = (n: number) => n * ZAT_PER_ZEC;

describe("block subsidy", () => {
  it("follows the slow start, Blossom and the halvings", () => {
    expect(blockSubsidy(0)).toBe(0);
    expect(blockSubsidy(1)).toBe(62_500);
    expect(blockSubsidy(9_999)).toBe(624_937_500);
    expect(blockSubsidy(10_000)).toBe(625_062_500);
    expect(blockSubsidy(19_999)).toBe(1_250_000_000);
    expect(blockSubsidy(20_000)).toBe(1_250_000_000);
    expect(blockSubsidy(HEIGHTS.blossom - 1)).toBe(1_250_000_000);
    expect(blockSubsidy(HEIGHTS.blossom)).toBe(625_000_000);
    expect(blockSubsidy(HEIGHTS.canopy - 1)).toBe(625_000_000);
    expect(blockSubsidy(HEIGHTS.canopy)).toBe(312_500_000);
    expect(blockSubsidy(HEIGHTS.nu6)).toBe(156_250_000);
    expect(blockSubsidy(HEIGHTS.thirdHalving)).toBe(78_125_000);
  });

  it("places the halvings at the published heights", () => {
    expect(halving(HEIGHTS.canopy - 1)).toBe(0);
    expect(halving(HEIGHTS.canopy)).toBe(1);
    expect(halving(HEIGHTS.nu6 - 1)).toBe(1);
    expect(halving(HEIGHTS.nu6)).toBe(2);
    expect(halving(HEIGHTS.thirdHalving)).toBe(3);
  });

  it("rejects heights that are not non-negative integers", () => {
    expect(() => blockSubsidy(-1)).toThrow(RangeError);
    expect(() => blockSubsidy(1.5)).toThrow(RangeError);
  });
});

describe("allocations match real coinbase transactions", () => {
  for (const { height, expected } of COINBASE) {
    it(`height ${height}`, () => {
      const a = allocationAt(height);
      for (const id of STREAM_IDS)
        expect(a[id], id).toBe(expected[id] ?? a[id]);
      // Streams absent from the observed coinbase must be zero, except the
      // lockbox, which accrues in a value pool and never appears as an output.
      for (const id of STREAM_IDS) {
        if (id !== "lockbox" && expected[id] === undefined)
          expect(a[id], id).toBe(0);
      }
      expect(a.miner + STREAM_IDS.reduce((s, id) => s + a[id], 0)).toBe(
        a.subsidy,
      );
    });
  }

  it("accrues 12% in the lockbox from NU6, with no coinbase output", () => {
    expect(allocationAt(HEIGHTS.nu6 - 1).lockbox).toBe(0);
    expect(allocationAt(HEIGHTS.nu6).lockbox).toBe(18_750_000);
    expect(allocationAt(HEIGHTS.nu6).miner).toBe(125_000_000);
  });
});

describe("era totals", () => {
  it("mines exactly half the supply before the first halving", () => {
    expect(allocationBetween(0, HEIGHTS.canopy - 1).subsidy).toBe(
      zec(10_500_000),
    );
  });

  it("pays 2.1M ZEC of Founders' Reward, 10% of the maximum supply", () => {
    expect(allocationBetween(0, HEIGHTS.canopy - 1).foundersReward).toBe(
      zec(2_100_000),
    );
  });

  it("splits the 2020 Dev Fund 7 / 5 / 8 over 1.68M blocks", () => {
    const a = allocationBetween(HEIGHTS.canopy, HEIGHTS.nu6 - 1);
    expect(a.devFundEcc).toBe(zec(367_500));
    expect(a.devFundZf).toBe(zec(262_500));
    expect(a.devFundMajorGrants).toBe(zec(420_000));
    expect(a.foundersReward + a.zcg + a.lockbox).toBe(0);
  });

  it("matches the NU6.1 disbursement to the lockbox accrued since NU6", () => {
    const a = allocationBetween(HEIGHTS.nu6, HEIGHTS.nu61 - 1);
    expect(a.lockbox).toBe(LOCKBOX_DISBURSEMENT.zat);
    expect(a.lockbox).toBe(zec(78_750));
    expect(a.zcg).toBe(zec(52_500));
    expect(LOCKBOX_DISBURSEMENT.zat % LOCKBOX_DISBURSEMENT.outputs).toBe(0);
    expect(LOCKBOX_DISBURSEMENT.zat / LOCKBOX_DISBURSEMENT.outputs).toBe(
      787_500_000_000,
    );
  });

  it("agrees with a block-by-block sum across every breakpoint", () => {
    const ranges: [number, number][] = [
      [0, 25_000],
      [HEIGHTS.blossom - 700, HEIGHTS.blossom + 700],
      [HEIGHTS.canopy - 700, HEIGHTS.canopy + 700],
      [HEIGHTS.nu6 - 700, HEIGHTS.nu61 + 700],
    ];
    for (const [from, to] of ranges) {
      const fast = allocationBetween(from, to);
      const slow = { subsidy: 0, miner: 0 } as Record<string, number>;
      for (let h = from; h <= to; h++) {
        const a = allocationAt(h);
        for (const [k, v] of Object.entries(a)) slow[k] = (slow[k] ?? 0) + v;
      }
      expect(fast).toEqual(slow);
    }
  });
});

describe("lockbox balance", () => {
  it("matches the node's lockbox value pool (CipherScan, height 3,495,073)", () => {
    expect(lockboxBalanceAt(3_495_073)).toBe(6_537_637_500_000);
  });

  it("is empty before NU6 and just after the disbursement", () => {
    expect(lockboxBalanceAt(HEIGHTS.nu6 - 1)).toBe(0);
    expect(lockboxBalanceAt(HEIGHTS.nu61 - 1)).toBe(LOCKBOX_DISBURSEMENT.zat);
    expect(lockboxBalanceAt(HEIGHTS.nu61)).toBe(18_750_000);
  });
});
