/**
 * Public read path for the 3D office (/zcg/office). Returns the live "under
 * review" grant proposals — the ones rendered as walking zebras. The client
 * polls this so an open tab follows the D-1 publication of status changes.
 *
 * Not gated by the admin middleware (see ADMIN_APIS). Backed by the same 15-min
 * in-process cache as the page, so polling never hammers GitHub.
 */
import { officeUnderReview } from "@/lib/zcg/proposals-repo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const proposals = await officeUnderReview(100);
    return Response.json(
      { proposals },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "Proposal updates temporarily unavailable" }, { status: 503 });
  }
}
