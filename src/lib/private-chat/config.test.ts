import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("private chat preview boundary", () => {
  it.each([
    { environment: "production", flag: "true", enabled: false },
    { environment: "production", flag: undefined, enabled: false },
    { environment: "development", flag: undefined, enabled: false },
    { environment: "development", flag: "false", enabled: false },
    { environment: "development", flag: "1", enabled: false },
    { environment: "development", flag: "true", enabled: true },
    { environment: "test", flag: "true", enabled: false },
  ])(
    "$environment with flag $flag exposes preview: $enabled",
    async ({ environment, flag, enabled }) => {
      vi.stubEnv("NODE_ENV", environment);
      vi.stubEnv("NEXT_PUBLIC_PRIVATE_CHAT_PREVIEW", flag);
      vi.resetModules();

      const { PRIVATE_CHAT_PREVIEW_ENABLED } = await import("./config");

      expect(PRIVATE_CHAT_PREVIEW_ENABLED).toBe(enabled);
    },
  );
});
