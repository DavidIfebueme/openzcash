import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("Content Security Policy environment gate", () => {
  it.each(["development", "production", "test", "staging", "", undefined])(
    "allows unsafe-eval only for explicit development (NODE_ENV=%s)",
    async (mode) => {
      vi.stubEnv("NODE_ENV", mode);
      vi.resetModules();
      const { default: config } = await import("../../next.config");
      const rules = await config.headers!();
      const headers = rules.find((rule) => rule.source === "/((?!private-chat$).*)")!.headers;
      const csp = headers.find((header) => header.key === "Content-Security-Policy")!.value;
      const script = csp.split("; ").find((directive) => directive.startsWith("script-src "));
      expect(script).toBe(mode === "development"
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'");
      expect(csp).toContain("object-src 'none'");
      expect(headers).toContainEqual({ key: "X-Frame-Options", value: "DENY" });
      expect(headers).toContainEqual({ key: "X-Content-Type-Options", value: "nosniff" });
    },
  );
});
