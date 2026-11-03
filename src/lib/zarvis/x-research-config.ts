import "server-only";

function integer(name: string, fallback: number, maximum: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  // Invalid settings close the integration instead of silently raising a limit.
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, maximum) : 0;
}
export function xResearchConfig() {
  const apiKey = process.env.ZARVIS_X_RESEARCH_API_KEY?.trim() || process.env.XAI_API_KEY?.trim() || "";
  const dailyLimit = integer("ZARVIS_X_RESEARCH_DAILY_LIMIT", 20, 40);
  const hourlyLimit = integer("ZARVIS_X_RESEARCH_HOURLY_LIMIT", 4, 6);
  const raw = process.env.ZARVIS_X_RESEARCH_DAILY_USD_CAP ?? "3";
  const value = Number(raw);
  const dailyUsdCap = Number.isFinite(value) && value >= 0.01 ? Math.min(value, 10) : 0;
  return {
    enabled: process.env.ZARVIS_ENABLED === "true" && process.env.ZARVIS_WEB_SEARCH !== "false" && process.env.ZARVIS_X_RESEARCH_ENABLED === "true"
      && Boolean(apiKey && process.env.DATABASE_URL && dailyLimit && hourlyLimit && dailyUsdCap),
    apiKey, dailyLimit, hourlyLimit, dailyUsdCap,
  };
}
