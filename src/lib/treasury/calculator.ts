export const MAX_ZEC_SUPPLY = 21_000_000;
export const CYPHERPUNK_MINED_ZEC = 3_023.13;
// Company dashboard, checked 2026-09-23; latest ZEC entry: 2026-08-31.
// This balance already includes the 3,023.13 ZEC mining disclosure.
export const CYPHERPUNK_DOCUMENTED_BASE_ZEC = 326_417.51;
export const NETWORK_SNAPSHOT_HEIGHT = 3_492_985;
export const NETWORK_SNAPSHOT_DATE = "2026-09-23";

const SECOND_HALVING_HEIGHT = 2_726_400;
// A representative block in the disclosed Aug 2026 reward era, not a claim
// about the observation's exact block height. Keep independent of live tips.
export const CYPHERPUNK_MINING_REFERENCE_HEIGHT = SECOND_HALVING_HEIGHT;
const THIRD_HALVING_HEIGHT = 4_406_400;
const HALVING_BLOCKS = 1_680_000;
const BLOCKS_PER_DAY = 1_152; // 75-second target, ZIP 208.
const DAYS_PER_YEAR = 365.25;
const SECOND_ERA_SUBSIDY_ZAT = 156_250_000;
const ZATS_PER_ZEC = 100_000_000;

export type SupplyBasis = "circulating" | "maximum";

export type TreasuryScenarioInput = {
  holdingsZec: number;
  circulatingSupplyZec: number;
  targetPercent: number;
  minedPer14DaysZec: number;
  // Reference era for the observed output; independent of the projection start.
  // The default observation is Aug 2026, in the snapshot's subsidy era.
  miningObservationHeight?: number;
  blockHeight: number;
  months: number;
  currentPriceUsd: number;
  futurePriceUsd: number;
  supplyBasis: SupplyBasis;
  otherMinerSalePercent?: number;
  devFundAllocationPercent?: number;
  continueDevFundAfterHalving?: boolean;
  annualDevFundZecSalesUsd?: number;
};

export type TreasuryScenario = {
  currentSharePercent: number;
  todaySupplyZec: number;
  todayTargetZec: number;
  todayGapZec: number;
  todayPurchaseUsd: number;
  days: number;
  futureSupplyZec: number;
  projectedMinedZec: number;
  futureHoldingsZec: number;
  futureSharePercent: number;
  futureTargetZec: number;
  futureGapZec: number;
  futurePurchaseUsd: number;
  futurePurchaseWithoutMiningUsd: number;
  marketPurchaseAvoidedZec: number;
  miningPerDayZec: number;
  networkIssuancePerDayZec: number;
  minerRewardSharePercent: number;
  simpleYearsToMineTodayGap: number | null;
  yearsToTarget: number | null;
  terminalSharePercent: number;
  terminalGapZec: number;
  devFundPerDayZec: number;
  otherMinersPerDayZec: number;
  budgetSalesPerDayZec: number;
  potentialMarketSalesPerDayZec: number;
  todayGapInMarketFlowYears: number | null;
};

type RewardEra = { days: number; issuancePerDay: number; minerFraction: number };

/**
 * Current discrete-halving schedule (ZIP 208 / protocol section 7.8).
 * ZIP 214's existing funding streams expire at the third halving. With no
 * renewal assumed, miners receive 100% of the subsidy thereafter. Future
 * upgrades (including proposed ZIP 234) are not treated as activated.
 */
function rewardEras(height: number, allocationPercent = 20, continueFunding = false): RewardEra[] {
  const eras: RewardEra[] = [];
  let nextBlock = height + 1;
  let era = Math.floor((nextBlock - SECOND_HALVING_HEIGHT) / HALVING_BLOCKS);
  for (; era < 28; era++) {
    const subsidyZat = Math.floor(SECOND_ERA_SUBSIDY_ZAT / 2 ** era);
    if (subsidyZat === 0) break;
    const nextHalving = SECOND_HALVING_HEIGHT + (era + 1) * HALVING_BLOCKS;
    eras.push({
      days: (nextHalving - nextBlock) / BLOCKS_PER_DAY,
      issuancePerDay: (subsidyZat / ZATS_PER_ZEC) * BLOCKS_PER_DAY,
      minerFraction: nextBlock < THIRD_HALVING_HEIGHT || continueFunding ? 1 - allocationPercent / 100 : 1,
    });
    nextBlock = nextHalving;
  }
  return eras;
}

