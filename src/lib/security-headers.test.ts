import { afterEach, describe, expect, it, vi } from "vitest";
import { chatCsp } from "./private-chat/csp";
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
describe("scoped Content Security Policy", () => {
  it.each(["development", "production", "test", "staging", "", undefined])(
    "does not expand the rest of the portal (NODE_ENV=%s)", async (mode) => {
      vi.stubEnv("NODE_ENV", mode);
      vi.stubEnv("NEXT_PUBLIC_PRIVATE_CHAT_PREVIEW", "true");
      vi.resetModules();
      const config = (await import("../../next.config")).default;
      const headers = (await config.headers!()).find((r) => r.source === "/:path*")!.headers;
      const csp = headers.find((h) => h.key === "Content-Security-Policy")!.value;
      expect(csp).toContain("connect-src 'self' blob:");
      expect(csp).not.toContain("wss:");
      expect(csp).not.toContain("validator.nymtech.net");
      expect(csp).not.toContain("wasm-unsafe-eval");
      expect(csp.includes("'unsafe-eval'")).toBe(mode === "development");
      expect(headers).toContainEqual({ key: "X-Frame-Options", value: "DENY" });
  });
  it("allows Nym only on its worker and nonce-protected document", async () => {
    const dev = { NODE_ENV: "development", NEXT_PUBLIC_PRIVATE_CHAT_PREVIEW: "true" };
    expect(chatCsp(dev)).toContain("https://validator.nymtech.net wss:");
    const prod = { NODE_ENV: "production", PRIVATE_CHAT_DEPLOYMENT: "pilot",
      NEXT_PUBLIC_PRIVATE_CHAT_PILOT: "true",
      NEXT_PUBLIC_PRIVATE_CHAT_GATEWAY_ORIGIN: "wss://pinned.example:9001" };
    const csp = chatCsp(prod, "test-nonce");
    expect(csp).toContain("'nonce-test-nonce' 'strict-dynamic'");
    expect(csp).toContain("'wasm-unsafe-eval'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("wss://pinned.example:9001");
    expect(csp).not.toMatch(/wss:(?:;| )/);
    expect(csp).toContain("form-action 'none'");
    expect(chatCsp({ NODE_ENV: "production", NEXT_PUBLIC_PRIVATE_CHAT_PREVIEW: "true" }))
      .not.toContain("validator.nymtech.net");
  });
});
