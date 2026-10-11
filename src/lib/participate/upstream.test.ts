import { describe, expect, it } from "vitest";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { participationRewrites, participationUpstream } from "./upstream";

describe("same-origin Participate routing", () => {
  it.each(["http://127.0.0.1:4411", "http://participate.railway.internal:3000", "https://private-service.example"])("accepts a configured server origin: %s", origin => {
    expect(participationUpstream(origin)).toBe(origin);
  });
  it.each([undefined, "", "javascript:alert(1)", "http://public.example", "https://user:secret@service.example", "https://service.example/?token=x", "https://service.example/#x", "https://service.example/participate", "https://*.example", "https://openzcash.org", "https://www.openzcash.org"])("rejects invalid endpoints and proxy loops: %s", origin => {
    expect(participationUpstream(origin)).toBeNull();
    expect(participationRewrites(origin)).toEqual([]);
  });
  const rules = participationRewrites("http://participate.railway.internal:3000");
  const matches = (path: string) => rules.filter(rule => getPathMatch(rule.source)(path));
  it.each([
    "/participate", "/participate/committee", "/_participate-assets/_next/static/chunks/app.js", "/_participate-assets/_next/image",
    "/api/auth/email/request", "/api/auth/email/verify", "/api/auth/logout", "/api/account/settings", "/api/account/notifications",
    "/api/account/credits", "/api/account/credits/preview", "/api/account/passkeys/verify",
    "/api/participate/proposals", "/api/participate/admin-access", "/api/participate/moderation-access",
    "/api/communities/preview_orchard/archives", "/api/communities/preview_orchard/archives/record/comments/comment/reaction",
    "/api/communities/preview_orchard/archives/record/download", "/fonts/openzcash-inter-latin.woff2", "/images/zcg/hanh.png",
    "/verify/archive-verify.mjs",
  ])("routes pilot navigation, account actions and recovery: %s", path => {
    expect(matches(path)).toHaveLength(1);
    expect(matches(path)[0].destination).not.toContain("(");
  });
  it.each([
    "/zcg/participate", "/api/participate/history", "/_next/static/chunks/app.js", "/api/zcg/data/grants",
    "/admin", "/communities/preview_orchard", "/api/admin/polls", "/api/auth/login", "/api/auth/signup", "/api/auth/demo",
    "/api/internal/reconcile", "/api/account/credits/purchases", "/api/communities/preview_orchard/treasury",
    "/api/participate/unknown", "/fonts/secret.txt", "/brand/private.txt", "/verify/coinholder_verify.py",
  ])("preserves portal routes and does not publish unrelated backend surfaces: %s", path => {
    expect(matches(path)).toHaveLength(0);
  });
});
