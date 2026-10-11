import { readDecisionHistory } from "@/lib/participate/decision-history";

export const dynamic = "force-dynamic";

/** Public source records only. Accounts, ballots and drafts stay in the participation service. */
export async function GET() {
  try {
    const rows = await readDecisionHistory();
    return Response.json({ version: 1, rows }, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=60" },
    });
  } catch {
    return Response.json({ error: "HISTORY_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
