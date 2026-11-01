import type { Q4ProposalSummary } from "./q4";

/** A display topic only; the applicant's original category stays in the source record. */
export function proposalTopic(proposal: Pick<Q4ProposalSummary, "title" | "category">): string {
  const category = proposal.category?.trim() || "Uncategorized";
  const research = /^research\s*(?:&|and)\s*development$/i.test(category);
  const security = /\b(?:CVE-\d{4}-\d{4,}|GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}|vulnerability disclosure|security research|bug bounty)\b/i.test(proposal.title);
  return research && security ? "Security research" : category;
}
