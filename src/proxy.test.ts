import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isRetiredPath, proxy } from "./proxy";

const retired = [
  "/admin",
  "/login",
  "/onboarding?token=old-invite",
  "/viewing-keys",
  "/projects",
  "/invites",
  "/api/login",
  "/api/logout",
  "/api/health",
  "/api/onboarding",
  "/api/onboarding/invites",
  "/api/overrides",
  "/api/projects",
  "/api/scan",
  "/api/treasuries",
  "/api/zcg/proposals",
  "/api/zcg/disbursements",
  "/api/zcg/meetings",
  "/api/zcg/elections",
  "/api/zcg/links",
  "/api/zarvis/metrics",
];

describe("retired admin routes", () => {
  it.each(retired)("returns 404 despite a forged session cookie: %s", async (path) => {
    const request = new NextRequest(new URL(path, "https://openzcash.org"), {
      headers: { cookie: "zec_session=1.2" },
    });
    const response = proxy(request);
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("keeps public routes and removes a forged admin header", () => {
    for (const path of ["/api", "/api/zcg/data/grants", "/zcg", "/zarvis"]) {
      const response = proxy(new NextRequest(`https://openzcash.org${path}`, {
        headers: { "x-admin": "1" },
      }));
      expect(isRetiredPath(path)).toBe(false);
      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-request-x-admin")).toBe("0");
    }
    expect(isRetiredPath("/api/zcg/proposals-public")).toBe(false);
  });

  it("replaces untrusted forwarding headers before the internal Participate rewrite", () => {
    const response = proxy(new NextRequest("https://openzcash.org/api/account/settings", { headers: {
      origin: "https://attacker.example", "x-forwarded-host": "attacker.example", "x-forwarded-proto": "http", "x-forwarded-port": "80",
    } }));
    expect(response.headers.get("x-middleware-request-x-forwarded-host")).toBe("openzcash.org");
    expect(response.headers.get("x-middleware-request-x-forwarded-proto")).toBe("https");
    expect(response.headers.get("x-middleware-request-x-forwarded-port")).toBeNull();
    expect(response.headers.get("x-middleware-request-origin")).toBe("https://attacker.example");
  });
});

describe("committee demo host", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("serves only Participate and never asks to be indexed", () => {
    vi.stubEnv("PARTICIPATE_DEMO_ENVIRONMENT", "true");
    for (const path of ["/", "/zcg", "/zarvis", "/zcg/participate/zcg-github-478", "/api/zarvis/chat", "/coinholders"]) {
      const response = proxy(new NextRequest(`https://demo.openzcash.org${path}`));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://demo.openzcash.org/zcg/participate?view=practice");
      expect(response.headers.get("x-robots-tag")).toContain("noindex");
    }
    for (const path of ["/zcg/participate", "/api", "/api/participate/demo", "/api/participate/sheet-handoff", "/api/auth/session", "/api/communities/host/archives/participation", "/brand/zcash-secondary-yellow.svg"]) {
      const response = proxy(new NextRequest(`https://demo.openzcash.org${path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("x-robots-tag")).toContain("noindex");
    }
  });

  it("leaves production routing unchanged without the demo flag", () => {
    const response = proxy(new NextRequest("https://openzcash.org/zarvis"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });
});
