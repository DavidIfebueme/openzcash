import { participantCookies, readCommitteeWorkspace } from "@/lib/participate/service";
import { cached } from "@/lib/cache/memo";
import { fetchSheetCsv, ZCG_GIDS, ZCG_SHEET_ID } from "@/lib/zcg/sheets";
import { parseCsv } from "@/lib/zcg/csv";
import { readProposalSheet, proposalLinkIdentity } from "@/lib/participate/proposal-sheet";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
/** Read-only handoff for a committee session. No Sheets credentials or write operation. */
export async function GET(request: Request) {
  const sourceUrl = new URL(request.url).searchParams.get("proposalUrl") ?? "";
  if (sourceUrl.length > 2048 || !proposalLinkIdentity(sourceUrl)) return Response.json({ error: "INVALID_PROPOSAL_LINK" }, { status: 400, headers });
  try {
    const committee = await readCommitteeWorkspace(participantCookies(request.headers.get("cookie")));
    if (!committee || committee.access !== "MEMBER") return Response.json({ error: "COMMITTEE_ACCESS_REQUIRED" }, { status: 403, headers });
    const snapshot = await cached("participate:sheet-handoff", 60_000, async () => ({ rows: parseCsv(await fetchSheetCsv(ZCG_GIDS.proposals)), checkedAt: new Date().toISOString() }));
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${ZCG_SHEET_ID}/edit#gid=${ZCG_GIDS.proposals}`;
    return Response.json(readProposalSheet(snapshot.rows, sourceUrl, sheetUrl, snapshot.checkedAt), { headers });
  } catch (error) {
    const changed = error instanceof Error && error.message === "SHEET_LAYOUT_CHANGED";
    return Response.json({ error: changed ? "SHEET_LAYOUT_CHANGED" : "SHEET_UNAVAILABLE" }, { status: changed ? 409 : 503, headers });
  }
}
