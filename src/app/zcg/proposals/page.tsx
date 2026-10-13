import { SourceRefresh } from "@/components/source-refresh";
import { FeatureLink, SectionHeading } from "@/components/workspace";
import Link from "next/link";
import { Card, PageHeader, Stat } from "@/components/ui";
import { listProposals, type ProposalRow } from "@/lib/zcg/proposals-repo";
import { nowMs } from "@/lib/utils";
import { formatUsdCents } from "@/lib/zcg/format";
import { getIsAdmin } from "@/lib/auth/admin";
import { getLinks } from "@/lib/zcg/governance-repo";
import { ProposalsTable, type ProposalTableRow } from "./proposals-table";
import { cached, LEDGER_TTL_MS } from "@/lib/cache/memo";
import {
  getGrantApplications,
  ZCG_APPLICATIONS_REPO_URL,
} from "@/lib/zcg/github-applications";
import { matchProposalApplications } from "@/lib/zcg/match-proposals";
import { getDiligence } from "@/lib/zcg/diligence";
import {
  getIssueAmounts,
  getIssueDecisions,
  getMissingIssues,
} from "@/lib/zcg/issue-amounts";
import { issueNumberFromLink } from "@/lib/zcg/issue-link";
import { Synced } from "@/components/synced";
import { publicationDay } from "@/lib/zcg/publication-policy";
import { PROPOSAL_STATUS_LABEL } from "@/lib/zcg/status-labels";
import { officialProposalVerdict } from "@/lib/coinholder/official-status";
import { pageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "ZCG Proposals · OpenZcash",
  description:
    "ZCG and Coinholder proposal history. Status changes are published the next day (Brasília time). Approval is not evidence of payment or delivery.",
  path: "/zcg/proposals",
});

// Verdict wording is shared with the overview changelog and the admin form.
const STATUS_LABEL = PROPOSAL_STATUS_LABEL;

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

