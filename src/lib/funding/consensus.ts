/**
 * Zcash block subsidy and non-miner allocations, straight from the consensus
 * rules (mainnet). Every figure on the funding-history page derives from these
 * functions and a block height: no spreadsheet, no estimate.
 *
 * Sources: Zcash protocol specification §7.8 (block subsidy, Founders' Reward,
 * funding streams); ZIP 207 (funding streams); ZIP 214 (the 2020 Dev Fund);
 * ZIP 1015 and ZIP 2001 (NU6 allocation and the in-protocol lockbox); the NU6.1
 * lockbox disbursement; ZIP 218 and ZIP 214 revision 3 (NU7: 25-second blocks,
 * a third of the subsidy per block, the streams extended to the third halving
 * on the new schedule). Each rule is checked against real coinbase
 * transactions and pool balances in consensus.test.ts.
 *
 * The subsidy here is the scheduled one. From NSM_REISSUANCE_HEIGHT (see
 * nsm.ts) consensus adds a reissued amount that depends on the NSM balance,
 * not on the height alone; no stream defined today is still active by then.
 *
 * Amounts are zatoshis held in `number`: the largest total here (21M ZEC,
 * 2.1e15 zat) is far below Number.MAX_SAFE_INTEGER (9.0e15), so integer
 * arithmetic stays exact.
 */

export const ZAT_PER_ZEC = 100_000_000;

const MAX_BLOCK_SUBSIDY = 1_250_000_000; // 12.5 ZEC
const SLOW_START_INTERVAL = 20_000;
const SLOW_START_SHIFT = SLOW_START_INTERVAL / 2;
const SLOW_START_RATE = MAX_BLOCK_SUBSIDY / SLOW_START_INTERVAL; // 62,500 zat
const PRE_BLOSSOM_HALVING_INTERVAL = 840_000;
const POST_BLOSSOM_HALVING_INTERVAL = 1_680_000;
const BLOSSOM_POW_TARGET_SPACING_RATIO = 2;
/** ZIP 218: 75-second blocks become 25-second blocks. */
const NU7_POW_TARGET_SPACING_RATIO = 3;
const POST_NU7_HALVING_INTERVAL =
  POST_BLOSSOM_HALVING_INTERVAL * NU7_POW_TARGET_SPACING_RATIO; // 5,040,000
const PRE_BLOSSOM_TARGET_SPACING_SECONDS = 150;
const SECONDS_PER_DAY = 86_400;

/** Mainnet heights where the allocation rules change. */
export const HEIGHTS = {
  /** 75-second blocks; the per-block subsidy halves, issuance per day does not. */
  blossom: 653_600,
  /** First halving. The Founders' Reward ends; the ZIP 214 Dev Fund begins. */
  canopy: 1_046_400,
  /** Second halving. ZIP 1015: 8% to ZCG, 12% accrues in the lockbox. */
  nu6: 2_726_400,
  /** The lockbox accrued so far is disbursed; the 8% / 12% split continues. */
  nu61: 3_146_400,
  /**
   * 25-second blocks (ZIP 218): a third of the subsidy per block, three times
   * the blocks, the same issuance per day. The 8% / 12% split continues.
   */
  nu7: 3_543_405,
  /**
   * Third halving: the end of every stream defined by the ZIPs in force. It
   * was 4,406,400 on the 75-second schedule; NU7 stretches the blocks left to
   * it by three (ZIP 214 revision 3): 3,543,405 + 3 × 862,995.
   */
  thirdHalving: 6_132_390,
} as const;

/**
 * Where the third halving stood on the 75-second schedule: the end height
 * ZIP 214 revision 2 gave both streams, before NU7 stretched it.
 */
export const PRE_NU7_THIRD_HALVING = 4_406_400;

/**
 * The one-time lockbox disbursement in the NU6.1 activation block: ten equal
 * coinbase outputs to one transparent address, equal to everything the
 * lockbox accrued from NU6 to NU6.1 (420,000 blocks × 0.1875 ZEC).
 */
export const LOCKBOX_DISBURSEMENT = {
  height: HEIGHTS.nu61,
  zat: 7_875_000_000_000,
  address: "t3ev37Q2uL1sfTsiJQJiWJoFzQpDhmnUwYo",
  outputs: 10,
} as const;

