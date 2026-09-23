import { describe, expect, it } from "vitest";
import { calculateDevFundBudget } from "./dev-fund";
import {
  calculateTreasuryScenario,
  CYPHERPUNK_DOCUMENTED_BASE_ZEC,
  NETWORK_SNAPSHOT_HEIGHT,
} from "./calculator";

const baseline = {
  holdingsZec: CYPHERPUNK_DOCUMENTED_BASE_ZEC,
  circulatingSupplyZec: 16_945_106,
  targetPercent: 5,
  minedPer14DaysZec: 3_023.13,
  blockHeight: NETWORK_SNAPSHOT_HEIGHT,
  months: 12,
  currentPriceUsd: 1_000,
  futurePriceUsd: 2_000,
  supplyBasis: "circulating" as const,
};

describe("treasury acquisition model", () => {
  it("uses the reported holdings without adding the disclosed mining twice", () => {
    const result = calculateTreasuryScenario({ ...baseline, months: 0 })!;
    expect(result.currentSharePercent).toBeCloseTo(1.9263, 3);
    expect(result.todayTargetZec).toBeCloseTo(847_255.3, 2);
    expect(result.todayGapZec).toBeCloseTo(520_837.79, 2);
    expect(result.todayPurchaseUsd).toBeCloseTo(520_837_790, 0);
    expect(result.projectedMinedZec).toBe(0);
    expect(result.futureGapZec).toBe(result.todayGapZec);
  });

  it("grows supply by the full subsidy, not just the miners' 80% allocation", () => {
    const result = calculateTreasuryScenario(baseline)!;
    expect(result.networkIssuancePerDayZec).toBe(1_800);
    expect(result.futureSupplyZec).toBe(17_602_556);
    expect(result.projectedMinedZec).toBeCloseTo((3_023.13 / 14) * 365.25, 2);
    expect(result.futureGapZec).toBeCloseTo(474_838.98767857, 2);
    expect(result.futurePurchaseUsd).toBeCloseTo(949_677_975.35714, 2);
    expect(result.futurePurchaseWithoutMiningUsd - result.futurePurchaseUsd)
      .toBeCloseTo(result.projectedMinedZec * 2_000, 2);
  });

  it("reconciles the five-year circulating target, total holdings and purchase gap", () => {
    const result = calculateTreasuryScenario({ ...baseline, blockHeight: 3_493_014, months: 60 })!;
    // Independently calculated: 913,385 pre-halving blocks and 1,190,455 after.
    expect(result.futureSupplyZec).toBeCloseTo(19_302_313.03125, 6);
    expect(result.futureTargetZec).toBeCloseTo(965_115.6515625, 6);
    expect(result.projectedMinedZec).toBeCloseTo(310_676.72588937, 6);
    expect(result.futureHoldingsZec).toBeCloseTo(637_094.23588937, 6);
    expect(result.futureGapZec).toBeCloseTo(328_021.41567313, 6);
    expect(result.futureHoldingsZec + result.futureGapZec).toBeCloseTo(result.futureTargetZec, 6);
  });

  it("fixes 5% of 21M at 1,050,000 ZEC regardless of horizon or price", () => {
    for (const months of [0, 12, 60, 120]) {
      for (const futurePriceUsd of [100, 1_000, 5_000]) {
        const result = calculateTreasuryScenario({ ...baseline, months, futurePriceUsd, supplyBasis: "maximum" })!;
        expect(result.todayTargetZec).toBe(1_050_000);
        expect(result.futureTargetZec).toBe(1_050_000);
        expect(result.todayGapZec).toBeCloseTo(723_582.49, 2);
        expect(result.currentSharePercent).toBeCloseTo(1.5543691, 6);
        expect(result.futureHoldingsZec + result.futureGapZec).toBeCloseTo(1_050_000, 6);
      }
    }
  });

  it("shows projected ownership against the selected future supply, independently of price or target", () => {
    const input = { ...baseline, blockHeight: 3_493_014, months: 60 };
    const circulating = calculateTreasuryScenario(input)!;
    const maximum = calculateTreasuryScenario({ ...input, supplyBasis: "maximum" })!;
    // 637,094.23588937 ZEC out of 19,302,313.03125 circulating / 21M maximum.
    expect(circulating.futureSharePercent).toBeCloseTo(3.3006108379753716, 8);
    expect(maximum.futureSharePercent).toBeCloseTo(3.0337820756636664, 8);
    expect(calculateTreasuryScenario({ ...input, futurePriceUsd: 10_000 })?.futureSharePercent)
      .toBe(circulating.futureSharePercent);
    expect(calculateTreasuryScenario({ ...input, targetPercent: 10 })?.futureSharePercent)
      .toBe(circulating.futureSharePercent);
  });

  it("distinguishes the simple 6.6-year illustration from the unreachable 5% mining goal", () => {
    const result = calculateTreasuryScenario(baseline)!;
    expect(result.simpleYearsToMineTodayGap).toBeCloseTo(6.60367, 4);
    expect(result.yearsToTarget).toBeNull();
    expect(result.terminalSharePercent).toBeGreaterThan(4.24);
    expect(result.terminalSharePercent).toBeLessThan(4.25);
    expect(result.terminalGapZec).toBeGreaterThan(150_000);
  });

  it("includes target growth in a reachable mining timeline", () => {
    const result = calculateTreasuryScenario({ ...baseline, targetPercent: 2.5 })!;
    const expectedYears = (16_945_106 * 0.025 - 326_417.51) / (3_023.13 / 14 - 1_800 * 0.025) / 365.25;
    expect(result.yearsToTarget).toBeCloseTo(expectedYears, 8);
    expect(result.yearsToTarget).toBeGreaterThan(result.simpleYearsToMineTodayGap!);
  });

  it("reduces subsidies at the third halving and expires the existing funding streams", () => {
    const result = calculateTreasuryScenario({
      ...baseline,
      blockHeight: 4_406_400 - 1_153, // 1,152 blocks left at the old subsidy.
      months: 2 * 12 / 365.25,
    })!;
    expect(result.futureSupplyZec).toBeCloseTo(16_945_106 + 1_800 + 900, 8);
    // Miner pool drops from 1,440 to 900 per day (80% -> 100% allocation).
    expect(result.projectedMinedZec).toBeCloseTo((3_023.13 / 14) * (1 + 900 / 1_440), 8);
  });

  it("preserves the historical mining share when the projection starts after a halving", () => {
    const before = calculateTreasuryScenario(baseline)!;
    const after = calculateTreasuryScenario({ ...baseline, blockHeight: 4_406_399 })!;
    expect(after.minerRewardSharePercent).toBe(before.minerRewardSharePercent);
    expect(after.networkIssuancePerDayZec).toBe(900);
    expect(after.miningPerDayZec).toBeCloseTo(134.9611607142857, 10);
    expect(after.projectedMinedZec).toBeCloseTo(134.9611607142857 * 365.25, 8);
  });

  it("accepts a separately dated custom observation without changing the historical default", () => {
    const result = calculateTreasuryScenario({ ...baseline, blockHeight: 4_406_400, miningObservationHeight: 4_406_400 })!;
    expect(result.miningPerDayZec).toBeCloseTo(3_023.13 / 14, 10);
    expect(result.minerRewardSharePercent).toBeCloseTo(3_023.13 / 14 / 900 * 100, 10);
    const lastOldBlock = calculateTreasuryScenario({ ...baseline, blockHeight: 4_406_399, miningObservationHeight: 4_406_399 })!;
    expect(lastOldBlock.minerRewardSharePercent).toBeCloseTo(3_023.13 / 14 / 1_440 * 100, 10);
    expect(calculateTreasuryScenario({ ...baseline, miningObservationHeight: Number.NaN })).toBeNull();
  });

  it("finds a reachable target across a halving, using each era's reward rate", () => {
    const result = calculateTreasuryScenario({ ...baseline, targetPercent: 3 })!;
    const firstDays = (4_406_400 - NETWORK_SNAPSHOT_HEIGHT - 1) / 1_152;
    const firstNet = 3_023.13 / 14 - 1_800 * 0.03;
    const remaining = 16_945_106 * 0.03 - 326_417.51 - firstDays * firstNet;
    const secondNet = (3_023.13 / 14) * (900 / 1_440) - 900 * 0.03;
    expect(result.yearsToTarget).toBeCloseTo((firstDays + remaining / secondNet) / 365.25, 8);
  });

  it("keeps a maximum-supply target fixed and caps actual mining at remaining issuance", () => {
    const result = calculateTreasuryScenario({
      ...baseline, circulatingSupplyZec: 20_900_000, holdingsZec: 1_000_000,
      months: 120, supplyBasis: "maximum",
    })!;
    expect(result.todayTargetZec).toBe(1_050_000);
    expect(result.futureSupplyZec).toBe(21_000_000);
    expect(result.projectedMinedZec).toBeCloseTo((3_023.13 / 14) * (100_000 / 1_800), 2);
    expect(result.futureGapZec).toBeGreaterThan(0);
  });

  it("accounts for the dev fund once and excludes retained company mining from market supply", () => {
    const result = calculateTreasuryScenario(baseline)!;
    expect(result.devFundPerDayZec).toBe(360);
    expect(result.otherMinersPerDayZec).toBeCloseTo(1_224.062142857, 8);
    expect(result.devFundPerDayZec + result.otherMinersPerDayZec + result.miningPerDayZec).toBeCloseTo(1_800, 8);
    expect(result.potentialMarketSalesPerDayZec).toBe(result.otherMinersPerDayZec);
    expect(result.todayGapInMarketFlowYears).toBeCloseTo(520_837.79 / 1_224.062142857 / 365.25, 8);
  });

  it("changes potential market flow without changing supply, ownership targets or company mining", () => {
    const retained = calculateTreasuryScenario(baseline)!;
    const sold = calculateTreasuryScenario({ ...baseline, annualDevFundZecSalesUsd: 4_000_000 })!;
    expect(sold.budgetSalesPerDayZec).toBeCloseTo(4_000_000 / 1_000 / 365.25, 8);
    expect(sold.potentialMarketSalesPerDayZec - retained.potentialMarketSalesPerDayZec).toBeCloseTo(sold.budgetSalesPerDayZec, 8);
    expect(sold.todayTargetZec).toBe(retained.todayTargetZec);
    expect(sold.futureTargetZec).toBe(retained.futureTargetZec);
    expect(sold.futureSupplyZec).toBe(retained.futureSupplyZec);
    expect(sold.projectedMinedZec).toBe(retained.projectedMinedZec);
    expect(sold.futurePurchaseUsd).toBe(retained.futurePurchaseUsd);
    const halfSold = calculateTreasuryScenario({ ...baseline, otherMinerSalePercent: 50 })!;
    expect(halfSold.potentialMarketSalesPerDayZec).toBeCloseTo(retained.potentialMarketSalesPerDayZec / 2, 8);
    const noneSold = calculateTreasuryScenario({ ...baseline, otherMinerSalePercent: 0 })!;
    expect(noneSold.potentialMarketSalesPerDayZec).toBe(0);
    expect(noneSold.todayGapInMarketFlowYears).toBeNull();
  });

  it("treats 20% as issuance allocation and preserves the measured mining share in alternative scenarios", () => {
    const current = calculateTreasuryScenario(baseline)!;
    const thirty = calculateTreasuryScenario({ ...baseline, devFundAllocationPercent: 30 })!;
    expect(thirty.devFundPerDayZec).toBeCloseTo(540, 8);
    expect(thirty.minerRewardSharePercent).toBe(current.minerRewardSharePercent);
    expect(thirty.miningPerDayZec).toBeCloseTo(current.miningPerDayZec * 0.7 / 0.8, 8);
    expect(thirty.futureSupplyZec).toBe(current.futureSupplyZec);
    expect(thirty.futureTargetZec).toBe(current.futureTargetZec);
    expect(thirty.futureGapZec).toBeGreaterThan(current.futureGapZec);
    expect(thirty.miningPerDayZec + thirty.otherMinersPerDayZec + thirty.devFundPerDayZec).toBeCloseTo(1_800, 8);
  });

  it("can model dev fund renewal while retaining halvings and the 21M supply cap", () => {
    const noRenewal = calculateTreasuryScenario({ ...baseline, months: 60 })!;
    const renewed = calculateTreasuryScenario({ ...baseline, months: 60, continueDevFundAfterHalving: true })!;
    expect(renewed.futureSupplyZec).toBe(noRenewal.futureSupplyZec);
    expect(renewed.futureTargetZec).toBe(noRenewal.futureTargetZec);
    expect(renewed.projectedMinedZec).toBeLessThan(noRenewal.projectedMinedZec);
    expect(renewed.terminalSharePercent).toBeCloseTo(3.87, 2);
    expect(renewed.yearsToTarget).toBeNull();
  });

  it("does not reserve another 20% after the currently scheduled funding streams expire", () => {
    const result = calculateTreasuryScenario({ ...baseline, blockHeight: 4_406_400 - 1 })!;
    expect(result.networkIssuancePerDayZec).toBe(900);
    expect(result.devFundPerDayZec).toBe(0);
    expect(result.otherMinersPerDayZec).toBeCloseTo(900 - 134.9611607142857, 8);
  });

  it("reports no mining completion with zero output and no negative buying need when already funded", () => {
    const noMining = calculateTreasuryScenario({ ...baseline, minedPer14DaysZec: 0 })!;
    expect(noMining.yearsToTarget).toBeNull();
    expect(noMining.simpleYearsToMineTodayGap).toBeNull();
    expect(noMining.projectedMinedZec).toBe(0);
    const funded = calculateTreasuryScenario({ ...baseline, holdingsZec: 1_000_000 })!;
    expect(funded.yearsToTarget).toBe(0);
    expect(funded.todayGapZec).toBe(0);
    expect(funded.futurePurchaseUsd).toBe(0);
  });

  it("rejects invalid inputs and output exceeding the miner reward budget", () => {
    expect(calculateTreasuryScenario({ ...baseline, currentPriceUsd: NaN })).toBeNull();
    expect(calculateTreasuryScenario({ ...baseline, minedPer14DaysZec: 1_500 * 14 })).toBeNull();
    expect(calculateTreasuryScenario({ ...baseline, targetPercent: 101 })).toBeNull();
    expect(calculateTreasuryScenario({ ...baseline, blockHeight: -1 })).toBeNull();
    expect(calculateTreasuryScenario({ ...baseline, months: -12 })).toBeNull();
    expect(calculateTreasuryScenario({ ...baseline, currentPriceUsd: Number.MAX_VALUE })).toBeNull();
    expect(calculateTreasuryScenario({ ...baseline, devFundAllocationPercent: 101 })).toBeNull();
    expect(calculateTreasuryScenario({ ...baseline, annualDevFundZecSalesUsd: -1 })).toBeNull();
    expect(calculateTreasuryScenario({ ...baseline, otherMinerSalePercent: -1 })).toBeNull();
  });
});

