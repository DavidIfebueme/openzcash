import type { NextConfig } from "next";
import monthlyReadingSets from "./src/lib/monthly/reading-sets.json";
import { participationRewrites } from "./src/lib/participate/upstream";

// Content Security Policy. The app loads no third-party browser assets — fonts
// are self-hosted (next/font), the logo/favicon are same-origin, and the client
// only talks to same-origin /api/*. External calls (CoinGecko, lightwalletd,
// scanner, Google Sheets) are all server-side. So 'self' is sufficient;
// 'unsafe-inline' covers Next's hydration/bootstrap inline scripts and
// Tailwind's inline styles. No 'unsafe-eval'.
// One development-only exception: React's development runtime calls eval() for
// debugging features, and without 'unsafe-eval' the dev overlay reports a CSP
// violation on every page. Only explicit development enables it; every other
// environment keeps the strict default.
// 'blob:' is required by the 3D office (/zcg/office): three.js loads GLB-embedded
// textures via URL.createObjectURL (blob: URLs) and, when createImageBitmap is
// available, FETCHES that blob URL — so blob: must be allowed on both img-src
// (the <img> fallback) and connect-src (the fetch/ImageBitmap path).
const scriptSrc = process.env.NODE_ENV === "development"
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";
const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  // i.ytimg.com: recording thumbnails on /arborist (YouTube's public CDN).
  "img-src 'self' data: blob: https://i.ytimg.com",
  // archive.org: the Zcash Ceremony recordings stream from the Internet
  // Archive (download URLs redirect to its *.us.archive.org data nodes).
  "media-src 'self' https://archive.org https://*.archive.org",
  // YouTube's privacy-enhanced player, loaded only when a visitor clicks a film.
  "frame-src https://www.youtube-nocookie.com",
  "font-src 'self'",
  "connect-src 'self' blob:",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The microphone is allowed for this origin only: Zarvis dictation records after a tap, and no embedded frame can ask for it.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(), browsing-topics=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework/version in responses.
  poweredByHeader: false,
  async rewrites() {
    return participationRewrites(process.env.PARTICIPATE_UPSTREAM_URL);
  },
  // The home is the ZCG overview. A server redirect answers before any
  // rendering (the page-level redirect would stream behind loading.tsx).
  async redirects() {
    return [
      { source: "/", destination: "/zcg", permanent: false },
      { source: "/cex-zec-dex", destination: "/zec-observatory", permanent: true },
      { source: "/decisions", destination: "/zcg/participate?view=history", permanent: true },
      { source: "/zcg/decisions", destination: "/zcg/participate?view=history", permanent: true },
      // The pilot's former embedded workspace paths land on the native screens.
      { source: "/participate", destination: "/zcg/participate", permanent: true },
      { source: "/participate/committee", destination: "/zcg/participate", permanent: true },
      { source: "/treasury-calculator", destination: "/zcg/treasury-calculator", permanent: true },
      { source: "/zcash10years", destination: "/ceremony/ten-years", permanent: true },
      // The coinholder program has its own home above ZCG; old links keep working.
      { source: "/zcg/coinholder", destination: "/coinholders", permanent: true },
      { source: "/zcg/coinholder/votes", destination: "/coinholders/results?round=all", permanent: true },
      { source: "/coinholders/votes", destination: "/coinholders/results?round=all", permanent: true },
      // The collection keeps a permanent name; old round bookmarks still resolve.
      { source: "/coinholders/q4-2026", destination: "/coinholders/proposals", permanent: true },
      { source: "/coinholders/q4-2026/:number", destination: "/coinholders/proposals/:number", permanent: true },
      // Only completed historical routes belong on Results.
      ...["q3-2026", "q2-2026", "q1-2026", "q4-2025", "ratification-2025"].map((round) => ({
        source: `/coinholders/${round}`, destination: `/coinholders/results?round=${round}`, permanent: true,
      })),
      { source: "/zcg/coinholder/pool", destination: "/coinholders/fund", permanent: true },
      { source: "/coinholder", destination: "/coinholders", permanent: true },
      // Retired standalone pages keep existing bookmarks pointing to their records.
      { source: "/wallets", destination: "/wallets/find", permanent: true },
      { source: "/z3", destination: "/ecosystem/history/z3", permanent: true },
      { source: "/defi", destination: "/zec-observatory#liquidity", permanent: true },
      { source: "/zcg/maya", destination: "/zec-observatory#liquidity", permanent: true },
      // The former mixed August-close link resolves to the corrected August
      // set until a September reading set takes the id. Temporary, so no
      // browser keeps it once that edition exists.
      ...(monthlyReadingSets.some((set) => set.id === "2026-09")
        ? []
        : [
            {
              source: "/monthly/2026-09",
              destination: "/monthly/2026-08",
              permanent: false,
            },
          ]),
    ];
  },
  async headers() {
    return [
      // The dedicated chat document supplies its own nonce and isolated policy.
      { source: "/((?!private-chat$).*)", headers: securityHeaders },
      ...["agent-skills", "skills"].map((directory) => ({
        source: `/.well-known/${directory}/:path*`,
        headers: [{ key: "Cache-Control", value: "public, max-age=300" }],
      })),
      // The coinholder recount script: readable in the browser before anyone runs it.
      {
        source: "/verify/:file*.py",
        headers: [
          { key: "Content-Type", value: "text/plain; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
      // Monthly files are content-addressed. Corrections get a new directory.
      {
        source: "/monthly/editions/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/monthly/pdfjs/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      // Heavy 3D assets (GLB models, graffiti textures) never change in place —
      // a new model gets a new filename. Without this, Next serves public/
      // files with max-age=0 and every office visitor re-downloads ~6MB.
      {
        source: "/office-assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/committee/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800" }, // 7 days
        ],
      },
      {
        source: "/community-logos/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
      {
        source: "/logos/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
      {
        source: "/wallet-logos/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
      {
        source: "/zcash-emblem.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
      {
        source: "/zbo-emblem.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
    ];
  },
};

export default nextConfig;
