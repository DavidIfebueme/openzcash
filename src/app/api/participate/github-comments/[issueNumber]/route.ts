import { readOfficialProposals } from "@/lib/participate/official-proposals";
import { readGitHubComments } from "@/lib/participate/github-comments";
import { ZCG_SOURCE_METADATA } from "@/lib/participate/workspace/data/zcg-source-metadata";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET(_request: Request, { params }: { params: Promise<{ issueNumber: string }> }) {
  const { issueNumber: input } = await params;
  if (!/^[1-9]\d{0,7}$/.test(input)) return Response.json({ error: "INVALID_ISSUE" }, { status: 400, headers });
  const issueNumber = Number(input);
  try {
    // Only published official proposals can cause a GitHub request, never arbitrary caller URLs.
    // Existing verified source identities remain readable during a listing/database outage.
    const archivedSource = ZCG_SOURCE_METADATA.some(source => source.issueNumber === issueNumber);
    if (!archivedSource) {
      const known = await readOfficialProposals();
      if (!known.proposals.some(proposal => proposal.issueNumber === issueNumber)) return Response.json({ error: "PROPOSAL_NOT_FOUND" }, { status: 404, headers });
    }
    return Response.json(await readGitHubComments(issueNumber), { headers });
  } catch {
    return Response.json({ error: "GITHUB_COMMENTS_UNAVAILABLE" }, { status: 503, headers });
  }
}
