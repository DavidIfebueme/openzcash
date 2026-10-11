import { NextResponse, type NextRequest } from "next/server";

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

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // This also rejects old signed sessions and previously issued invite links.
  if (isRetiredPath(pathname)) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const headers = new Headers(req.headers);
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
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
