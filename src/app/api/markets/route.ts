import { getMarketDashboard } from "@/lib/markets/sources";

export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(await getMarketDashboard({ waitForRefresh: true }), {
    headers: { "Cache-Control": "no-store" },
  });
}