/**
 * Nominal USD purchases, not mining profit or an executable market quote.
 * The observed output estimates a constant share of miner subsidies. All
 * mined ZEC are retained. Circulating supply grows by projected new issuance.
 */
export function calculateTreasuryScenario(input: TreasuryScenarioInput): TreasuryScenario | null {
  const otherMinerSalePercent = input.otherMinerSalePercent ?? 100;
  const devFundAllocationPercent = input.devFundAllocationPercent ?? 20;
  const annualDevFundZecSalesUsd = input.annualDevFundZecSalesUsd ?? 0;
  const miningObservationHeight = input.miningObservationHeight ?? CYPHERPUNK_MINING_REFERENCE_HEIGHT;
  const numbers = [
    input.holdingsZec, input.circulatingSupplyZec, input.targetPercent,
    input.minedPer14DaysZec, input.blockHeight, input.months,
    input.currentPriceUsd, input.futurePriceUsd, otherMinerSalePercent,
    devFundAllocationPercent, annualDevFundZecSalesUsd, miningObservationHeight,
  ];
  if (numbers.some((value) => !Number.isFinite(value))) return null;
  if (
    input.holdingsZec < 0 || input.holdingsZec > input.circulatingSupplyZec ||
    input.circulatingSupplyZec <= 0 || input.circulatingSupplyZec > MAX_ZEC_SUPPLY ||
    input.targetPercent <= 0 || input.targetPercent > 100 ||
    input.minedPer14DaysZec < 0 ||
    !Number.isSafeInteger(input.blockHeight) || input.blockHeight < SECOND_HALVING_HEIGHT ||
    !Number.isSafeInteger(miningObservationHeight) || miningObservationHeight < SECOND_HALVING_HEIGHT ||
    input.months < 0 || input.months > 1_200 ||
    input.currentPriceUsd <= 0 || input.futurePriceUsd <= 0 ||
    otherMinerSalePercent < 0 || otherMinerSalePercent > 100 ||
    devFundAllocationPercent < 0 || devFundAllocationPercent > 100 ||
    annualDevFundZecSalesUsd < 0 ||
    !["circulating", "maximum"].includes(input.supplyBasis)
  ) return null;

  const eras = rewardEras(input.blockHeight, devFundAllocationPercent, input.continueDevFundAfterHalving);
  const networkIssuancePerDayZec = eras[0]?.issuancePerDay ?? 0;
  const minerIssuancePerDay = networkIssuancePerDayZec * (eras[0]?.minerFraction ?? 0);
  // Calibrate the observed reward share against the official allocation,
  // before applying a hypothetical allocation. Editing the dev fund should
  // change miner output without inventing a different fleet/hashrate share.
  // Advancing the projection past a halving must not recalibrate historical
  // production against a smaller pool and inflate the company's reward share.
  // The reference names the observed block itself; rewardEras starts at h + 1.
  const officialEra = rewardEras(miningObservationHeight - 1)[0];
  const observedMinerPool = (officialEra?.issuancePerDay ?? 0) * (officialEra?.minerFraction ?? 0);
  const observedMiningPerDay = input.minedPer14DaysZec / 14;
  if (observedMiningPerDay > observedMinerPool) return null;
  const rewardShare = observedMinerPool > 0 ? observedMiningPerDay / observedMinerPool : 0;
  const miningPerDayZec = minerIssuancePerDay * rewardShare;
  // Funding is a slice of new issuance, not a deduction from the ownership
  // denominator. Avoid counting the treasury's own retained mining as sales.
  const devFundPerDayZec = networkIssuancePerDayZec - minerIssuancePerDay;
  const otherMinersPerDayZec = minerIssuancePerDay - miningPerDayZec;
  // Spending can draw on past reserves, so its sale equivalent is not capped
  // at this year's fund inflow. It is not evidence of actual sales/liquidity.
  const budgetSalesPerDayZec = annualDevFundZecSalesUsd / input.currentPriceUsd / DAYS_PER_YEAR;
  const potentialMarketSalesPerDayZec = otherMinersPerDayZec * otherMinerSalePercent / 100 + budgetSalesPerDayZec;
  const targetFraction = input.targetPercent / 100;
  const targetSupply = (circulating: number) =>
    input.supplyBasis === "maximum" ? MAX_ZEC_SUPPLY : circulating;
  const todaySupplyZec = targetSupply(input.circulatingSupplyZec);
  const todayTargetZec = todaySupplyZec * targetFraction;
  const todayGapZec = Math.max(0, todayTargetZec - input.holdingsZec);
  const days = input.months * DAYS_PER_YEAR / 12;

  let elapsed = 0;
  let supply = input.circulatingSupplyZec;
  let mined = 0;
  let futureCirculatingZec = supply;
  let projectedMinedZec = 0;
  let daysToTarget: number | null = todayGapZec === 0 ? 0 : null;

  for (const era of eras) {
    const availableDays = Math.min(era.days, Math.max(0, MAX_ZEC_SUPPLY - supply) / era.issuancePerDay);
    const mineRate = era.issuancePerDay * era.minerFraction * rewardShare;
    const gap = targetSupply(supply) * targetFraction - input.holdingsZec - mined;
    const targetGrowth = input.supplyBasis === "circulating" ? targetFraction * era.issuancePerDay : 0;
    const netAccumulation = mineRate - targetGrowth;
    if (daysToTarget === null && netAccumulation > 0 && gap / netAccumulation <= availableDays) {
      daysToTarget = elapsed + Math.max(0, gap / netAccumulation);
    }

    const horizonDays = Math.max(0, Math.min(availableDays, days - elapsed));
    futureCirculatingZec += era.issuancePerDay * horizonDays;
    projectedMinedZec += mineRate * horizonDays;
    supply = Math.min(MAX_ZEC_SUPPLY, supply + era.issuancePerDay * availableDays);
    mined += mineRate * availableDays;
    elapsed += era.days;
  }

  const futureSupplyZec = targetSupply(Math.min(MAX_ZEC_SUPPLY, futureCirculatingZec));
  const futureHoldingsZec = input.holdingsZec + projectedMinedZec;
  const futureTargetZec = futureSupplyZec * targetFraction;
  const futureGapWithoutMiningZec = Math.max(0, futureTargetZec - input.holdingsZec);
  const futureGapZec = Math.max(0, futureGapWithoutMiningZec - projectedMinedZec);

  const result = {
    currentSharePercent: input.holdingsZec / todaySupplyZec * 100,
    todaySupplyZec, todayTargetZec, todayGapZec,
    todayPurchaseUsd: todayGapZec * input.currentPriceUsd,
    days, futureSupplyZec, projectedMinedZec, futureHoldingsZec, futureTargetZec, futureGapZec,
    futureSharePercent: futureHoldingsZec / futureSupplyZec * 100,
    futurePurchaseUsd: futureGapZec * input.futurePriceUsd,
    futurePurchaseWithoutMiningUsd: futureGapWithoutMiningZec * input.futurePriceUsd,
    marketPurchaseAvoidedZec: futureGapWithoutMiningZec - futureGapZec,
    miningPerDayZec, networkIssuancePerDayZec,
    minerRewardSharePercent: rewardShare * 100,
    simpleYearsToMineTodayGap: todayGapZec === 0 ? 0 : miningPerDayZec > 0 ? todayGapZec / miningPerDayZec / DAYS_PER_YEAR : null,
    yearsToTarget: daysToTarget === null ? null : daysToTarget / DAYS_PER_YEAR,
    terminalSharePercent: (input.holdingsZec + mined) / targetSupply(supply) * 100,
    terminalGapZec: Math.max(0, targetSupply(supply) * targetFraction - input.holdingsZec - mined),
    devFundPerDayZec, otherMinersPerDayZec, budgetSalesPerDayZec, potentialMarketSalesPerDayZec,
    // A volume equivalent at current rates, not an order-execution timeline.
    todayGapInMarketFlowYears: todayGapZec === 0 ? 0 : potentialMarketSalesPerDayZec > 0 ? todayGapZec / potentialMarketSalesPerDayZec / DAYS_PER_YEAR : null,
  };
  return Object.values(result).every((value) => value === null || Number.isFinite(value)) ? result : null;
}
