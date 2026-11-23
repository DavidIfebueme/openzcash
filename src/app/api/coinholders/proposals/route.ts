import { readQ4 } from "@/lib/coinholder/q4-server";
import { Q4, READY_FOR_VOTE_LABEL, q4Phase, q4Summary, q4Totals } from "@/lib/coinholder/q4";
import { cycleAdministration } from "@/lib/coinholder/administration";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await readQ4();
  const proposals = snapshot.proposals?.map(q4Summary) ?? null;
  return Response.json({
    round: Q4, phase: q4Phase().label, requiredLabel: READY_FOR_VOTE_LABEL,
    status: snapshot.status, fetchedAt: snapshot.fetchedAt,
    totals: proposals === null ? null : q4Totals(proposals), proposals,
    administration: cycleAdministration(),
    notes: `Open ${Q4.label} submissions with FPF's ready-for-vote label, plus any hidden application provisionally retained by a linked FPF review decision. Amounts reflect the latest applicant request in USD cents. Program administration is listed separately in administration and excluded from totals.`,
  }, { status: snapshot.status === "unavailable" ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
