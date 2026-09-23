export type DevFundReportedData = {
  zcg: {
    paidMilestonesUsd: number | null;
    zec: number | null;
    cashUsd: number | null;
    snapshotAt: string;
    importedAt: string;
    updatesRequired: boolean;
    sourceUrl: string;
  } | null;
  lockbox: {
    zec: number;
    height: number;
    baselineHeight: number;
    snapshotAt: string;
    importedAt: string;
    updatesRequired: boolean;
    sourceUrl: string;
  } | null;
};

/** Same two pools and valuation as the landing-page treasury overview. */
export function valueReportedDevFund(data: DevFundReportedData, priceUsd: number): number | null {
  if (!data.zcg || data.zcg.zec === null || data.zcg.cashUsd === null || !data.lockbox ||
    !Number.isFinite(priceUsd) || priceUsd <= 0) return null;
  const amounts = [data.zcg.zec, data.zcg.cashUsd, data.lockbox.zec];
  if (amounts.some((amount) => !Number.isFinite(amount) || amount < 0)) return null;

  // Round each pool to cents, like the footer. Future receivables and grant
  // liabilities are not added to assets; past spending is not subtracted twice.
  return (Math.round(data.zcg.zec * priceUsd * 100) +
    Math.round(data.lockbox.zec * priceUsd * 100) +
    Math.round(data.zcg.cashUsd * 100)) / 100;
}

export type DevFundBudgetInput = {
  historicalSpendingUsd: number;
  historicalYears: number;
  treasuryZec: number;
  treasuryCashUsd: number;
  spendingFromZecSalesPercent: number;
  currentPriceUsd: number;
  futurePriceUsd: number;
};

/**
 * Budget equivalents only. Grants paid do not establish exchange sales, and
 * the combined ZCG / Lockbox valuation is not a single spendable cash pool.
 * Revalue the same ZEC holdings at each scenario price; USD cash and annual
 * expenses stay fixed. Coverage excludes future funding and spending growth.
 */
export function calculateDevFundBudget(input: DevFundBudgetInput) {
  if (Object.values(input).some((value) => !Number.isFinite(value))) return null;
  if (
    input.historicalSpendingUsd < 0 || input.historicalYears <= 0 ||
    input.treasuryZec < 0 || input.treasuryCashUsd < 0 ||
    input.spendingFromZecSalesPercent < 0 || input.spendingFromZecSalesPercent > 100 ||
    input.currentPriceUsd <= 0 || input.futurePriceUsd <= 0
  ) return null;

  const annualSpendingUsd = input.historicalSpendingUsd / input.historicalYears;
  const annualZecSaleBudgetUsd = annualSpendingUsd * input.spendingFromZecSalesPercent / 100;
  const currentTreasuryUsd = input.treasuryZec * input.currentPriceUsd + input.treasuryCashUsd;
  const futureTreasuryUsd = input.treasuryZec * input.futurePriceUsd + input.treasuryCashUsd;
  const result = {
    annualSpendingUsd,
    annualZecSaleBudgetUsd,
    currentTreasuryUsd,
    futureTreasuryUsd,
    annualTreasuryUsePercentNow: currentTreasuryUsd > 0 ? annualSpendingUsd / currentTreasuryUsd * 100 : null,
    annualTreasuryUsePercentFuture: futureTreasuryUsd > 0 ? annualSpendingUsd / futureTreasuryUsd * 100 : null,
    coverageYearsNow: annualSpendingUsd > 0 ? currentTreasuryUsd / annualSpendingUsd : null,
    coverageYearsFuture: annualSpendingUsd > 0 ? futureTreasuryUsd / annualSpendingUsd : null,
    annualZecSalesNow: annualZecSaleBudgetUsd / input.currentPriceUsd,
    annualZecSalesFuture: annualZecSaleBudgetUsd / input.futurePriceUsd,
  };
  return Object.values(result).every((value) => value === null || Number.isFinite(value)) ? result : null;
}
