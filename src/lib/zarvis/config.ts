import "server-only";
function limit(name: string, fallback: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : fallback;
}
export function zarvisConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  return {
    apiKey,
    enabled: process.env.ZARVIS_ENABLED === "true" && Boolean(apiKey && process.env.DATABASE_URL),
    model: process.env.ZARVIS_MODEL?.trim() || "gpt-5-mini",
    webSearch: process.env.ZARVIS_WEB_SEARCH !== "false",
    dailyLimit: limit("ZARVIS_DAILY_REQUEST_LIMIT", 100, 10_000),
    hourlyLimit: limit("ZARVIS_HOURLY_REQUEST_LIMIT", 30, 1_000),
  };
}
