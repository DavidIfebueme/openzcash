import { NextResponse, type NextRequest } from "next/server";
import { chatCsp } from "@/lib/private-chat/csp";
import { chatEnabled, pilotDeployment } from "@/lib/private-chat/deployment";

/** The former admin, onboarding and viewing-key HTTP surface is retired. */
const RETIRED_PATHS = [
  "/admin",
  "/login",
  "/onboarding",
  "/viewing-keys",
  "/projects",
  "/invites",
  "/api/login",
  "/api/logout",
  "/api/health",
  "/api/onboarding",
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

export function isRetiredPath(pathname: string): boolean {
  return RETIRED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/** Next's local server reconstructs nextUrl with its internal listen host.
 * Match the public Host header instead; never trust x-forwarded-host here.
 * The TLS proxy must overwrite forwarding headers and keep the app port private.
 */
function matchesPilotOrigin(req: NextRequest, expectedOrigin: string | undefined): boolean {
  if (!expectedOrigin) return false;
  try {
    const host = req.headers.get("host") ?? req.nextUrl.host;
    const origin = new URL(`${req.nextUrl.protocol}//${host}`);
    return !origin.username && !origin.password && origin.pathname === "/" &&
      !origin.search && !origin.hash && origin.origin === expectedOrigin;
  } catch {
    return false;
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // This also rejects old signed sessions and previously issued invite links.
  if (isRetiredPath(pathname)) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const chatNamespace = pathname === "/private-chat" || pathname.startsWith("/private-chat/");
  const chatPath = pathname === "/private-chat";
  const pilot = pilotDeployment();
  // Railway probes use a dedicated Host. This exception exposes only readiness,
  // never chat content or other routes, and does not relax the canonical origin.
  if (pathname === "/healthz" && pilot &&
      (matchesPilotOrigin(req, pilot.origin) || req.headers.get("host") === "healthcheck.railway.app")) {
    return NextResponse.json({ ready: true }, { headers: { "Cache-Control": "no-store" } });
  }
  if (chatNamespace && (!chatPath || !chatEnabled() ||
      (process.env.NODE_ENV === "production" && !matchesPilotOrigin(req, pilot?.origin)))) {
    return new NextResponse("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  if ((pilot || process.env.PRIVATE_CHAT_ISOLATED === "true") &&
      (!pilot || !matchesPilotOrigin(req, pilot.origin) ||
       !(chatPath || pathname.startsWith("/_next/") ||
         pathname.startsWith("/private-chat-nym/") || pathname.startsWith("/logos/") ||
         pathname.startsWith("/icons/") || ["/favicon.ico", "/zcash-emblem.png", "/icon.png"].includes(pathname)))) {
    return new NextResponse("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const headers = new Headers(req.headers);
  headers.delete("x-nonce");
  headers.delete("Content-Security-Policy");
  const chatPolicy = chatPath
    ? chatCsp(process.env, Buffer.from(crypto.randomUUID()).toString("base64"), req.nextUrl.searchParams.get("embedded") === "1")
    : null;
  if (chatPolicy) headers.set("Content-Security-Policy", chatPolicy);
  headers.set("x-pathname", pathname);
  headers.set("x-admin", "0");
  // Backend origin checks must use the portal request, not client-supplied
  // forwarding headers. The Participate rewrite preserves Origin unchanged.
  headers.set("x-forwarded-host", req.nextUrl.host);
  headers.set("x-forwarded-proto", req.nextUrl.protocol.slice(0, -1));
  headers.delete("x-forwarded-port");
  const response = NextResponse.next({ request: { headers } });
  if (process.env.OPENZCASH_ENV === "redesign") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  if (chatPolicy) {
    response.headers.set("Content-Security-Policy", chatPolicy);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), browsing-topics=()");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
