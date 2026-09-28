import { getIsAdmin } from "@/lib/auth/admin";
import { zarvisConfig } from "@/lib/zarvis/config";
import { metricsSnapshot } from "@/lib/zarvis/metrics";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!await getIsAdmin()) return new Response(null, { status: 403 });
  const config = zarvisConfig();
  return Response.json({
    ...metricsSnapshot(),
    quota: {
      paused: config.quotaPause.active,
      resumesAt: config.quotaPause.until,
      dailyLimit: config.dailyLimit,
      hourlyLimit: config.hourlyLimit,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
