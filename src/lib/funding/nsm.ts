/**
 * The Network Sustainability Mechanism as NU7 deployed it on mainnet: the
 * rules that move ZEC into and out of the NSM value balance. Pure arithmetic
 * on heights and zatoshis; the live balance comes from src/lib/network/nsm.ts.
 *
 * Sources: ZIP 235 (60% of transaction fees leave circulation); ZIP 237 (the
 * balance, its seed and its reissuance through the block subsidy); ZIP 259
 * (NU7 deployment heights). ZIP 233, a field for voluntary removals, is a
 * draft and was not deployed with NU7. Each rule is checked against real
 * blocks in nsm.test.ts.
 */
import { HEIGHTS } from "./consensus";

export const NSM = {
  /** The first block whose fees feed the balance. */
  activationHeight: HEIGHTS.nu7,
  /**
   * INITIAL_NSM_VALUE_BALANCE, mainnet: the subsidy and fees coinbase
   * transactions left unclaimed before NU6, credited at NU7 (ZIP 237).
   */
  initialBalanceZat: 36_858_445_520,
  /**
   * NSM_REISSUANCE_HEIGHT, mainnet: 16,026,474 − 2 × the NU7 height. From here
   * every block subsidy also carries a share of the balance (ZIP 237, ZIP 259).
   */
  reissuanceHeight: 8_939_664,
  /** NSMFeeContribution = floor(6 × fees / 10), ZIP 235. */
  feeShare: { numerator: 6, denominator: 10 },
  /** BLOCK_SUBSIDY_FRACTION with 5,040,000-block halvings: 1375 / 10^10. */
  reissuanceFraction: { numerator: 1_375, denominator: 10_000_000_000 },
} as const;

function assertZatoshis(value: number, what: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`Invalid ${what}: ${value}`);
  }
}

/** Zatoshis of a block's fees that leave circulation; zero before NU7. */
export function nsmFeeContribution(height: number, feesZat: number): number {
  assertZatoshis(feesZat, "transaction fees");
  if (height < NSM.activationHeight) return 0;
  const { numerator, denominator } = NSM.feeShare;
  return Math.floor((feesZat * numerator) / denominator);
}

/** What the miner keeps of a block's fees. */
export function nsmMinerFees(height: number, feesZat: number): number {
  return feesZat - nsmFeeContribution(height, feesZat);
}

/**
 * AdditionalBlockSubsidy(height): what the block reissues from the balance
 * the previous block left, rounded up to the next zatoshi. BigInt inside,
 * because 1375 × a large balance does not fit a double.
 */
export function nsmReissuance(height: number, balanceZat: number): number {
  assertZatoshis(balanceZat, "NSM balance");
  if (height < NSM.reissuanceHeight) return 0;
  const numerator = BigInt(NSM.reissuanceFraction.numerator);
  const denominator = BigInt(NSM.reissuanceFraction.denominator);
  const product = numerator * BigInt(balanceZat);
  return Number((product + denominator - 1n) / denominator);
}
