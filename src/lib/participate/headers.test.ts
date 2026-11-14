import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Participate headers and redirects", () => {
  it("never opens the frame policy: the native screens need no embedded workspace", async () => {
    vi.stubEnv(
      "PARTICIPATE_UPSTREAM_URL",
      "http://upstream.railway.internal:3000",
    );
    const { default: config } = await import("../../../next.config");
    const headers = await config.headers!();
    const general = headers.find((row) => row.source === "/((?!private-chat$).*)")!;
    const policy = general.headers.find(
      (header) => header.key === "Content-Security-Policy",
    )!.value;
    expect(policy).toContain("frame-src https://www.youtube-nocookie.com");
    expect(policy).not.toContain("frame-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain("railway.internal");
    expect(
      headers.some((row) =>
        ["/zcg/participate", "/participate", "/participate/committee"].includes(
          String(row.source),
        ),
      ),
    ).toBe(false);
  });
  it("redirects the former embedded workspace and decisions paths to the native screen", async () => {
    vi.stubEnv(
      "PARTICIPATE_UPSTREAM_URL",
      "http://upstream.railway.internal:3000",
    );
    const { default: config } = await import("../../../next.config");
    const redirects = await config.redirects!();
    for (const source of ["/decisions", "/zcg/decisions"])
      expect(redirects).toContainEqual({
        source,
        destination: "/zcg/participate?view=history",
        permanent: true,
      });
    for (const source of ["/participate", "/participate/committee"])
      expect(redirects).toContainEqual({
        source,
        destination: "/zcg/participate",
        permanent: true,
      });
  });
  it("only forwards the pilot API routes when a valid service is configured", async () => {
    vi.stubEnv(
      "PARTICIPATE_UPSTREAM_URL",
      "https://*.openzcash.org/participate",
    );
    const { default: config } = await import("../../../next.config");
    expect(await config.rewrites!()).toEqual([]);
  });
});
