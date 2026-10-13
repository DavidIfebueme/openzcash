import "server-only";

import { cached, LEDGER_TTL_MS } from "@/lib/cache/memo";
import { listProposals } from "@/lib/zcg/proposals-repo";
import { getMeetings } from "@/lib/zcg/governance-repo";
import { listGrants } from "@/lib/zcg/grants-repo";
import { proposalDecisions, sortDecisions } from "@/lib/governance/decisions";
import { publicationDay } from "@/lib/zcg/publication-policy";

/** The same public register serves the portal fallback and the Participate workspace. */
export async function readDecisionHistory() {
  const [proposals, meetings, grants] = await Promise.all([
    cached(`listProposals:all:${publicationDay()}`, LEDGER_TTL_MS, () => listProposals({})),
    getMeetings().catch(() => []),
    cached("grants:list", LEDGER_TTL_MS, () => listGrants()).catch(() => []),
  ]);
  return sortDecisions(proposalDecisions(proposals, meetings, grants.map(grant => grant.grantKey))
    .filter(row => row.process === "committee"));
}
