import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("Participate integration headers and redirects", () => {
  it("allows a same-origin workspace only on Participate and retains the other protections", async () => {
    vi.stubEnv("PARTICIPATE_UPSTREAM_URL", "http://participate.railway.internal:3000");
    const { default: config } = await import("../../../next.config");
    const headers = await config.headers!();
    const general = headers.find(row => row.source === "/:path*")!;
    const route = headers.find(row => row.source === "/zcg/participate")!;
    expect(general.headers.find(header => header.key === "Content-Security-Policy")!.value).not.toContain("frame-src 'self'");
    const policy = route.headers.find(header => header.key === "Content-Security-Policy")!.value;
    expect(policy).toContain("frame-src 'self' https://www.youtube-nocookie.com");
    expect(policy).not.toContain("railway.internal");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    for (const source of ["/participate", "/participate/committee"]) {
      const workspace = headers.find(row => row.source === source)!;
      expect(workspace.headers).toContainEqual({ key: "X-Frame-Options", value: "SAMEORIGIN" });
      expect(workspace.headers.find(header => header.key === "Content-Security-Policy")!.value).toContain("frame-ancestors 'self'");
    }
    const redirects = await config.redirects!();
    for (const source of ["/decisions", "/zcg/decisions"]) expect(redirects).toContainEqual({ source, destination: "/zcg/participate?view=history", permanent: true });
  });
  it("keeps the default policy if no valid service is configured", async () => {
    vi.stubEnv("PARTICIPATE_UPSTREAM_URL", "https://*.openzcash.org/participate");
    const { default: config } = await import("../../../next.config");
    expect((await config.headers!()).some(row => row.source === "/zcg/participate")).toBe(false);
  });
});
