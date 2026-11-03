/** Shared policy for this non-publishing design beta. */
export const BETA_PREVIEW = true;
export const BETA_ZEC_USD = 1133.53;
export const BETA_RATE_DATE = "2026-11-03";
export const BETA_RATE_SOURCE = "https://www.coingecko.com/en/coins/zcash";
export const BETA_MAX_USD = 100;
export const BETA_MAX_ZEC = 0.9999;
export const BETA_LOCK_MESSAGE =
  "Explore the beta. Publishing and submissions are coming soon.";

// Floor to four decimals so rounding cannot push an example over its USD budget.
export function betaReward(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0)
    throw new Error("A positive example budget is required.");
  return Math.min(
    BETA_MAX_ZEC,
    Math.floor((Math.min(usd, BETA_MAX_USD) / BETA_ZEC_USD) * 10000) / 10000,
  );
}
export const betaUsd = (zec: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    zec * BETA_ZEC_USD,
  );
export function betaPrizes(reward: number, weights: number[]): number[] {
  if (!weights.length) return [];
  const units = Math.round(reward * 10000),
    total = weights.reduce((sum, n) => sum + n, 0);
  const shares = weights.map((weight) => Math.floor((units * weight) / total));
  shares[0] += units - shares.reduce((sum, n) => sum + n, 0);
  return shares.map((n) => n / 10000);
}
/** The state layer uses this too; disabled controls are not the only barrier. */
export function betaMutation<Args extends unknown[]>(
  write: (...args: Args) => void,
) {
  return (...args: Args): void => {
    if (!BETA_PREVIEW) write(...args);
  };
}
