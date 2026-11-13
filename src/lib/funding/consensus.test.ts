import { describe, expect, it } from "vitest";
import {
  HEIGHTS,
  LOCKBOX_DISBURSEMENT,
  STREAM_IDS,
  ZAT_PER_ZEC,
  allocationAt,
  allocationBetween,
  blockSubsidy,
  blocksPerDay,
  halving,
  lockboxBalanceAt,
  targetSecondsBetween,
  targetSpacingSeconds,
  type StreamId,
} from "./consensus";

/**
 * Mandatory coinbase outputs observed on mainnet (CipherScan block API,
 * 2026-09-24; the NU7 rows from the Zcash Info block API, 2026-11-13).
 * Founders' Reward and funding-stream outputs are required by consensus to
 * pay exactly the stream value, so they pin the rules down.
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
  // The last 75-second block, the NU7 activation block and a later one.
  { height: 3_543_404, expected: { zcg: 12_500_000 } },
  { height: 3_543_405, expected: { zcg: 4_166_666 } },
  { height: 3_569_000, expected: { zcg: 4_166_666 } },
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
  });

  it("divides the subsidy by three at NU7 (ZIP 218, 25-second blocks)", () => {
    expect(blockSubsidy(HEIGHTS.nu7 - 1)).toBe(156_250_000);
    // Observed: blocks 3,543,405 and 3,569,378 minted 0.52083333 ZEC.
    expect(blockSubsidy(HEIGHTS.nu7)).toBe(52_083_333);
    expect(blockSubsidy(HEIGHTS.thirdHalving - 1)).toBe(52_083_333);
    expect(blockSubsidy(HEIGHTS.thirdHalving)).toBe(26_041_666);
    expect(blockSubsidy(HEIGHTS.thirdHalving + 5_040_000)).toBe(13_020_833);
  });

  it("moves the third halving to 6,132,390 and later ones 5,040,000 apart", () => {
    // ZIP 214 revision 3: A + 3 x (H3 - A), with A = NU7 and H3 = 4,406,400.
    expect(HEIGHTS.thirdHalving).toBe(
      HEIGHTS.nu7 + 3 * (4_406_400 - HEIGHTS.nu7),
    );
    expect(HEIGHTS.thirdHalving).toBe(6_132_390);
    expect(halving(HEIGHTS.nu7 - 1)).toBe(2);
    expect(halving(HEIGHTS.nu7)).toBe(2);
    // The 75-second third-halving height is now mid-era.
    expect(halving(4_406_400)).toBe(2);
    expect(halving(HEIGHTS.thirdHalving - 1)).toBe(2);
    expect(halving(HEIGHTS.thirdHalving)).toBe(3);
    expect(halving(HEIGHTS.thirdHalving + 5_040_000 - 1)).toBe(3);
    expect(halving(HEIGHTS.thirdHalving + 5_040_000)).toBe(4);
  });

  it("knows the target spacing and blocks per day of each era", () => {
    expect(targetSpacingSeconds(HEIGHTS.blossom - 1)).toBe(150);
    expect(targetSpacingSeconds(HEIGHTS.blossom)).toBe(75);
    expect(targetSpacingSeconds(HEIGHTS.nu7 - 1)).toBe(75);
    expect(targetSpacingSeconds(HEIGHTS.nu7)).toBe(25);
    expect(blocksPerDay(HEIGHTS.blossom - 1)).toBe(576);
    expect(blocksPerDay(HEIGHTS.nu7 - 1)).toBe(1_152);
    expect(blocksPerDay(HEIGHTS.nu7)).toBe(3_456);
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

describe("target time between heights", () => {
  it("is zero for an empty or reversed range", () => {
    expect(targetSecondsBetween(3_500_000, 3_500_000)).toBe(0);
    expect(targetSecondsBetween(3_500_000, 3_400_000)).toBe(0);
  });

  it("uses the spacing of each arriving block, the NU7 block included", () => {
    expect(targetSecondsBetween(3_500_000, 3_500_010)).toBe(750);
    expect(targetSecondsBetween(HEIGHTS.nu7, HEIGHTS.nu7 + 10)).toBe(250);
    // Arriving: NU7 - 1 at 75 seconds, then NU7 and NU7 + 1 at 25.
    expect(targetSecondsBetween(HEIGHTS.nu7 - 2, HEIGHTS.nu7 + 1)).toBe(125);
    expect(
      targetSecondsBetween(HEIGHTS.blossom - 2, HEIGHTS.blossom + 1),
    ).toBe(150 + 75 + 75);
  });

  it("keeps the third halving on the same day NU7 found it", () => {
    // 862,995 blocks at 75 seconds, or three times as many at 25.
    expect(
      targetSecondsBetween(HEIGHTS.nu7 - 1, HEIGHTS.thirdHalving - 1),
    ).toBe((4_406_400 - HEIGHTS.nu7) * 75);
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

  it("keeps 8% and 12% of the smaller NU7 subsidy, each rounded down", () => {
    // Observed at 3,543,405: ZCG 4,166,666, lockbox 6,249,999, miner 41,666,668.
    const a = allocationAt(HEIGHTS.nu7);
    expect(a.zcg).toBe(4_166_666);
    expect(a.lockbox).toBe(6_249_999);
    expect(a.miner).toBe(41_666_668);
    expect(allocationAt(HEIGHTS.nu7 - 1).lockbox).toBe(18_750_000);
  });

  it("ends both streams at the third halving on the NU7 schedule", () => {
    const last = allocationAt(HEIGHTS.thirdHalving - 1);
    expect(last.zcg).toBe(4_166_666);
    expect(last.lockbox).toBe(6_249_999);
    const after = allocationAt(HEIGHTS.thirdHalving);
    expect(after.zcg + after.lockbox).toBe(0);
    expect(after.miner).toBe(26_041_666);
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
      [HEIGHTS.nu7 - 700, HEIGHTS.nu7 + 700],
      [HEIGHTS.thirdHalving - 700, HEIGHTS.thirdHalving + 700],
      [
        HEIGHTS.thirdHalving + 5_040_000 - 700,
        HEIGHTS.thirdHalving + 5_040_000 + 700,
      ],
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

describe("the streams across NU7", () => {
  it("pays the coinholder stream 2,588,985 zatoshis less than 75-second blocks would", () => {
    // ZIP 218: three 25-second blocks pay 3 zatoshis less than one 75-second block.
    const a = allocationBetween(HEIGHTS.nu61, HEIGHTS.thirdHalving - 1);
    expect(a.lockbox).toBe(zec(236_250) - 3 * (4_406_400 - HEIGHTS.nu7));
    expect(a.lockbox).toBe(23_624_997_411_015);
    expect(a.zcg).toBe(zec(157_500) - 2 * (4_406_400 - HEIGHTS.nu7));
  });
});

describe("lockbox balance", () => {
  it("matches the node's lockbox value pool after NU7 (Zcash Info, height 3,569,378)", () => {
    expect(lockboxBalanceAt(3_569_378)).toBe(7_606_181_224_026);
  });

  it("matches the node's lockbox value pool (CipherScan, height 3,495,073)", () => {
    expect(lockboxBalanceAt(3_495_073)).toBe(6_537_637_500_000);
  });

  it("is empty before NU6 and just after the disbursement", () => {
    expect(lockboxBalanceAt(HEIGHTS.nu6 - 1)).toBe(0);
    expect(lockboxBalanceAt(HEIGHTS.nu61 - 1)).toBe(LOCKBOX_DISBURSEMENT.zat);
    expect(lockboxBalanceAt(HEIGHTS.nu61)).toBe(18_750_000);
  });
});
