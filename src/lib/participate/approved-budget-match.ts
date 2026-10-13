import { spreadsheetSource } from "@/lib/zcg/source-links";
import { ZCG_GIDS } from "@/lib/zcg/sheets";

export type OfficialBudgetProposal = {
  id: string;
  title: string;
  status: string;
  platformLink: string | null;
  sourceSheetGid: string | null;
  sourceRowIndex: number | null;
  program: string;
  origin: string;
  locked: boolean;
};

export type OfficialBudgetMilestone = {
  project: string | null;
  recipientNameRaw: string;
  amountUsdCents: bigint | null;
  grantStatus: string | null;
  sourceSheet: string;
  sourceSheetGid: string | null;
  sourceRowIndex: number | null;
  origin: string;
  locked: boolean;
  isTest: boolean;
  isInternal: boolean;
};

export type OfficialApprovedBudget = {
  usdCents: string;
  sourceUrl: string;
  proposalSourceUrl: string;
  /** One-based Google Sheets row numbers, including paid milestones. */
  sourceRows: number[];
};

/** URL identity is exact; text containing an official-looking link is not one. */
export function officialZcgBudgetIssue(link: string | null): number | null {
  try {
    const url = new URL(link ?? "");
    if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password) return null;
    const match = url.pathname.match(/^\/ZcashCommunityGrants\/zcashcommunitygrants\/issues\/([1-9]\d*)\/?$/i);
    if (!match) return null;
    const issue = Number(match[1]);
    return Number.isSafeInteger(issue) ? issue : null;
  } catch { return null; }
}

/** Formatting differences only: never token similarity or partial-name matching. */
export function officialBudgetTitle(title: string): string {
  return title.normalize("NFKC").trim()
    .replace(/^grant\s+application\b[\s:–—-]*/i, "")
    .replace(/\s*\(\s*revision\s+of\s+#\d+\s*\)\s*$/i, "")
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function validRow(row: number | null): row is number {
  return row !== null && Number.isSafeInteger(row) && row >= 0 && row < Number.MAX_SAFE_INTEGER;
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const value = key(row);
    groups.set(value, [...(groups.get(value) ?? []), row]);
  }
  return groups;
}

/**
 * Current financial annotations from official sheet rows, separate from archived
 * proposal content. Every milestone must qualify: filtering an invalid row and
 * summing the remainder would misrepresent a partial amount as the grant budget.
 */
export function buildOfficialApprovedBudgets(
  proposals: readonly OfficialBudgetProposal[],
  milestones: readonly OfficialBudgetMilestone[],
): { budgets: Record<string, OfficialApprovedBudget>; unmatched: Array<{ issueNumber: number; reason: string }> } {
  const budgets: Record<string, OfficialApprovedBudget> = {};
  const unmatched: Array<{ issueNumber: number; reason: string }> = [];
  const zcg = proposals.filter(row => row.program === "zcg");
  const approved = zcg.filter(row => row.status === "approved");
  const identities = groupBy(zcg.filter(row => officialZcgBudgetIssue(row.platformLink) !== null), row => String(officialZcgBudgetIssue(row.platformLink)));
  const approvedTitles = groupBy(approved, row => officialBudgetTitle(row.title));
  const projects = groupBy(milestones.filter(row => row.sourceSheet === "grants_disbursed"), row => officialBudgetTitle(row.project ?? ""));
  const reported = new Set<number>();
  const skip = (issueNumber: number, reason: string) => {
    if (!reported.has(issueNumber)) unmatched.push({ issueNumber, reason });
    reported.add(issueNumber);
  };

  for (const proposal of approved) {
    const issueNumber = officialZcgBudgetIssue(proposal.platformLink);
    if (issueNumber === null) continue;
    if (proposal.origin !== "sheet" || proposal.locked || proposal.sourceSheetGid !== ZCG_GIDS.proposals || !validRow(proposal.sourceRowIndex)) {
      skip(issueNumber, "untrusted_proposal_source"); continue;
    }
    if (identities.get(String(issueNumber))?.length !== 1) {
      skip(issueNumber, "ambiguous_issue_identity"); continue;
    }
    const title = officialBudgetTitle(proposal.title);
    if (!title || approvedTitles.get(title)?.length !== 1) {
      skip(issueNumber, "ambiguous_approved_title"); continue;
    }
    const rows = projects.get(title) ?? [];
    if (!rows.length) { skip(issueNumber, "missing_grant_budget"); continue; }
    if (rows.some(row => row.origin !== "sheet" || row.locked || row.isTest || row.isInternal || row.sourceSheetGid !== ZCG_GIDS.grantsDisbursed || !validRow(row.sourceRowIndex))) {
      skip(issueNumber, "untrusted_milestone_source"); continue;
    }
    const sourceRows = rows.map(row => row.sourceRowIndex! + 1).sort((a, b) => a - b);
    if (new Set(sourceRows).size !== rows.length) {
      skip(issueNumber, "duplicate_milestone_source"); continue;
    }
    const recipients = new Set(rows.map(row => row.recipientNameRaw.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ")));
    if (recipients.size !== 1 || recipients.has("")) {
      skip(issueNumber, "ambiguous_grant_recipient"); continue;
    }
    if (rows.some(row => !["open", "completed"].includes((row.grantStatus ?? "").trim().toLowerCase()))) {
      skip(issueNumber, "unconfirmed_grant_status"); continue;
    }
    if (rows.some(row => typeof row.amountUsdCents !== "bigint" || row.amountUsdCents < 0n)) {
      skip(issueNumber, "incomplete_grant_budget"); continue;
    }
    const usdCents = rows.reduce((total, row) => total + row.amountUsdCents!, 0n);
    if (usdCents <= 0n) { skip(issueNumber, "nonpositive_grant_budget"); continue; }
    const { sourceUrl: firstRowUrl } = spreadsheetSource(ZCG_GIDS.grantsDisbursed, sourceRows[0] - 1);
    const { sourceUrl: proposalSourceUrl } = spreadsheetSource(ZCG_GIDS.proposals, proposal.sourceRowIndex);
    const contiguous = sourceRows.every((row, index) => row === sourceRows[0] + index);
    const sourceUrl = contiguous && sourceRows.length > 1
      ? `${firstRowUrl}:L${sourceRows.at(-1)}` : firstRowUrl!;
    budgets[String(issueNumber)] = { usdCents: usdCents.toString(), sourceUrl, proposalSourceUrl: proposalSourceUrl!, sourceRows };
  }
  return { budgets, unmatched };
}
