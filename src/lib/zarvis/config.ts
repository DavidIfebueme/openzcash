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

/** Server-only launch override, evaluated per request and limited to a 24-hour window. */
function quotaPause(): { active: boolean; until: string | null } {
  const raw = process.env.ZARVIS_QUOTA_PAUSE_UNTIL?.trim() ?? "";
  const inactive = { active: false, until: null };
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(raw)) return inactive;
  const deadline = Date.parse(raw);
  const canonical = raw.length === 20 ? `${raw.slice(0, -1)}.000Z` : raw;
  if (!Number.isFinite(deadline) || new Date(deadline).toISOString() !== canonical) return inactive;
  const remaining = deadline - Date.now();
  return { active: remaining > 0 && remaining <= 86_400_000, until: canonical };
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
    quotaPause: quotaPause(),
    dailyLimit: limit("ZARVIS_DAILY_REQUEST_LIMIT", 100, 10_000),
    hourlyLimit: limit("ZARVIS_HOURLY_REQUEST_LIMIT", 30, 1_000),
  };
}
