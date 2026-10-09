import { readCoinholderDashboard } from "@/lib/coinholder/analytics/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Public, verified Q3 history. Polling refreshes source checks, not archived timestamps. */
export async function GET(request: Request) {
  try {
    const dashboard = await readCoinholderDashboard();
    const headers = { "Cache-Control": "public, max-age=60, stale-while-revalidate=60" };
    if (new URL(request.url).searchParams.get("history") === "omit") {
      const { activity, revealHistory, ...refresh } = dashboard;
      void activity;
      void revealHistory;
      return Response.json({ ...refresh, activityOmitted: true }, { headers });
    }
    return Response.json(dashboard, { headers });
  } catch {
    return Response.json({ error: "COINHOLDER_READ_FAILED" }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
