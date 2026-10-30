import { readQ4 } from "@/lib/coinholder/q4-server";
import { Q4, READY_FOR_VOTE_LABEL, q4Phase, q4Summary, q4Totals } from "@/lib/coinholder/q4";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await readQ4();
  const proposals = snapshot.proposals?.map(q4Summary) ?? null;
  return Response.json({
    round: Q4, phase: q4Phase().label, requiredLabel: READY_FOR_VOTE_LABEL,
    status: snapshot.status, fetchedAt: snapshot.fetchedAt,
    totals: proposals === null ? null : q4Totals(proposals), proposals,
    notes: `Open, undecided submissions from the ${Q4.label} call carrying FPF's exact ready-for-vote label. Amounts are requested USD cents, not awards or payments.`,
  }, { status: snapshot.status === "unavailable" ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
