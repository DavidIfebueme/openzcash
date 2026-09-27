import { z } from "zod";

/** Assumptions only: never store balances or prior model answers as verified evidence. */
export const scenarioAssumptionsSchema = z.object({
  view: z.enum(["company", "community", "both"]),
  years: z.number().min(0).max(100),
  targetPercent: z.number().positive().max(100),
  supplyBasis: z.enum(["circulating", "maximum"]),
  priceMultiple: z.number().positive().max(10000),
  futurePriceUsd: z.number().positive().max(1e9),
  currentPriceUsd: z.number().positive().max(1e9),
  holdingsZec: z.number().min(0).max(21000000),
  minedPer14DaysZec: z.number().min(0).max(25200),
  devFundAllocationPercent: z.number().min(0).max(100),
  continueDevFundAfterHalving: z.boolean(),
  otherMinerSalePercent: z.number().min(0).max(100),
  annualSpendingUsd: z.number().min(0).max(1e12),
  spendingFromZecSalesPercent: z.number().min(0).max(100),
}).partial().strict();
export type ScenarioAssumptions = z.infer<typeof scenarioAssumptionsSchema>;
export const scenarioDefaults: ScenarioAssumptions = {
  view: "company", years: 1, targetPercent: 5, supplyBasis: "circulating", priceMultiple: 1,
  devFundAllocationPercent: 20, continueDevFundAfterHalving: false,
  otherMinerSalePercent: 100, spendingFromZecSalesPercent: 100,
};
export function mergeScenario(previous: ScenarioAssumptions = {}, change: ScenarioAssumptions = {}): ScenarioAssumptions {
  const result = { ...scenarioDefaults, ...scenarioAssumptionsSchema.parse(previous), ...scenarioAssumptionsSchema.parse(change) };
  if (change.futurePriceUsd !== undefined) delete result.priceMultiple;
  else if (change.priceMultiple !== undefined) delete result.futurePriceUsd;
  return result;
}
