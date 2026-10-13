import "server-only";
import { cached, LEDGER_TTL_MS } from "@/lib/cache/memo";
import { listProposals, type ProposalRow } from "./proposals-repo";
import { getGrantApplications } from "./github-applications";
import { getIssueAmounts, getIssueDecisions, getMissingIssues } from "./issue-amounts";
import { publicationDay } from "./publication-policy";
import { PROPOSAL_STATUS_LABEL as STATUS_LABEL } from "./status-labels";
import { officialProposalVerdict } from "@/lib/coinholder/official-status";
import type { ProposalTableRow } from "@/app/zcg/proposals/proposals-table";
import { reconcileProposalRows } from "./reconcile-proposals";

function toTableRow(p: ProposalRow): ProposalTableRow {
  // A closed coinholder round shows FPF's official results, which the
  // spreadsheet (and its next-day publication) can still trail.
  const status =
    (p.program === "coinholder" ? officialProposalVerdict(p)?.status : null) ??
    p.status;
  return {
    id: p.id,
    program: p.program,
    title: p.title,
    platformLink: p.platformLink ?? null,
    applicant: p.applicantsRaw ?? "",
    submitted: p.submittedDate ?? "",
    status,
    statusLabel: STATUS_LABEL[status] ?? status,
    source: "sheet",
  };
}

/** Shared source reads, not a second Participate snapshot or archive mutation. */
export async function readPublishedProposals() {
  const [all, applications, missingIssues, issueDecisions] = await Promise.all([
    cached(`listProposals:all:${publicationDay()}`, LEDGER_TTL_MS, () => listProposals({})),
    getGrantApplications(1000),
    getMissingIssues(),
    getIssueDecisions(),
  ]);
  return { all, ...reconcileProposalRows(all.map(toTableRow), applications, missingIssues, issueDecisions, getIssueAmounts()) };
}
