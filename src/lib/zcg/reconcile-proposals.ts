import type { GrantApplication } from "./github-applications";
import type { ProposalTableRow } from "@/app/zcg/proposals/proposals-table";
import { matchProposalApplications } from "./match-proposals";
import { issueNumberFromLink } from "./issue-link";
import { PROPOSAL_STATUS_LABEL as STATUS_LABEL } from "./status-labels";

/** One presentation policy for Proposals and Participate; inputs already obey D-1. */
export function reconcileProposalRows(sheetRows: ProposalTableRow[], applications: GrantApplication[], missingIssues: Set<number>, issueDecisions: Map<number, string>, issueAmounts: Map<number, number | null>) {
  const ghApps = applications.filter(app => app.status === "review");
  // A sheet row still marked under review whose GitHub application was
  // DELETED upstream (404) is not a real, verifiable proposal anymore — drop
  // it from the list and the counts (a footnote below keeps this auditable).
  const isRemovedUpstream = (r: ProposalTableRow) => {
    if (r.program !== "zcg" || r.status !== "under_review") return false;
    const n = issueNumberFromLink(r.platformLink);
    return n != null && missingIssues.has(n);
  };
  const listedSheetRows = sheetRows.filter((r) => !isRemovedUpstream(r));
  const removedCount = sheetRows.length - listedSheetRows.length;

  // Each GitHub application is usually already mirrored in the spreadsheet's
  // under-review bucket. Enrich the matching sheet row with a "GitHub live"
  // badge + direct issue link instead of listing it twice; only applications
  // with no sheet counterpart become their own new rows.
  const matches = matchProposalApplications(listedSheetRows, ghApps);
  const usedGh = new Set(matches.values());
  const enrichedSheet = listedSheetRows.map((r) => {
    const app = ghApps.find((g) => g.number === matches.get(r.id));
    if (!app) {
      // No open application matched — the sheet link may still point at a
      // closed issue whose body carries the requested amount, and possibly a
      // committee decision the spreadsheet has not recorded yet. Source
      // hierarchy: a DECIDED source beats an undecided one (the sheet still
      // wins whenever it has decided), so a closed+labelled issue overrides a
      // sheet row stuck on "under review" (real case: #333 declined upstream).
      const n =
        r.program === "zcg" ? issueNumberFromLink(r.platformLink) : null;
      const amt = n != null ? issueAmounts.get(n) : undefined;
      const dec =
        n != null && r.status === "under_review"
          ? issueDecisions.get(n)
          : undefined;
      return {
        ...r,
        ...(amt != null ? { amountUsd: amt } : {}),
        ...(dec
          ? {
              status: dec,
              statusLabel: STATUS_LABEL[dec] ?? dec,
              source: "github" as const,
            }
          : {}),
      };
    }
    return {
      ...r,
      source: "github" as const,
      platformLink: app.url ?? r.platformLink,
      amountUsd: app.amountUsd,
    };
  });

  const netNewGhRows: ProposalTableRow[] = ghApps
    .filter((a) => !usedGh.has(a.number))
    .map((a) => ({
      id: `gh-${a.number}`,
      program: "zcg",
      title: a.title,
      platformLink: a.url,
      applicant: a.applicant ? `@${a.applicant}` : "",
      submitted: (a.createdAt || "").slice(0, 10),
      status: "under_review",
      statusLabel: "Under review",
      source: "github" as const,
      amountUsd: a.amountUsd,
    }));

  const allRows = [...netNewGhRows, ...enrichedSheet];

  // Rows whose verdict came from GitHub (sheet still says under review) move
  // between funnel buckets without changing the total.
  const ghDecided = enrichedSheet.filter(
    (r) =>
      r.source === "github" &&
      issueDecisions.get(issueNumberFromLink(r.platformLink) ?? -1),
  );
  const ghRejected = ghDecided.filter((r) => r.status === "rejected").length;
  const ghApproved = ghDecided.filter((r) => r.status === "approved").length;

  return { rows: allRows, removedCount, ghApproved, ghRejected, applications: ghApps };
}
