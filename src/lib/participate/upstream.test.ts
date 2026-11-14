import { describe, expect, it } from "vitest";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { participationRewrites, participationUpstream } from "./upstream";

describe("same-origin Participate API routing", () => {
  it.each([
    "http://127.0.0.1:4411",
    "http://upstream.railway.internal:3000",
    "https://private-service.example",
  ])("accepts a configured server origin: %s", (origin) => {
    expect(participationUpstream(origin)).toBe(origin);
  });
  it.each([
    undefined,
    "",
    "javascript:alert(1)",
    "http://public.example",
    "https://user:secret@service.example",
    "https://service.example/?token=x",
    "https://service.example/#x",
    "https://service.example/participate",
    "https://*.example",
    "https://openzcash.org",
    "https://www.openzcash.org",
  ])("rejects invalid endpoints and proxy loops: %s", (origin) => {
    expect(participationUpstream(origin)).toBeNull();
    expect(participationRewrites(origin)).toEqual([]);
  });
  const rules = participationRewrites(
    "http://upstream.railway.internal:3000",
  );
  const matches = (path: string) =>
    rules.filter((rule) => getPathMatch(rule.source)(path));
  it.each([
    "/api/auth/email/request",
    "/api/auth/email/verify",
    "/api/auth/email/options",
    "/api/auth/passkeys/options",
    "/api/auth/passkeys/verify",
    "/api/auth/logout",
    "/api/auth/session",
    "/api/account/settings",
    "/api/account/notifications",
    "/api/account/credits",
    "/api/account/credits/preview",
    "/api/account/passkeys/verify",
    "/api/account/passkeys",
    "/api/account/passkeys/key-id",
    "/api/account/email-code",
    "/api/participate/proposals",
    "/api/participate/admin-access",
    "/api/participate/moderation-access",
    "/api/communities/preview_orchard/archives/participation",
    "/api/communities/preview_orchard/archives/record/comments/comment/reaction",
    "/api/communities/preview_orchard/archives/record/revisions/1",
    "/verify/archive-verify.mjs",
  ])("forwards pilot APIs and recovery downloads: %s", (path) => {
    expect(matches(path)).toHaveLength(1);
    expect(matches(path)[0].destination).not.toContain("(");
  });
  it.each([
    "/participate",
    "/participate/committee",
    "/_participate-assets/_next/static/chunks/app.js",
    "/_participate-assets/_next/image",
    "/fonts/openzcash-inter-latin.woff2",
    "/brand/zcash-secondary-yellow.svg",
    "/images/zcg/hanh.png",
    "/zcg/participate",
    "/zcg/participate/zcg-github-478",
    "/api/participate/history",
    "/_next/static/chunks/app.js",
    "/api/zcg/data/grants",
    "/admin",
    "/communities/preview_orchard",
    "/api/admin/polls",
    "/api/auth/login",
    "/api/auth/signup",
    "/api/auth/demo",
    "/api/internal/reconcile",
    "/api/account/credits/purchases",
    "/api/communities/preview_orchard/treasury",
    "/api/participate/unknown",
    "/api/participate/demo",
    "/fonts/secret.txt",
    "/verify/coinholder_verify.py",
  ])(
    "keeps the service's own pages and assets off the public origin: %s",
    (path) => {
      expect(matches(path)).toHaveLength(0);
    },
  );
  it("mounts the committee demo actions only in a demo build", () => {
    const demo = participationRewrites(
      "http://upstream-demo.railway.internal:3000",
      { demo: true },
    );
    const demoMatches = demo.filter((rule) =>
      getPathMatch(rule.source)("/api/participate/demo"),
    );
    expect(demoMatches).toEqual([
      {
        source: "/api/participate/demo",
        destination:
          "http://upstream-demo.railway.internal:3000/api/participate/demo",
      },
    ]);
    expect(demo).toHaveLength(rules.length + 1);
    expect(
      rules.some((rule) => getPathMatch(rule.source)("/api/participate/demo")),
    ).toBe(false);
  });
});
