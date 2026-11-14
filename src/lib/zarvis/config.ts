import "server-only";
import { dailyUsdCap } from "./pricing";
import type { ProviderLabel } from "./types";
export type Provider = "openai" | "xai" | "anthropic";
/** Everything a transport needs; the primary and the optional fallback share this shape. */
export type ProviderConfig = { provider: Provider; apiKey: string; model: string; providerLabel: ProviderLabel; webSearch: boolean };
const PROVIDERS: Record<Provider, { key: string; model: string; label: ProviderLabel }> = {
  openai: { key: "OPENAI_API_KEY", model: "gpt-5-mini", label: "OpenAI" },
  xai: { key: "XAI_API_KEY", model: "grok-4.7", label: "xAI (Grok)" },
  anthropic: { key: "ANTHROPIC_API_KEY", model: "claude-sonnet-5-5", label: "Anthropic (Claude)" },
};
const isProvider = (value: string): value is Provider => Object.hasOwn(PROVIDERS, value);
/** Each provider reads only its own key; nothing is borrowed from another provider's variable. */
function providerConfig(provider: Provider, model: string | undefined, webSearch: boolean): ProviderConfig {
  const spec = PROVIDERS[provider];
  return { provider, apiKey: process.env[spec.key]?.trim() ?? "", model: model?.trim() || spec.model, providerLabel: spec.label, webSearch };
}
/** The Responses provider that answers when the primary fails its first model call (ZARVIS_FALLBACK_PROVIDER xai | openai): needs its own key and must differ from the primary. */
function fallbackConfig(primary: Provider, webSearch: boolean): ProviderConfig | null {
  const requested = process.env.ZARVIS_FALLBACK_PROVIDER?.trim() ?? "";
  if (!isProvider(requested) || requested === "anthropic" || requested === primary) return null;
  const config = providerConfig(requested, process.env.ZARVIS_FALLBACK_MODEL, webSearch);
  return config.apiKey ? config : null;
}
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
  const validProvider = isProvider(requestedProvider);
  const provider: Provider = validProvider ? requestedProvider : "openai";
  const webSearch = process.env.ZARVIS_WEB_SEARCH !== "false";
  const primary = providerConfig(provider, process.env.ZARVIS_MODEL, webSearch);
  const hmacSecret =
    process.env.ZARVIS_HMAC_SECRET?.trim() || primary.apiKey;
  if (hmacSecret === primary.apiKey && process.env.NODE_ENV === "production") {
    console.warn(
      "ZARVIS_HMAC_SECRET is unset; falling back to the provider API key for HMAC. Set a dedicated secret in production.",
    );
  }
  return {
    ...primary,
    // Keys abuse counters and feedback tickets. A dedicated secret keeps the provider key out of HMAC inputs; the key remains the fallback so nothing breaks unset, with a one-time warning in production.
    hmacSecret,
    enabled: process.env.ZARVIS_ENABLED === "true" && Boolean(validProvider && primary.apiKey && process.env.DATABASE_URL),
    fallback: fallbackConfig(provider, webSearch),
    unlimitedLocalTesting: unlimitedLocalTesting(),
    quotaPause: quotaPause(),
    dailyLimit: limit("ZARVIS_DAILY_REQUEST_LIMIT", 100, 10_000),
    hourlyLimit: limit("ZARVIS_HOURLY_REQUEST_LIMIT", 30, 1_000),
    // Per-network abuse counters; phones behind one carrier address share them.
    networkDailyLimit: limit("ZARVIS_NETWORK_DAILY_LIMIT", 20, 10_000),
    networkWindowLimit: limit("ZARVIS_NETWORK_WINDOW_LIMIT", 5, 1_000),
    // Application-level estimated-spend ceiling per UTC day; applies during a quota pause too.
    dailyUsdCap: dailyUsdCap(),
    canaryModel: process.env.ZARVIS_CANARY_MODEL === "true",
  };
}
