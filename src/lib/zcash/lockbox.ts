/**
 * Zcash deferred Dev Fund ("Lockbox") accrual, derived from the consensus
 * rules in src/lib/funding/consensus.ts.
 *
 * Since NU6 (the 2nd halving, block 2,726,400, mined 2024-11-23) 12% of every
 * block's subsidy accrues to the in-protocol Lockbox, 8% funds ZCG grants via
 * the FPF, and the remaining 80% goes to the miner. NU6.1 (block 3,146,400)
 * kept the 12% accruing, now under coinholder control. NU7 (block 3,543,405,
 * mined 2026-11-06) moved to 25-second blocks: each block carries a third of
 * the subsidy, so the Lockbox takes 0.06249999 ZEC a block instead of 0.1875,
 * three times as often, until the 3rd halving at block 6,132,390.
 *
 * Sources: ZIP-1015 (block subsidy allocation), ZIP-1016 (coinholder funding),
 * ZIP-2001 (lockbox funding streams), ZIP-218 (25-second blocks), ZIP-214
 * revision 3 (streams extended to the 3rd halving on the NU7 schedule).
 */
import {
  HEIGHTS,
  ZAT_PER_ZEC,
  allocationAt,
  allocationBetween,
  blocksPerDay,
  targetSpacingSeconds,
} from "@/lib/funding/consensus";

export const LOCKBOX_START_HEIGHT = HEIGHTS.nu6; // NU6 / 2nd halving
export const NU7_HEIGHT = HEIGHTS.nu7; // 25-second blocks
/** The first block that pays the streams nothing (exclusive end of both). */
export const THIRD_HALVING_HEIGHT = HEIGHTS.thirdHalving;

/** What one block pays under the rules in force at its height, in ZEC. */
export type BlockRewards = {
  subsidyZec: number;
  lockboxZec: number;
  zcgZec: number;
  minerZec: number;
  blocksPerDay: number;
  targetSpacingSeconds: number;
};

const toZec = (zat: number): number => zat / ZAT_PER_ZEC;

export function blockRewardsAt(height: number): BlockRewards {
  const a = allocationAt(height);
  return {
    subsidyZec: toZec(a.subsidy),
    lockboxZec: toZec(a.lockbox),
    zcgZec: toZec(a.zcg),
    minerZec: toZec(a.miner),
    blocksPerDay: blocksPerDay(height),
    targetSpacingSeconds: targetSpacingSeconds(height),
  };
}

/**
 * The split in force since NU7. A range that starts before NU7 must not be
 * multiplied by these: use lockboxAccruedZat, which changes rate at the block.
 */
const CURRENT = blockRewardsAt(NU7_HEIGHT);
export const BLOCK_SUBSIDY_ZEC = CURRENT.subsidyZec; // 0.52083333
export const LOCKBOX_ZEC_PER_BLOCK = CURRENT.lockboxZec; // 12%, rounded down
export const ZCG_ZEC_PER_BLOCK = CURRENT.zcgZec; // 8%, rounded down (ZCG/FPF)
export const MINER_ZEC_PER_BLOCK = CURRENT.minerZec; // the remainder
export const BLOCKS_PER_DAY = CURRENT.blocksPerDay; // 25-second target

/**
 * Zatoshis the Lockbox stream accrued in the blocks after `afterHeight` up to
 * and including `throughHeight`: exact to the zatoshi, at each block's own
 * rate, and nothing from the 3rd halving on.
 */
export function lockboxAccruedZat(
  afterHeight: number,
  throughHeight: number,
): number {
  if (throughHeight <= afterHeight) return 0;
  return allocationBetween(afterHeight + 1, throughHeight).lockbox;
}

export function lockboxAccruedZec(
  afterHeight: number,
  throughHeight: number,
): number {
  return toZec(lockboxAccruedZat(afterHeight, throughHeight));
}

/**
 * ZEC accrued to the Lockbox by the given block height, counting blocks mined
 * since the lockbox start height (start block exclusive) and ending at the 3rd
 * halving. See lockbox.test.ts for the encoded convention.
 */
export function lockboxZecAt(height: number): number {
  return lockboxAccruedZec(LOCKBOX_START_HEIGHT, height);
}
