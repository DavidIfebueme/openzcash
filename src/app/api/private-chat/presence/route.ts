import { PRIVATE_CHAT_PREVIEW_ENABLED } from "@/lib/private-chat/config";
// Retired: Discover is reachable only through Nym. Never proxy this route.
export function POST() {
  return new Response(null, {
    status: PRIVATE_CHAT_PREVIEW_ENABLED ? 410 : 404,
    headers: { "Cache-Control": "no-store" },
  });
}
export const GET = POST;
