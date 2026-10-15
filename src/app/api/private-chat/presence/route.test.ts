import { afterEach, describe, expect, it, vi } from "vitest";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
describe("retired direct Discover endpoint", () => {
  it.each(["development", "production"])(
    "cannot read or publish presence in %s",
    async (mode) => {
      vi.stubEnv("NODE_ENV", mode);
      vi.stubEnv("NEXT_PUBLIC_PRIVATE_CHAT_PREVIEW", "true");
      vi.resetModules();
      const { POST, GET } = await import("./route");
      for (const method of [POST, GET]) {
        const response = method();
        expect(response.status).toBe(mode === "production" ? 404 : 410);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.text()).toBe("");
      }
    },
  );
});