export type StreamId =
  | "foundersReward"
  | "devFundEcc"
  | "devFundZf"
  | "devFundMajorGrants"
  | "zcg"
  | "lockbox";

export const STREAM_IDS: readonly StreamId[] = [
  "foundersReward",
  "devFundEcc",
  "devFundZf",
  "devFundMajorGrants",
  "zcg",
  "lockbox",
];

export type Allocation = Record<StreamId, number> & {
  /** Block subsidy (new issuance), excluding transaction fees. */
  subsidy: number;
  /** What remains for the miner under consensus; fees come on top. */
  miner: number;
};

function assertHeight(height: number): void {
  if (!Number.isSafeInteger(height) || height < 0) {
    throw new RangeError(`Invalid block height: ${height}`);
  }
}

/**
 * Progress through the halving schedule at the end of the 75-second era, in
 * post-Blossom blocks: (Blossom − shift) / pre + (height − Blossom) / post,
 * kept in integers because each interval is a whole multiple of the last.
 */
const postBlossomProgress = (height: number) =>
  (HEIGHTS.blossom - SLOW_START_SHIFT) * BLOSSOM_POW_TARGET_SPACING_RATIO +
  (height - HEIGHTS.blossom);

/** Halving(height), protocol specification §7.8 as amended by ZIP 218. */
export function halving(height: number): number {
  assertHeight(height);
  if (height < SLOW_START_SHIFT) return 0;
  if (height < HEIGHTS.blossom) {
    return Math.floor(
      (height - SLOW_START_SHIFT) / PRE_BLOSSOM_HALVING_INTERVAL,
    );
  }
  if (height < HEIGHTS.nu7) {
    return Math.floor(
      postBlossomProgress(height) / POST_BLOSSOM_HALVING_INTERVAL,
    );
  }
  // The progress made by NU7 carries over; each later block counts a third.
  const scaled =
    postBlossomProgress(HEIGHTS.nu7) * NU7_POW_TARGET_SPACING_RATIO +
    (height - HEIGHTS.nu7);
  return Math.floor(scaled / POST_NU7_HALVING_INTERVAL);
}

/** How many times shorter the target spacing is than at launch. */
function spacingRatio(height: number): number {
  if (height < HEIGHTS.blossom) return 1;
  if (height < HEIGHTS.nu7) return BLOSSOM_POW_TARGET_SPACING_RATIO;
  return BLOSSOM_POW_TARGET_SPACING_RATIO * NU7_POW_TARGET_SPACING_RATIO;
}

/** PoWTargetSpacing(height) in seconds: 150, then 75 (Blossom), then 25 (NU7). */
export function targetSpacingSeconds(height: number): number {
  assertHeight(height);
  return PRE_BLOSSOM_TARGET_SPACING_SECONDS / spacingRatio(height);
}

/** Blocks in a day at the target spacing: 576, then 1,152, then 3,456. */
export function blocksPerDay(height: number): number {
  return SECONDS_PER_DAY / targetSpacingSeconds(height);
}

/**
 * Seconds the blocks after `fromHeight`, up to and including `toHeight`, take
 * at the target spacing. The spacing is that of each arriving block, so the
 * NU7 activation block itself is a 25-second block.
 */
export function targetSecondsBetween(
  fromHeight: number,
  toHeight: number,
): number {
  assertHeight(fromHeight);
  assertHeight(toHeight);
  let seconds = 0;
  let start = fromHeight + 1;
  for (const boundary of [HEIGHTS.blossom, HEIGHTS.nu7, Infinity]) {
    const end = Math.min(toHeight, boundary - 1);
    if (end < start) continue;
    seconds += (end - start + 1) * targetSpacingSeconds(start);
    start = end + 1;
  }
  return seconds;
}

/**
 * The scheduled BlockSubsidy(height) in zatoshis, protocol specification §7.8
 * as amended by ZIP 218. NSM reissuance (ZIP 237) is not included.
 */
