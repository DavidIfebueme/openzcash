import { z } from "zod/v3";
import type { ProposalTableRow } from "@/app/zcg/proposals/proposals-table";

export const officialProposalSchema = z.object({
  issueNumber: z.number().int().positive(),
  title: z.string().min(1), url: z.string().url(), applicant: z.string(),
  submitted: z.string(), requestedUsd: z.number().finite().nonnegative().nullable(),
  outcome: z.enum(["under_review", "approved", "rejected", "filtered", "abandoned", "closed"]),
  /** Published spreadsheet wording, retained separately from committee verdicts. */
  statusDetail: z.string().max(1000).optional(),
  statusSourceUrl: z.string().url().optional(),
}).superRefine((row, ctx) => {
  if (row.url !== `https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/${row.issueNumber}`)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Official issue identity mismatch" });
});
export const officialProposalSnapshotSchema = z.object({
  version: z.literal(1), readAt: z.string().datetime(), proposals: z.array(officialProposalSchema),
});
export type OfficialProposalListing = z.infer<typeof officialProposalSchema>;
export type ParticipateProposalOutcome = OfficialProposalListing["outcome"];
export type OfficialProposalSnapshot = z.infer<typeof officialProposalSnapshotSchema>;

/** Exact issue URLs only. Demo links and similar titles never grant source identity. */
export function officialIssueNumber(value: string | null | undefined) {
  const match = value?.match(/^https:\/\/github\.com\/ZcashCommunityGrants\/zcashcommunitygrants\/issues\/([1-9]\d*)\/?(?:[?#].*)?$/i);
  return match && Number.isSafeInteger(Number(match[1])) ? Number(match[1]) : null;
}

/** Adapt the very same reconciled rows; never re-read raw, unpublished sheet verdicts. */
export function officialProposalListings(rows: readonly ProposalTableRow[]): OfficialProposalListing[] {
  const seen = new Set<number>();
  return rows.flatMap(row => {
    const issueNumber = row.program === "zcg" ? officialIssueNumber(row.platformLink) : null;
    if (!issueNumber || seen.has(issueNumber)) return [];
    seen.add(issueNumber);
    const outcome = row.status === "under_review" ? "under_review" : row.status === "approved" ? "approved"
      : row.status === "filtered" ? "filtered"
      : row.status === "rejected" || row.status === "vetoed" ? "rejected"
      : row.status === "withdrawn" || row.status === "cancelled" ? "abandoned" : "closed";
    return [{ issueNumber, title: row.title, url: `https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/${issueNumber}`,
      applicant: row.applicant, submitted: row.submitted, requestedUsd: row.amountUsd ?? null, outcome,
      ...(outcome === "filtered" && row.statusRaw ? { statusDetail: row.statusRaw } : {}),
      ...(outcome === "filtered" && row.statusSourceUrl ? { statusSourceUrl: row.statusSourceUrl } : {}),
    } satisfies OfficialProposalListing];
  }).sort((a, b) => b.submitted.localeCompare(a.submitted) || b.issueNumber - a.issueNumber);
}
