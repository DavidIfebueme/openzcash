import { readApprovedBudgets } from "@/lib/participate/approved-budgets";

export const dynamic = "force-dynamic";

/** Public official financial records only; no participant account or wallet data. */
export async function GET() {
  try {
    return Response.json(await readApprovedBudgets(), {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch {
    console.error("[participate] official approved budgets unavailable");
    return Response.json({ error: "APPROVED_BUDGETS_UNAVAILABLE" }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