export function blockSubsidy(height: number): number {
  assertHeight(height);
  if (height < SLOW_START_SHIFT) return SLOW_START_RATE * height;
  if (height < SLOW_START_INTERVAL) return SLOW_START_RATE * (height + 1);
  return Math.floor(
    MAX_BLOCK_SUBSIDY / (spacingRatio(height) * 2 ** halving(height)),
  );
}

/** floor(subsidy · numerator / denominator), ZIP 207. */
const stream = (subsidy: number, numerator: number, denominator: number) =>
  Math.floor((subsidy * numerator) / denominator);

const emptyAllocation = (): Allocation => ({
  subsidy: 0,
  miner: 0,
  foundersReward: 0,
  devFundEcc: 0,
  devFundZf: 0,
  devFundMajorGrants: 0,
  zcg: 0,
  lockbox: 0,
});

/** How one block's subsidy is split under the rules active at that height. */
export function allocationAt(height: number): Allocation {
  const subsidy = blockSubsidy(height);
  const a = { ...emptyAllocation(), subsidy };
  if (height >= 1 && height < HEIGHTS.canopy) {
    a.foundersReward = stream(subsidy, 1, 5);
  } else if (height >= HEIGHTS.canopy && height < HEIGHTS.nu6) {
    a.devFundEcc = stream(subsidy, 7, 100);
    a.devFundZf = stream(subsidy, 5, 100);
    a.devFundMajorGrants = stream(subsidy, 8, 100);
  } else if (height >= HEIGHTS.nu6 && height < HEIGHTS.thirdHalving) {
    a.zcg = stream(subsidy, 8, 100);
    a.lockbox = stream(subsidy, 12, 100);
  }
  a.miner = subsidy - STREAM_IDS.reduce((sum, id) => sum + a[id], 0);
  return a;
}

/** Heights where the per-block allocation can change, in ascending order. */
function breakpoints(): number[] {
  const later: number[] = [];
  let next = HEIGHTS.thirdHalving + POST_NU7_HALVING_INTERVAL;
  // Enough halvings to cover any height a caller could reasonably ask for.
  for (let i = 0; i < 40; i++, next += POST_NU7_HALVING_INTERVAL) {
    later.push(next);
  }
  return [
    SLOW_START_SHIFT,
    SLOW_START_INTERVAL,
    HEIGHTS.blossom,
    HEIGHTS.canopy,
    HEIGHTS.nu6,
    HEIGHTS.nu7,
    HEIGHTS.thirdHalving,
    ...later,
  ];
}
const BREAKPOINTS = breakpoints();

/**
 * Sum of allocations over heights [from, to], inclusive. Constant segments are
 * multiplied out; the slow-start ramp (below height 20,000) is summed block by
 * block. Exact to the zatoshi.
 */
export function allocationBetween(from: number, to: number): Allocation {
  assertHeight(from);
  assertHeight(to);
  if (to < from) throw new RangeError(`Empty height range: ${from}..${to}`);
  const total = emptyAllocation();
  const add = (a: Allocation, times: number) => {
    total.subsidy += a.subsidy * times;
    total.miner += a.miner * times;
    for (const id of STREAM_IDS) total[id] += a[id] * times;
  };

  let start = from;
  while (start <= to) {
    const boundary =
      BREAKPOINTS.find((b) => b > start) ?? Number.MAX_SAFE_INTEGER;
    const end = Math.min(to, boundary - 1);
    if (start < SLOW_START_INTERVAL) {
      for (let h = start; h <= end; h++) add(allocationAt(h), 1);
    } else {
      add(allocationAt(start), end - start + 1);
    }
    start = end + 1;
  }
  return total;
}

/**
 * Balance of the in-protocol lockbox at a height: it accrues from NU6, is
 * emptied by the NU6.1 disbursement, and accrues again from that block on.
 */
export function lockboxBalanceAt(height: number): number {
  assertHeight(height);
  if (height < HEIGHTS.nu6) return 0;
  const accrued = allocationBetween(HEIGHTS.nu6, height).lockbox;
  return height >= HEIGHTS.nu61 ? accrued - LOCKBOX_DISBURSEMENT.zat : accrued;
}

export const zatToZec = (zat: number) => zat / ZAT_PER_ZEC;
