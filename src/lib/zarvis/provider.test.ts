import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const constructor = vi.hoisted(() => vi.fn());
vi.mock("openai", async (original) => ({ ...await original<object>(), default: class { constructor(options: unknown) { constructor(options); } } }));
import { zarvisConfig } from "./config";
import { GROK_SEARCH_DOMAINS, providerClient, providerOptions, providerSearchTool } from "./provider";
import { SEARCH_DOMAINS } from "./sources";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("Explicit provider configuration", () => {
  it("uses the xAI key only with its fixed host, and limits search to five domains", () => {
    vi.stubEnv("ZARVIS_PROVIDER", "xai"); vi.stubEnv("XAI_API_KEY", "xai-test"); vi.stubEnv("OPENAI_API_KEY", "openai-test"); vi.stubEnv("ZARVIS_MODEL", "");
    vi.stubEnv("OPENAI_BASE_URL", "https://untrusted.example");
    const config = zarvisConfig(); providerClient(config);
    expect(config.model).toBe("grok-4.7"); expect(config.providerLabel).toBe("xAI (Grok)");
    expect(constructor).toHaveBeenCalledWith(expect.objectContaining({ baseURL: "https://api.x.ai/v1", apiKey: "xai-test", maxRetries: 0 }));
    expect(providerSearchTool(config)).toMatchObject({ filters: { allowed_domains: expect.any(Array) } });
    expect(JSON.stringify(providerOptions(config))).not.toContain("verbosity");
    expect(providerOptions(config)).toMatchObject({ max_turns: 2 });
    expect(providerOptions({ ...config, model: "grok-4.3" })).toMatchObject({ include: ["reasoning.encrypted_content"], reasoning: { effort: "low" } });
    expect(providerOptions(config)).not.toHaveProperty("max_tool_calls");
    expect((providerSearchTool(config) as { filters: { allowed_domains: string[] } }).filters.allowed_domains).toHaveLength(5);
  });
  it.each(["xai", "openai"])("narrows ZIP research to the official catalog for %s", (provider) => {
    vi.stubEnv("ZARVIS_PROVIDER", provider);
    expect(providerSearchTool(zarvisConfig(), "zip")).toMatchObject({ filters: { allowed_domains: ["zips.z.cash"] } });
  });
  it.each(["xai", "openai"])("uses mining and biography sources within five domains for %s", (provider) => {
    vi.stubEnv("ZARVIS_PROVIDER", provider);
    const config = zarvisConfig();
    const mining = providerSearchTool(config, "mining") as { filters: { allowed_domains: string[] } };
    expect(mining.filters.allowed_domains).toContain("zcashinfo.com");
    expect(mining.filters.allowed_domains).toContain("zecstats.com");
    expect(mining.filters.allowed_domains.length).toBeLessThanOrEqual(5);
    expect(providerSearchTool(config, "history")).toMatchObject({ filters: { allowed_domains: expect.arrayContaining(["openzcash.org", "shieldedlabs.net"]) } });
  });
  it("chooses five Grok domains by topic and keeps OpenZcash, ZecHub and ZcashInfo reachable", () => {
    vi.stubEnv("ZARVIS_PROVIDER", "xai");
    const config = zarvisConfig();
    const domains = (scope: Parameters<typeof providerSearchTool>[1]) => (providerSearchTool(config, scope) as { filters: { allowed_domains: string[] } }).filters.allowed_domains;
    for (const scope of Object.keys(GROK_SEARCH_DOMAINS) as Array<keyof typeof GROK_SEARCH_DOMAINS>) {
      expect(domains(scope)).toHaveLength(5); expect(new Set(domains(scope)).size).toBe(5);
      for (const domain of domains(scope)) expect(SEARCH_DOMAINS).toContain(domain);
    }
    expect(domains("general")).toEqual(expect.arrayContaining(["openzcash.org", "zechub.wiki", "z.cash", "zips.z.cash", "forum.zcashcommunity.com"]));
    expect(domains("governance")).toEqual(expect.arrayContaining(["openzcash.org", "forum.zcashcommunity.com", "zfnd.org", "electriccoin.co"]));
    expect(domains("news")).toEqual(expect.arrayContaining(["zodl.com", "zakura.com", "shieldedlabs.net", "zcashlabs.org", "zfnd.org"]));
    expect(domains("mining")).toContain("zcashinfo.com");
    vi.stubEnv("ZARVIS_PROVIDER", "openai");
    expect((providerSearchTool(zarvisConfig(), "governance") as { filters: { allowed_domains: string[] } }).filters.allowed_domains).toEqual(SEARCH_DOMAINS);
  });
  it("does not silently switch providers or reuse the OpenAI key when a Grok key is absent", () => {
    vi.stubEnv("ZARVIS_PROVIDER", "xai"); vi.stubEnv("XAI_API_KEY", ""); vi.stubEnv("OPENAI_API_KEY", "openai-test");
    vi.stubEnv("ZARVIS_ENABLED", "true"); vi.stubEnv("DATABASE_URL", "test");
    const config = zarvisConfig(); expect(config.enabled).toBe(false);
    expect(() => providerClient(config)).toThrow("PROVIDER_NOT_CONFIGURED");
    expect(constructor).not.toHaveBeenCalled();
  });
  it("retains the selected OpenAI model and disables unknown provider configurations", () => {
    vi.stubEnv("ZARVIS_PROVIDER", "openai"); vi.stubEnv("ZARVIS_MODEL", "gpt-6-astra"); vi.stubEnv("OPENAI_API_KEY", "test");
    const config = zarvisConfig(); providerClient(config);
    expect(config.model).toBe("gpt-6-astra");
    expect(constructor).toHaveBeenCalledWith(expect.objectContaining({ baseURL: "https://api.openai.com/v1", apiKey: "test" }));
    vi.stubEnv("ZARVIS_PROVIDER", "unknown"); vi.stubEnv("ZARVIS_ENABLED", "true"); vi.stubEnv("DATABASE_URL", "test");
    expect(zarvisConfig().enabled).toBe(false);
  });
});
