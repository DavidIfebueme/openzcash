/**
 * Zcash block subsidy and non-miner allocations, straight from the consensus
 * rules (mainnet). Every figure on the funding-history page derives from these
 * functions and a block height: no spreadsheet, no estimate.
 *
 * Sources: Zcash protocol specification §7.8 (block subsidy, Founders' Reward,
 * funding streams); ZIP 207 (funding streams); ZIP 214 (the 2020 Dev Fund);
 * ZIP 1015 and ZIP 2001 (NU6 allocation and the in-protocol lockbox); the NU6.1
 * lockbox disbursement. Each rule is checked against real coinbase
 * transactions and pool balances in consensus.test.ts.
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
  /** Third halving: the end of every stream defined by the ZIPs in force. */
  thirdHalving: 4_406_400,
} as const;

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

/** Halving(height), protocol specification §7.8. */
export function halving(height: number): number {
  assertHeight(height);
  if (height < SLOW_START_SHIFT) return 0;
  if (height < HEIGHTS.blossom) {
    return Math.floor(
      (height - SLOW_START_SHIFT) / PRE_BLOSSOM_HALVING_INTERVAL,
    );
  }
  // (Blossom − shift) / pre + (height − Blossom) / post, kept in integers
  // because the post-Blossom interval is exactly twice the pre-Blossom one.
  const scaled =
    (HEIGHTS.blossom - SLOW_START_SHIFT) * BLOSSOM_POW_TARGET_SPACING_RATIO +
    (height - HEIGHTS.blossom);
  return Math.floor(scaled / POST_BLOSSOM_HALVING_INTERVAL);
}

/** BlockSubsidy(height) in zatoshis, protocol specification §7.8. */
export function blockSubsidy(height: number): number {
  assertHeight(height);
  if (height < SLOW_START_SHIFT) return SLOW_START_RATE * height;
  if (height < SLOW_START_INTERVAL) return SLOW_START_RATE * (height + 1);
  const spacing =
    height < HEIGHTS.blossom ? 1 : BLOSSOM_POW_TARGET_SPACING_RATIO;
  return Math.floor(MAX_BLOCK_SUBSIDY / (spacing * 2 ** halving(height)));
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
  const halvings: number[] = [HEIGHTS.canopy, HEIGHTS.nu6, HEIGHTS.thirdHalving];
  let next = HEIGHTS.thirdHalving + POST_BLOSSOM_HALVING_INTERVAL;
  // Enough halvings to cover any height a caller could reasonably ask for.
  for (let i = 0; i < 40; i++, next += POST_BLOSSOM_HALVING_INTERVAL) {
    halvings.push(next);
  }
  return [SLOW_START_SHIFT, SLOW_START_INTERVAL, HEIGHTS.blossom, ...halvings];
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
