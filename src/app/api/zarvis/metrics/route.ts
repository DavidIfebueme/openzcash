import { getIsAdmin } from "@/lib/auth/admin";
import { metricsSnapshot } from "@/lib/zarvis/metrics";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!await getIsAdmin()) return new Response(null, { status: 403 });
  return Response.json(metricsSnapshot(), { headers: { "Cache-Control": "no-store" } });
}
