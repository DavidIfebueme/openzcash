import { readOfficialProposals } from "@/lib/participate/official-proposals";
export const dynamic = "force-dynamic";

/** Public listing only. This route neither imports archives nor dispatches anchors. */
export async function GET() {
  try {
    return Response.json(await readOfficialProposals(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("[participate] official proposal listing unavailable");
    return Response.json({ error: "OFFICIAL_PROPOSALS_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
