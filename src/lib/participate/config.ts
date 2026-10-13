/** Native Participate screens: fixed views, filters and the public archive scope. */
export const PARTICIPATE_PATH = "/zcg/participate";
export const DEFAULT_PARTICIPATE_COMMUNITY_ID = "preview_orchard";

/** The archive host id is public: it is part of every same-origin API path. */
export function participationCommunityId(
  raw: string | undefined = process.env.PARTICIPATE_COMMUNITY_ID,
): string {
  const value = raw?.trim() ?? "";
  return /^[a-z0-9_-]{1,128}$/i.test(value)
    ? value
    : DEFAULT_PARTICIPATE_COMMUNITY_ID;
}

export type ParticipationView = "proposals" | "history" | "committee";
export function participationView(raw: unknown): ParticipationView {
  return raw === "history" || raw === "committee" ? raw : "proposals";
}

export const PROPOSAL_FILTERS = [
  { value: "under_review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "abandoned", label: "Withdrawn" },
] as const;
export type ProposalFilter = (typeof PROPOSAL_FILTERS)[number]["value"];
export function proposalFilter(raw: unknown): ProposalFilter {
  return PROPOSAL_FILTERS.some((filter) => filter.value === raw)
    ? (raw as ProposalFilter)
    : "under_review";
}

/** Same-origin API paths shared by the browser and the server. */
export function archiveEndpoint(
  communityId: string,
  recordId?: string,
): string {
  const base = `/api/communities/${encodeURIComponent(communityId)}/archives`;
  return recordId ? `${base}/${encodeURIComponent(recordId)}` : base;
}

export function proposalPath(recordId: string): string {
  return `${PARTICIPATE_PATH}/${encodeURIComponent(recordId)}`;
}

/** Record ids are fixed by the archive: lowercase slugs, never paths. */
export function isRecordId(value: unknown): value is string {
  return (
    typeof value === "string" && /^[a-z0-9][a-z0-9._-]{0,127}$/.test(value)
  );
}
