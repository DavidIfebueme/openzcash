/** cacheWriteUsdPerMillion exists only for providers that report cache writes separately (Anthropic); absent means such tokens cannot be priced. */
export type ModelRates = { inputUsdPerMillion: number; cachedInputUsdPerMillion: number; cacheWriteUsdPerMillion?: number; outputUsdPerMillion: number; webSearchUsdPerCall: number };
/**
 * Public list prices (standard tier, prompts under the long-context threshold), checked 2026-09-28 (xAI, OpenAI) and 2026-10-07 (Anthropic).
 * Sources and dates are recorded in docs/zarvis.md; ZARVIS_*_USD_PER_MILLION / ZARVIS_SEARCH_USD_PER_CALL override each field.
 */
export const MODEL_RATES: Record<string, ModelRates> = {
  "grok-4.7": { inputUsdPerMillion: 2, cachedInputUsdPerMillion: 0.5, outputUsdPerMillion: 6, webSearchUsdPerCall: 0.005 },
  "grok-4.6": { inputUsdPerMillion: 2, cachedInputUsdPerMillion: 0.5, outputUsdPerMillion: 6, webSearchUsdPerCall: 0.005 },
  "gpt-5-mini": { inputUsdPerMillion: 0.25, cachedInputUsdPerMillion: 0.025, outputUsdPerMillion: 2, webSearchUsdPerCall: 0.01 },
  "gpt-5": { inputUsdPerMillion: 1.25, cachedInputUsdPerMillion: 0.125, outputUsdPerMillion: 10, webSearchUsdPerCall: 0.01 },
  "gpt-6-astra": { inputUsdPerMillion: 10, cachedInputUsdPerMillion: 1, outputUsdPerMillion: 50, webSearchUsdPerCall: 0.01 },
  // Anthropic: 5-minute cache writes; cache hits on Sonnet 5.5 and Opus 5.5 are 0.05x the input price, 0.1x elsewhere. Haiku 5.5 rates are for prompts up to 100k tokens.
  "claude-sonnet-5-5": { inputUsdPerMillion: 2, cachedInputUsdPerMillion: 0.1, cacheWriteUsdPerMillion: 2.5, outputUsdPerMillion: 10, webSearchUsdPerCall: 0.01 },
  "claude-haiku-5-5": { inputUsdPerMillion: 0.1, cachedInputUsdPerMillion: 0.01, cacheWriteUsdPerMillion: 0.125, outputUsdPerMillion: 0.5, webSearchUsdPerCall: 0.01 },
  "claude-opus-5-5": { inputUsdPerMillion: 4, cachedInputUsdPerMillion: 0.2, cacheWriteUsdPerMillion: 5, outputUsdPerMillion: 20, webSearchUsdPerCall: 0.01 },
  "claude-haiku-4-5": { inputUsdPerMillion: 1, cachedInputUsdPerMillion: 0.1, cacheWriteUsdPerMillion: 1.25, outputUsdPerMillion: 5, webSearchUsdPerCall: 0.01 },
};
const overrides: Record<keyof ModelRates, string> = { inputUsdPerMillion: "ZARVIS_INPUT_USD_PER_MILLION", cachedInputUsdPerMillion: "ZARVIS_CACHED_INPUT_USD_PER_MILLION", cacheWriteUsdPerMillion: "ZARVIS_CACHE_WRITE_USD_PER_MILLION", outputUsdPerMillion: "ZARVIS_OUTPUT_USD_PER_MILLION", webSearchUsdPerCall: "ZARVIS_SEARCH_USD_PER_CALL" };
function envRate(name: string): number | null {
  const raw = process.env[name]; if (raw === undefined || raw.trim() === "") return null;
  const value = Number(raw); return Number.isFinite(value) && value >= 0 && value <= 1e6 ? value : null;
}
/** Table rates for the model with per-field environment overrides; a missing field means unknown cost, never free. */
export function modelRates(model: string): Partial<ModelRates> {
  const table = MODEL_RATES[model.trim().toLowerCase()];
  const rates: Partial<ModelRates> = {};
  for (const field of Object.keys(overrides) as Array<keyof ModelRates>) {
    const value = envRate(overrides[field]) ?? table?.[field];
    if (value !== undefined) rates[field] = value;
  }
  return rates;
}
/** inputTokens is the whole input; cachedInputTokens and cacheWriteTokens (absent means none) are the parts of it billed at the cache rates. */
export type UsageForPricing = { model: string; modelCalls: number; usageReported: boolean; webSearchCalls: number; inputTokens: number; cachedInputTokens: number; cacheWriteTokens?: number; outputTokens: number; xResearchUsd?: number | null };
export function estimateUsageUsd(metrics: UsageForPricing): number | null {
  const researchUsd = metrics.xResearchUsd ?? 0;
  if (metrics.xResearchUsd === null || !Number.isFinite(researchUsd) || researchUsd < 0) return null;
  if (!metrics.modelCalls) return researchUsd;
  if (!metrics.usageReported) return null;
  const written = metrics.cacheWriteTokens ?? 0;
  const { inputUsdPerMillion: input, cachedInputUsdPerMillion: cached, cacheWriteUsdPerMillion: write, outputUsdPerMillion: output, webSearchUsdPerCall: search } = modelRates(metrics.model);
  if (input === undefined || output === undefined || (metrics.cachedInputTokens > 0 && cached === undefined) || (written > 0 && write === undefined) || (metrics.webSearchCalls > 0 && search === undefined)) return null;
  return ((metrics.inputTokens - metrics.cachedInputTokens - written) * input + metrics.cachedInputTokens * (cached ?? 0) + written * (write ?? 0) + metrics.outputTokens * output) / 1e6 + metrics.webSearchCalls * (search ?? 0) + researchUsd;
}
/** Optional application-level daily estimated-spend ceiling in USD; unset or invalid means no ceiling. */
export function dailyUsdCap(): number | null {
  const raw = process.env.ZARVIS_DAILY_USD_CAP?.trim(); if (!raw) return null;
  const value = Number(raw); return Number.isFinite(value) && value > 0 ? value : null;
}
