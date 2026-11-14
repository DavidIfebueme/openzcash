import { readTreasuryFeed } from "@/lib/openzcash-treasury/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public snapshot only. A request never imports a key or starts a scan. */
export async function GET() {
  return Response.json(await readTreasuryFeed(), { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
