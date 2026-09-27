import { z } from "zod";
const positive = z.coerce.number().positive().max(1e12);
const percent = z.coerce.number().min(0).max(100);
const schema = z.object({
  zarvis: z.literal("1"), view: z.enum(["company", "community", "both"]),
  years: z.coerce.number().min(0).max(100), target: positive.max(100),
  basis: z.enum(["circulating", "maximum"]), priceNow: positive, futurePrice: positive,
  holdings: z.coerce.number().min(0).max(21000000), mining: z.coerce.number().min(0).max(25200),
  supply: positive.max(21000000), height: z.coerce.number().int().min(2726400).max(1e9),
  observation: z.coerce.number().int().min(2726400).max(1e9),
  fundAllocation: percent, continueFunding: z.enum(["true", "false"]), minerSales: percent,
  spendingFromZecSales: percent, annualSpending: z.coerce.number().min(0).max(1e12).optional(),
  fundZec: z.coerce.number().min(0).max(21000000).optional(), fundCash: z.coerce.number().min(0).max(1e12).optional(),
}).strict().refine((value) => value.holdings <= value.supply)
  .refine((value) => [value.annualSpending, value.fundZec, value.fundCash].filter((v) => v !== undefined).length % 3 === 0);
/** Reproducible public assumptions, never a saved chat or a URL to fetch. */
export function readScenarioLink(params: URLSearchParams) {
  if (params.toString().length > 4096 || [...params.values()].some((v) => !v.trim())) return null;
  if (new Set(params.keys()).size !== [...params.keys()].length) return null;
  const value = schema.safeParse(Object.fromEntries(params));
  return value.success ? value.data : null;
}
