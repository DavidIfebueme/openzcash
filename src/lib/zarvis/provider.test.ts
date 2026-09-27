import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const constructor = vi.hoisted(() => vi.fn());
vi.mock("openai", () => ({ default: class { constructor(options: unknown) { constructor(options); } } }));
import { zarvisConfig } from "./config";
import { providerClient, providerOptions, providerSearchTool } from "./provider";
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
    expect(providerOptions(config)).not.toHaveProperty("max_tool_calls");
    expect((providerSearchTool(config) as { filters: { allowed_domains: string[] } }).filters.allowed_domains).toHaveLength(5);
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
