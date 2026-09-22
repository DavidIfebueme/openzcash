import { getMarketDashboard } from "@/lib/markets/sources";

export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(await getMarketDashboard(), {
    headers: { "Cache-Control": "no-store" },
  });
}
