import "server-only";
function limit(name: string, fallback: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : fallback;
}
/** Explicit opt-in for a local development listener; ignored in production. */
function unlimitedLocalTesting(): boolean {
  if (process.env.NODE_ENV !== "development" || process.env.ZARVIS_LOCAL_UNLIMITED !== "true") return false;
  try {
    const origin = new URL(process.env.ZARVIS_ORIGIN ?? "");
    return origin.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)
      && !origin.username && !origin.password && origin.pathname === "/" && !origin.search && !origin.hash;
  } catch { return false; }
}

export function zarvisConfig() {
  const requestedProvider = process.env.ZARVIS_PROVIDER?.trim() || "openai";
  const provider = requestedProvider === "xai" ? "xai" : "openai";
  const validProvider = requestedProvider === "openai" || requestedProvider === "xai";
  const apiKey = (provider === "xai" ? process.env.XAI_API_KEY : process.env.OPENAI_API_KEY)?.trim() ?? "";
  return {
    apiKey,
    provider,
    providerLabel: provider === "xai" ? "xAI (Grok)" as const : "OpenAI" as const,
    enabled: process.env.ZARVIS_ENABLED === "true" && Boolean(validProvider && apiKey && process.env.DATABASE_URL),
    model: process.env.ZARVIS_MODEL?.trim() || (provider === "xai" ? "grok-4.7" : "gpt-5-mini"),
    webSearch: process.env.ZARVIS_WEB_SEARCH !== "false",
    unlimitedLocalTesting: unlimitedLocalTesting(),
    dailyLimit: limit("ZARVIS_DAILY_REQUEST_LIMIT", 100, 10_000),
    hourlyLimit: limit("ZARVIS_HOURLY_REQUEST_LIMIT", 30, 1_000),
  };
}
