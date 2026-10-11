/** Server configuration only. This origin is never passed to the browser. */
export function participationUpstream(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw);
    const privateHost = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      || /^[a-z0-9-]+\.railway\.internal$/.test(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || url.hostname.includes("*")) return null;
    if (url.protocol !== "https:" && !(url.protocol === "http:" && privateHost)) return null;
    if (["openzcash.org", "www.openzcash.org"].includes(url.hostname)) return null; // Reject a proxy loop.
    return url.origin;
  } catch { return null; }
}

// Only the public pilot surface crosses the proxy. The DAO, legacy passwords,
// internal reconcilers and administrative APIs are not mounted in OpenZcash.
export const participationRoutes = [
  "/participate", "/participate/committee",
  "/_participate-assets/_next/:path+",
  "/api/auth/email/:action(request|verify|options)",
  "/api/auth/:action(logout|session)",
  "/api/auth/passkeys/:action(options|verify)",
  "/api/account/:action(settings|notifications|email-code)",
  "/api/account/credits", "/api/account/credits/preview",
  "/api/account/passkeys", "/api/account/passkeys/:id",
  "/api/participate/:action(proposals|admin-access|moderation-access|committee|zec-price)",
  "/api/communities/:communityId/archives/:path*",
  "/fonts/:file(openzcash-inter-latin\\.woff2|openzcash-geist-mono-latin\\.woff2)",
  "/brand/:file(zcash-secondary-yellow\\.svg|zcash-currency-mark\\.png)",
  "/images/zcg/:file",
  "/verify/:file(archive-verify\\.mjs|activity-verify\\.mjs|decision-verify\\.mjs|ZOD-LICENSE\\.txt)",
] as const;

export function participationRewrites(raw: string | undefined) {
  const origin = participationUpstream(raw);
  return origin ? participationRoutes.map(source => ({ source, destination: `${origin}${source.replace(/(:\w+)\([^)]*\)/g, "$1")}` })) : [];
}
