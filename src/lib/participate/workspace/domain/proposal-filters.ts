import { classifyOpenZcashSectors } from "./openzcash-sectors";
import { classifyZcgSectors } from "./zcg-source-metadata";
import type { ProposalTagId } from "./proposal-tags";

export type ProposalFilters = { query: string; category: ProposalTagId | "all" | "uncategorized" };
export const EMPTY_PROPOSAL_FILTERS: ProposalFilters = { query: "", category: "all" };

/** Filtering and visible tags must use the same category classification. */
export function proposalSectors(title: string, tags: readonly string[], category?: string | null) {
  return classifyZcgSectors(title, category, classifyOpenZcashSectors(title, tags));
}

const normalize = (value: string) => value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function matchesProposalFilters(proposal: { title: string; applicant?: string | null; recordId: string; issueNumber?: number | null; sectors: readonly ProposalTagId[] }, filters: ProposalFilters = EMPTY_PROPOSAL_FILTERS) {
  if (filters.category === "uncategorized" ? proposal.sectors.length > 0 : filters.category !== "all" && !proposal.sectors.includes(filters.category)) return false;
  const terms = normalize(filters.query).trim().split(/\s+/).map(term => term.replace(/^@/, "")).filter(Boolean);
  if (!terms.length) return true;
  const issue = proposal.issueNumber ?? proposal.recordId.match(/^zcg-github-(\d+)$/)?.[1];
  const haystack = normalize(`${proposal.title} ${proposal.applicant ?? ""} ${proposal.recordId} ${issue ? `#${issue}` : ""}`);
  return terms.every(term => haystack.includes(term));
}
