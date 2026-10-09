import type { CoinholderOptionId } from "@/lib/coinholder/analytics/model";

export const INSIGHT_OPTIONS = [
  { id: "accept", label: "Accept" },
  { id: "reject", label: "Reject" },
  { id: "lower", label: "Lower amount" },
  { id: "abstain", label: "Abstain" }
] as const satisfies ReadonlyArray<{ id: CoinholderOptionId; label: string }>;

/** Format the published decimal amount without converting money to floating point. */
export function formatInsightZec(value: string): string {
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error("Invalid ZEC amount");
  const [whole, fraction = ""] = value.split(".");
  const decimals = fraction.replace(/0+$/, "");
  return `${BigInt(whole).toLocaleString("en-US")}${decimals ? `.${decimals}` : ""}`;
}

/** Retain sub-display precision; outcome decisions always use the raw integers. */
function ratio(numerator: bigint, denominator: bigint): number | null {
  if (denominator <= 0n) return null;
  const scale = 1_000_000_000_000n;
  const sign = numerator < 0n ? -1 : 1;
  const magnitude = numerator < 0n ? -numerator : numerator;
  return sign * Number((magnitude * scale + denominator / 2n) / denominator) / Number(scale);
}

export function insightPercent(numerator: bigint, denominator: bigint): number | null {
  return ratio(numerator * 100n, denominator);
}

/** Final ZEC composition minus revealed-share composition, in percentage points. */
export function insightGap(shareCount: number, shareTotal: number, weightUnits: string, totalWeightUnits: string): number | null {
  if (!Number.isSafeInteger(shareCount) || !Number.isSafeInteger(shareTotal) || shareCount < 0 || shareTotal <= 0 || shareCount > shareTotal) return null;
  const shares = BigInt(shareCount);
  const totalShares = BigInt(shareTotal);
  const weight = BigInt(weightUnits);
  const totalWeight = BigInt(totalWeightUnits);
  return ratio((weight * totalShares - shares * totalWeight) * 100n, totalWeight * totalShares);
}

/** Distance from the strict majority threshold, using the non-abstaining weight. */
export function insightMargin(acceptUnits: bigint, eligibleUnits: bigint): number | null {
  return ratio(acceptUnits * 100n - eligibleUnits * 50n, eligibleUnits);
}