describe("dev fund spending model", () => {
  const budget = {
    historicalSpendingUsd: 20_000_000,
    historicalYears: 5,
    treasuryZec: 250_000,
    treasuryCashUsd: 0,
    spendingFromZecSalesPercent: 100,
    currentPriceUsd: 1_600,
    futurePriceUsd: 3_200,
  };

  it("turns the user's 20M / five-year / 400M example into a 4M annual budget and 1% asset use", () => {
    const result = calculateDevFundBudget(budget)!;
    expect(result.annualSpendingUsd).toBe(4_000_000);
    expect(result.annualTreasuryUsePercentNow).toBe(1);
    expect(result.coverageYearsNow).toBe(100);
    expect(result.coverageYearsFuture).toBe(200);
    expect(result.annualZecSalesNow).toBe(2_500);
    expect(result.annualZecSalesFuture).toBe(1_250);
  });

  it("does not treat every grant payment as a ZEC sale or subtract historic spending twice", () => {
    const cashFunded = calculateDevFundBudget({ ...budget, spendingFromZecSalesPercent: 0 })!;
    expect(cashFunded.annualSpendingUsd).toBe(4_000_000);
    expect(cashFunded.annualZecSalesNow).toBe(0);
    expect(cashFunded.coverageYearsNow).toBe(100);
    expect(cashFunded.coverageYearsFuture).toBe(200);
    const halfFunded = calculateDevFundBudget({ ...budget, spendingFromZecSalesPercent: 50 })!;
    expect(halfFunded.annualZecSalesNow).toBe(1_250);
    expect(halfFunded.annualTreasuryUsePercentNow).toBe(1);
  });

  it("connects a fivefold future price to asset value, coverage and the annual sale equivalent", () => {
    const result = calculateDevFundBudget({ ...budget, futurePriceUsd: 8_000 })!;
    expect(result.currentTreasuryUsd).toBe(400_000_000);
    expect(result.futureTreasuryUsd).toBe(2_000_000_000);
    expect(result.coverageYearsNow).toBe(100);
    expect(result.coverageYearsFuture).toBe(500);
    expect(result.annualTreasuryUsePercentFuture).toBe(0.2);
    expect(result.annualSpendingUsd).toBe(4_000_000);
    expect(result.annualZecSalesFuture).toBe(500);
  });

  it("revalues only ZEC and keeps USD cash fixed when prices rise or fall", () => {
    const mixed = { ...budget, treasuryZec: 243_750, treasuryCashUsd: 10_000_000 };
    const up = calculateDevFundBudget(mixed)!;
    expect(up.currentTreasuryUsd).toBe(400_000_000);
    expect(up.futureTreasuryUsd).toBe(790_000_000);
    expect(up.coverageYearsFuture).toBe(197.5);
    const down = calculateDevFundBudget({ ...mixed, futurePriceUsd: 800 })!;
    expect(down.futureTreasuryUsd).toBe(205_000_000);
    expect(down.coverageYearsFuture).toBe(51.25);
    const cashOnly = calculateDevFundBudget({ ...budget, treasuryZec: 0, treasuryCashUsd: 400_000_000 })!;
    expect(cashOnly.coverageYearsFuture).toBe(cashOnly.coverageYearsNow);
  });

  it("uses the selected price for both buying the company gap and fund coverage", () => {
    const coverage = [];
    const purchaseCosts = [];
    for (const multiple of [1, 2, 5]) {
      const futurePriceUsd = budget.currentPriceUsd * multiple;
      const fund = calculateDevFundBudget({ ...budget, futurePriceUsd })!;
      const company = calculateTreasuryScenario({ ...baseline, currentPriceUsd: budget.currentPriceUsd, futurePriceUsd })!;
      coverage.push(fund.coverageYearsFuture);
      purchaseCosts.push(company.futurePurchaseUsd);
      // Price does not create extra coins or change a constant mining share.
      expect(company.futureGapZec).toBeCloseTo(474_838.98767857, 6);
      expect(company.yearsToTarget).toBeNull();
    }
    expect(coverage).toEqual([100, 200, 500]);
    expect(purchaseCosts[1]).toBe(purchaseCosts[0] * 2);
    expect(purchaseCosts[2]).toBeCloseTo(purchaseCosts[0] * 5, 5);
    const doubleSpend = calculateDevFundBudget({ ...budget, historicalSpendingUsd: 40_000_000 })!;
    expect(doubleSpend.coverageYearsNow).toBe(50);
    expect(doubleSpend.coverageYearsFuture).toBe(100);
  });

  it("rejects invalid assets, budgets and prices without inventing coverage", () => {
    expect(calculateDevFundBudget({ ...budget, historicalYears: 0 })).toBeNull();
    expect(calculateDevFundBudget({ ...budget, treasuryZec: -1 })).toBeNull();
    expect(calculateDevFundBudget({ ...budget, treasuryCashUsd: -1 })).toBeNull();
    expect(calculateDevFundBudget({ ...budget, spendingFromZecSalesPercent: 101 })).toBeNull();
    expect(calculateDevFundBudget({ ...budget, futurePriceUsd: NaN })).toBeNull();
    expect(calculateDevFundBudget({ ...budget, historicalSpendingUsd: 0 })?.coverageYearsFuture).toBeNull();
    expect(calculateDevFundBudget({ ...budget, treasuryZec: 0 })?.annualTreasuryUsePercentFuture).toBeNull();
  });
});
