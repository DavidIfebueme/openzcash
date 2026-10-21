import { chatEnabled } from "@/lib/private-chat/deployment";
import { readNetworkHealth } from "@/lib/private-chat/network-health-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const headers = {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  };
  if (!chatEnabled()) return new Response("Not Found", { status: 404, headers });
  // No aliases, invitation tokens, custom upstreams or visitor identifiers are accepted.
  if (new URL(request.url).search) return new Response("Bad Request", { status: 400, headers });
  return Response.json(await readNetworkHealth(process.env.NEXT_PUBLIC_PRIVATE_CHAT_GATEWAY_ID), { headers });
}