export default async function PropostasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: filterRaw } = await searchParams;
  const [isAdmin, all, links, applications] = await Promise.all([
    getIsAdmin(),
    cached(`listProposals:all:${publicationDay()}`, LEDGER_TTL_MS, () =>
      listProposals({}),
    ),
    cached("links", LEDGER_TTL_MS, () => getLinks()),
    getGrantApplications(40),
  ]);
  const submitUrl = links.proposal_zcg ?? "#";

  // Live "ready for review" grant applications, read first-hand from GitHub.
  const ghApps = applications.filter((a) => a.status === "review");

  // Public-data diligence signals, computed by the cron for the under-review
  // set only — this is a cache-only read keyed by issue number, never network.
  const diligence = getDiligence();

  // Requested amounts recovered from applications OUTSIDE the open review set
  // (e.g. an issue GitHub already closed while the sheet still lists the row
  // under review), plus applications deleted from GitHub (dead links).
  // Cache-only reads, warmed by the same cron.
  const issueAmounts = getIssueAmounts();
  const [missingIssues, issueDecisions] = await Promise.all([
    getMissingIssues(),
    getIssueDecisions(),
  ]);

  // A sheet row still marked under review whose GitHub application was
  // DELETED upstream (404) is not a real, verifiable proposal anymore — drop
  // it from the list and the counts (a footnote below keeps this auditable).
  const isRemovedUpstream = (r: ProposalTableRow) => {
    if (r.program !== "zcg" || r.status !== "under_review") return false;
    const n = issueNumberFromLink(r.platformLink);
    return n != null && missingIssues.has(n);
  };
  const sheetRows = all.map(toTableRow);
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
      diligence:
        r.status === "under_review"
          ? (diligence.get(app.number) ?? null)
          : null,
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
      diligence: diligence.get(a.number) ?? null,
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

  // Count the same reconciled records that search and verdict filters receive.
  const statusCounts = new Map<string, number>();
  for (const row of allRows) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
  }
  const byStatus = [...statusCounts]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));
  const total = allRows.length;
  const approved = byStatus.find((b) => b.status === "approved")?.count ?? 0;
  const maxStatus = byStatus.reduce((m, b) => Math.max(m, b.count), 0);
  const apprRate = total ? Math.round((approved / total) * 100) : 0;

  // #8 How fast does ZCG decide? Average committee turnaround, from the dates
  // already recorded on each proposal.
  const decided = all.filter(
    (p) => p.program === "zcg" && p.decisionTurnaroundDays != null,
  );
  const avgDecisionDays = decided.length
    ? Math.round(
        decided.reduce((s, p) => s + (p.decisionTurnaroundDays ?? 0), 0) /
          decided.length,
      )
    : null;

  // Ageing of the live queue: whole days since submission for every
  // under-review row, flagged when past the committee's historical average.
  // A submission date in the FUTURE is a spreadsheet data-entry typo (real
  // cases: 2026-12-19 and a 2027 year slip) — mirror it faithfully but flag
  // it instead of computing nonsense ageing from it.
  const todayMs = nowMs();
  const withAgeing = allRows.map((r) => {
    if (!r.submitted) return r;
    const t = Date.parse(r.submitted);
    if (Number.isNaN(t)) return r;
    if (t > todayMs + 86_400_000) return { ...r, dateSuspect: true };
    if (r.status !== "under_review") return r;
    const days = Math.max(0, Math.floor((todayMs - t) / 86_400_000));
    return {
      ...r,
      daysInReview: days,
      reviewOverdue:
        r.program === "zcg" &&
        avgDecisionDays != null &&
        days > avgDecisionDays,
    };
  });

  // Filter the table by the clicked funnel verdict.
  const active =
    filterRaw && STATUS_LABEL[filterRaw] ? (filterRaw as string) : null;
  const shownRows = active
    ? withAgeing.filter((r) => r.status === active)
    : withAgeing;

  // One-line reading of the selection: how many, how long they have waited,
  // how much they ask for, how many are past the committee's average.
  const daysList = shownRows
    .map((r) => r.daysInReview)
    .filter((d): d is number => typeof d === "number")
    .sort((a, b) => a - b);
  const medianDays = daysList.length
    ? daysList.length % 2
      ? daysList[(daysList.length - 1) / 2]
      : Math.round(
          (daysList[daysList.length / 2 - 1] + daysList[daysList.length / 2]) / 2,
        )
    : null;
  const amounts = shownRows
    .map((r) => r.amountUsd)
    .filter((a): a is number => typeof a === "number" && a > 0);
  const selection = {
    medianDays,
    withAmount: amounts.length,
    requestedUsd: Math.round(amounts.reduce((s, a) => s + a, 0)),
    overdue: shownRows.filter((r) => r.reviewOverdue).length,
  };

  return (
    <>
      <SourceRefresh />
      <PageHeader
        title="Proposals"
        subtitle="ZCG and Coinholder proposal history. Status changes are published the next day (Brasília time). Approval is not evidence of payment or delivery."
        actions={
          <a
            href={submitUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-medium text-stone-900 shadow-sm shadow-amber-900/20 transition hover:bg-amber-400"
          >
            Submit a proposal ↗
          </a>
        }
      />

      <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Proposals" value={String(total)} sub="since 2021" />
        <Stat
          label="Approved"
          value={String(approved)}
          sub={`${apprRate}% approval rate`}
        />
        <Stat
          label="Avg decision"
          value={avgDecisionDays != null ? `${avgDecisionDays}d` : "n/a"}
          sub="ZCG committee turnaround"
        />
        <Stat
          label="Ready for review"
          value={String(ghApps.length)}
          sub="Published review queue"
          tone="warn"
        />
        <Stat
          label="Showing"
          value={String(shownRows.length)}
          sub={active ? (STATUS_LABEL[active] ?? active) : "all verdicts"}
        />
      </section>

      <SectionHeading
        title="Proposal pipeline"
        description="Explore the published status of each proposal. Select a verdict to narrow the records."
      />
      <nav className="ws-pipeline" aria-label="Proposal verdicts">
        <Link href="/zcg/proposals" aria-current={!active ? "page" : undefined}>
          <span>All proposals</span>
          <strong>{total}</strong>
        </Link>
        {byStatus.map((b) => (
          <Link
            key={b.status}
            // Selecting the active verdict again clears the filter, and the
            // page keeps its scroll position while the table re-renders.
            href={
              active === b.status
                ? "/zcg/proposals"
                : `/zcg/proposals?status=${b.status}`
            }
            scroll={false}
            aria-current={active === b.status ? "page" : undefined}
          >
            <span>{STATUS_LABEL[b.status] ?? b.status}</span>
            <strong>{b.count}</strong>
            <i
              style={{
                width: `${maxStatus ? (b.count / maxStatus) * 100 : 0}%`,
              }}
            />
          </Link>
        ))}
      </nav>
      {active ? (
        <div className="ws-selection" role="status">
          <span>
            <strong>{shownRows.length}</strong>{" "}
            {(STATUS_LABEL[active] ?? active).toLowerCase()}
          </span>
          {selection.medianDays != null ? (
            <span>
              median <strong>{selection.medianDays} d</strong> in review
            </span>
          ) : null}
          {selection.withAmount > 0 ? (
            <span>
              <strong className="tnum">
                {formatUsdCents(BigInt(selection.requestedUsd) * 100n, {
                  compact: false,
                })}
              </strong>{" "}
              requested across {selection.withAmount} with an amount
            </span>
          ) : null}
          {selection.overdue > 0 ? (
            <span>
              <strong className="ws-selection-warn">{selection.overdue}</strong>{" "}
              past the {avgDecisionDays ?? "·"} d average
            </span>
          ) : null}
          <Link href="/zcg/proposals" scroll={false} className="ws-selection-clear">
            Clear ✕
          </Link>
        </div>
      ) : null}

      <Card className="overflow-hidden p-0">
        <ProposalsTable
          key={active ?? "all"}
          rows={shownRows}
          isAdmin={isAdmin}
        />
      </Card>

      <p className="mt-3 text-xs text-stone-500">
        Rows tagged{" "}
        <span className="rounded bg-indigo-500/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-indigo-700">
          GitHub live
        </span>{" "}
        include application details or decisions read from the{" "}
        <a
          href={ZCG_APPLICATIONS_REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="text-amber-700 hover:underline"
        >
          ZCG issue tracker ↗
        </a>
        . The rest are mirrored from the spreadsheet.
      </p>

      {shownRows.some((r) => r.diligence) ? (
        <p className="mt-1.5 text-xs text-stone-500">
          Diligence signals cover under-review applications only and use public
          data: GitHub account history, prior ZCG applications, a same-handle
          forum profile, and a title search across GitHub. Signals inform,
          reviewers decide.
        </p>
      ) : null}

      {removedCount > 0 ? (
        <p className="mt-1.5 text-xs text-stone-500">
          {removedCount} under-review {removedCount === 1 ? "entry" : "entries"}{" "}
          from the spreadsheet {removedCount === 1 ? "is" : "are"} not listed:
          the linked GitHub application was deleted, so there is no verifiable
          proposal behind {removedCount === 1 ? "it" : "them"}.
        </p>
      ) : null}

      {ghRejected + ghApproved > 0 ? (
        <p className="mt-1.5 text-xs text-stone-500">
          {ghRejected + ghApproved} under-review{" "}
          {ghRejected + ghApproved === 1 ? "entry" : "entries"} from the
          spreadsheet already {ghRejected + ghApproved === 1 ? "has" : "have"} a
          committee decision on GitHub (issue closed and labelled). They show
          the GitHub verdict until the spreadsheet catches up, per the{" "}
          <Link
            href="/zcg/methodology#precedence"
            className="text-amber-700 hover:underline"
          >
            source precedence rule
          </Link>
          .
        </p>
      ) : null}

      <p className="mt-1.5 text-xs text-stone-500">
        Coinholder proposals of a closed round show FPF&apos;s official results
        as soon as they are published.
      </p>

      <Synced className="mt-4" />

      <FeatureLink
        eyebrow="Research with sources"
        title="Ask the ZCG Copilot"
        description="Explore funded, under-review and declined proposals with links to the public evidence."
        href="/zcg/copilot"
        label="Open Copilot"
      />
    </>
  );
}
