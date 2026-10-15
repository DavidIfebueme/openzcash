"use client";

import Link from "next/link";
import { ProposalSearch } from "./proposal-search";
import { EMPTY_PROPOSAL_FILTERS, matchesProposalFilters, proposalSectors, type ProposalFilters } from "@/lib/participate/workspace/domain/proposal-filters";
import { officialIssueNumber, type OfficialProposalListing } from "@/lib/participate/official-proposals-model";
import { ProposalCard } from "./proposal-card";
import { PUBLISHED_COMMITTEE_DECISIONS } from "@/lib/zcg/committee-minutes";
import { useEffect, useState, type ReactNode } from "react";
import { type ZcgProposalExample } from "@/lib/participate/workspace/data/zcg-proposal-examples";
import { ZCG_REVIEW_CHECKED_AT } from "@/lib/participate/workspace/data/zcg-review-proposals";
import type { ZcgReviewProposal } from "@/lib/participate/workspace/domain/zcg-review";
import { zcgSourceMetadata, ZCG_SOURCE_CHECKED_AT } from "@/lib/participate/workspace/data/zcg-source-metadata";
import { githubProposalOutcome } from "@/lib/participate/workspace/domain/zcg-source-metadata";
import { zcgApprovedBudget, type ApprovedBudgetMap, type ApprovedBudgetStatus } from "@/lib/participate/workspace/data/zcg-approved-budgets";
import { formatProposalUsd } from "@/lib/participate/workspace/domain/proposal-funding";
import { ProposalZecEstimate, type PriceState } from "@/components/participate/workspace/proposal-zec-estimate";

import { budgetStatusText } from "./approved-proposal-budgets";
import { PendingCommitteeCard } from "./pending-committee-card";
import { PublishedDecisionCard } from "./published-decision-card";
import type { FeedbackSelection } from "./zcg-vote-bar";

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });


const filters = [
  { value: "under_review", label: "Under review" },
  { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" }, { value: "abandoned", label: "Withdrawn" },
  { value: "filtered", label: "Filtered" },
  { value: "closed", label: "Closed" }
] as const;
type ProposalFilter = typeof filters[number]["value"];
type ListedProposal = ZcgProposalExample | ZcgReviewProposal;
function listedOutcome(proposal: ListedProposal) {
  const source = zcgSourceMetadata(proposal.id);
  return proposal.outcome === "under_review" && source ? githubProposalOutcome(source) : proposal.outcome;
}
function listedFilter(proposal: ListedProposal): ProposalFilter {
  return listedOutcome(proposal);
}

export function ZcgProposalExamples({ officialOutcomes = {}, officialProposals = [], replaceReviewQueue = false, proposals, communityId, archiveRecordIds, renderActions, renderReview, inline, toolbar, additionalRecords, additionalCount, committeeLabels = {}, filterResetKey = 0, filterTarget, ledgerImportedAt, approvedBudgets = {}, budgetStatus = "loading", price = { status: "loading", price: null } }: { officialOutcomes?: Record<string, ProposalFilter>; officialProposals?: readonly OfficialProposalListing[]; replaceReviewQueue?: boolean; ledgerImportedAt?: string; approvedBudgets?: ApprovedBudgetMap; budgetStatus?: ApprovedBudgetStatus; price?: PriceState; proposals: readonly ListedProposal[]; filterResetKey?: number; filterTarget?: { recordId: string; fallback: ProposalFilter }; committeeLabels?: Record<string, string[]>; communityId?: string; archiveRecordIds?: string[]; renderActions?: (recordId: string) => ReactNode; renderReview?: (recordId: string) => ReactNode; toolbar?: ReactNode; additionalRecords?: (filter: ProposalFilter, search: ProposalFilters) => ReactNode; additionalCount?: (filter: ProposalFilter, search?: ProposalFilters) => number; inline?: { isRecordOpen: (recordId: string) => boolean; toggleRecord: (recordId: string) => void; renderPanel: (recordId: string) => ReactNode } }) {
  const [feedback, setFeedback] = useState<(FeedbackSelection & { proposalId: string }) | null>(null);
  const officialByIssue = new Map(officialProposals.map(proposal => [proposal.issueNumber, proposal]));
  const currentOutcome = (proposal: ListedProposal) => officialOutcomes[proposal.id] ?? listedFilter(proposal);
  const target = proposals.find(proposal => proposal.id === filterTarget?.recordId);
  const targetFilter = target ? currentOutcome(target) : filterTarget?.fallback ?? "under_review";
  const [selection, setSelection] = useState<{ filter: ProposalFilter; key: number; manual: boolean }>({ filter: targetFilter, key: filterResetKey, manual: false });
  const hasClosed = proposals.some(proposal => currentOutcome(proposal) === "closed") || (additionalCount?.("closed") ?? 0) > 0;
  const hasFiltered = proposals.some(proposal => currentOutcome(proposal) === "filtered") || (additionalCount?.("filtered") ?? 0) > 0;
  const selectedFilter = selection.key === filterResetKey && selection.manual ? selection.filter : targetFilter;
  const filter = (selectedFilter === "closed" && !hasClosed) || (selectedFilter === "filtered" && !hasFiltered) ? "under_review" : selectedFilter;
  const setFilter = (value: ProposalFilter) => setSelection({ filter: value, key: filterResetKey, manual: true });
  const searchKey = `${filterResetKey}:${filterTarget?.recordId ?? ""}`;
  const [searchSelection, setSearchSelection] = useState({ key: searchKey, value: EMPTY_PROPOSAL_FILTERS });
  const search = searchSelection.key === searchKey ? searchSelection.value : EMPTY_PROPOSAL_FILTERS;
  const inStatus = proposals.filter(proposal => currentOutcome(proposal) === filter && !(replaceReviewQueue && filter === "under_review"));
  const filtered = inStatus.filter(proposal => {
    const source = zcgSourceMetadata(proposal.id);
    const issue = officialIssueNumber(source?.url ?? proposal.proposalUrl) ?? (Number(proposal.id.match(/^zcg-github-(\d+)$/)?.[1]) || null);
    const listing = issue ? officialByIssue.get(issue) : undefined;
    return matchesProposalFilters({ title: proposal.title, recordId: proposal.id, issueNumber: issue,
      applicant: listing?.applicant ?? (proposal.outcome === "under_review" ? proposal.applicant : undefined),
      sectors: proposalSectors(proposal.title, proposal.tags, source?.category) }, search);
  });
  const resultCount = filtered.length + (additionalCount?.(filter, search) ?? 0);
  const totalCount = inStatus.length + (additionalCount?.(filter) ?? 0);
  const publishedTarget = target && archiveRecordIds && !archiveRecordIds.includes(target.id) && !selection.manual ? target.id : null;
  useEffect(() => {
    // An unimported decision has no record panel to receive deep-link focus.
    if (publishedTarget) document.getElementById(`published-decision-${publishedTarget}`)?.focus();
  }, [publishedTarget]);
  return <div className="dao-zcg-examples">
    <div className="dao-proposal-tools" data-participate-tour="filters">
      <div className="dao-filter-list" aria-label="Filter proposals">{filters.filter(item => (item.value !== "closed" || hasClosed) && (item.value !== "filtered" || hasFiltered)).map(({ value, label }) => <button key={value} type="button" className={`dao-filter${filter === value ? " dao-filter--active" : ""}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      <ProposalSearch value={search} onChange={value => setSearchSelection({ key: searchKey, value })} />
      {toolbar}
    </div>
    <p className="proposal-search-count" role="status" aria-label="Proposal count" aria-live="polite"><strong>{resultCount.toLocaleString("en-US")}</strong>{" "}<span>{`${search.query.trim() || search.category !== "all" ? `of ${totalCount.toLocaleString("en-US")} ` : ""}${totalCount === 1 ? "proposal" : "proposals"}`}</span></p>
    <div id="proposal-results">
    {additionalRecords?.(filter, search)}
    <ul className="dao-proposal-list dao-zcg-list">{filtered.map(proposal => {
      const details = archiveRecordIds && !archiveRecordIds.includes(proposal.id) ? undefined : inline;
      const actions = archiveRecordIds && !archiveRecordIds.includes(proposal.id) ? undefined : renderActions;
      const inReview = proposal.outcome === "under_review";
      const outcome = currentOutcome(proposal);
      const published = inReview ? undefined : PUBLISHED_COMMITTEE_DECISIONS.find(decision => decision.id === proposal.id && decision.outcome === outcome);
      const approvedBudget = outcome === "approved" ? zcgApprovedBudget(approvedBudgets, proposal.id, published ? { issueNumber: published.issueNumber, url: published.issueUrl } : undefined) : null;
      const source = zcgSourceMetadata(proposal.id);
      const issue = published?.issueNumber ?? officialIssueNumber(source?.url ?? proposal.proposalUrl);
      const listing = issue ? officialByIssue.get(issue) : undefined;
      const budget = approvedBudget ? formatProposalUsd(approvedBudget.usdCents).replace(" USD", "").replace(/\.00$/, "") : outcome === "approved" || proposal.requestedUsd === null ? null : dollars.format(proposal.requestedUsd);
      return <ProposalCard key={proposal.id} recordId={proposal.id} id={published ? `published-decision-${proposal.id}` : undefined} focusable={Boolean(published)} tour={Boolean(details)}
        labels={{ title: proposal.title, tags: proposal.tags, committeeLabels: committeeLabels[proposal.id], outcome }}
        engagement={actions ? actions(proposal.id) : <span className="dao-zcg-record-label" title="Comments, likes and archive verification become available after source import.">Awaiting source import</span>}
        actions={<>{inReview && actions ? <a className="dao-text-button" href={proposal.proposalUrl} target="_blank" rel="noopener noreferrer">Source ↗</a> : null}{details ? <button id={`proposal-read-${proposal.id}`} type="button" className="dao-text-button proposal-read-toggle" aria-expanded={details.isRecordOpen(proposal.id)} aria-controls={`proposal-panel-${proposal.id}`} onClick={() => details.toggleRecord(proposal.id)}>Read & verify <span className="proposal-disclosure-arrow" aria-hidden="true">⌄</span></button> : communityId && archiveRecordIds?.includes(proposal.id) ? <Link className="dao-text-button" href={`/communities/${encodeURIComponent(communityId)}/archives/${encodeURIComponent(proposal.id)}`}>Read & verify →</Link> : <a className="dao-text-button" href={proposal.proposalUrl} target="_blank" rel="noopener noreferrer">Read source ↗</a>}</>}
        panel={details?.renderPanel(proposal.id)}
        title={details ? <button type="button" className="dao-proposal-title proposal-title-toggle" aria-expanded={details.isRecordOpen(proposal.id)} aria-controls={`proposal-panel-${proposal.id}`} onClick={() => details.toggleRecord(proposal.id)}>{proposal.title}</button> : communityId && archiveRecordIds?.includes(proposal.id) ? <Link className="dao-proposal-title" href={`/communities/${encodeURIComponent(communityId)}/archives/${encodeURIComponent(proposal.id)}`}>{proposal.title}</Link> : <a className="dao-proposal-title" href={proposal.proposalUrl} target="_blank" rel="noopener noreferrer">{proposal.title}</a>}
        submittedAt={listing?.submitted ?? (inReview ? proposal.submittedAt : undefined)}
        applicant={listing?.applicant ?? (inReview ? `@${proposal.applicant}` : undefined)}
        decision={inReview ? undefined : proposal}
        checkedAt={source ? ZCG_SOURCE_CHECKED_AT : undefined}
        budget={<div className="dao-zcg-budget" data-approved={!!approvedBudget} role="group" aria-label={approvedBudget ? `Approved budget: ${formatProposalUsd(approvedBudget.usdCents)}` : budget ? `Requested budget: ${budget} USD` : outcome === "approved" ? budgetStatusText(budgetStatus) : "Amount not specified"}>
          {budget ? <div className="dao-zcg-budget-amount"><strong>{budget}</strong><span>USD{!approvedBudget ? " requested" : ""}</span></div> : <span>{outcome === "approved" ? budgetStatusText(budgetStatus) : "Amount not specified"}</span>}
          {approvedBudget ? <ProposalZecEstimate budget={approvedBudget} state={price} ledgerImportedAt={ledgerImportedAt} /> : null}
        </div>}
      >
      {inReview ? outcome === "under_review" ? <PendingCommitteeCard /> : <div className="dao-zcg-review-state"><span>{outcome === "abandoned" ? "Withdrawn by the applicant on GitHub" : "Closed or decided on GitHub · See source"}</span></div> : <PublishedDecisionCard decision={proposal} selection={feedback?.proposalId === proposal.id ? feedback : null} onSelectionChange={selection => setFeedback(selection ? { ...selection, proposalId: proposal.id } : null)} />}
      {renderReview?.(proposal.id)}
    </ProposalCard>; })}</ul>
    {resultCount === 0 ? <div className="dao-empty-state"><p>{search.query.trim() || search.category !== "all" ? "No proposals match these filters." : filter === "abandoned" ? "No withdrawn proposals." : "No matching proposals."}</p></div> : null}
    </div>
    <details className="dao-zcg-method"><summary>Sources & methodology</summary>{replaceReviewQueue ? <p>The Under review list uses the same published proposal queue as <a href="/zcg/proposals?status=under_review">Proposals</a>. GitHub is checked every five minutes; this board refreshes every minute. New applications appear before source import. Discussions and verification open after import; automatic anchoring requires the official review labels. Current listing details do not replace preserved archive files.</p> : null}<p><strong>Labels & categories last checked:</strong> <time dateTime={ZCG_SOURCE_CHECKED_AT}>{dateFormat.format(new Date(ZCG_SOURCE_CHECKED_AT))}</time>.</p><p>Applications were captured on {dateFormat.format(new Date(ZCG_REVIEW_CHECKED_AT))}. GitHub labels and applicant categories are cross-checked with the <a href="https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues" target="_blank" rel="noopener noreferrer">official ZCG tracker ↗</a>. Terminal labels override a leftover review label in this list. These are dated snapshots; follow each source for updates.</p><p>GitHub labels retain their original names and colors. The current status stays visible; additional workflow labels are under “+ labels”. Sectors combine the applicant’s category with OpenZcash classification; hover a sector for its origin. Local committee annotations appear separately. Updating source metadata does not rewrite preserved files, create a pilot decision or confirm a payment.</p><p>The five historical examples were checked on October 9, 2026. Decisions from the October 12 meeting were cross-checked on October 14 by exact GitHub issue and forum topic. The minutes explicitly record unanimous votes; a missing individual comment is identified as such. Asynchronous decisions retain their earlier spreadsheet dates. These annotations do not rewrite archived revisions or establish a blockchain proof. Approved budgets come from the official ZCG spreadsheet, summing all grant milestones. The shared ledger imports automatically every six hours; this board checks for imported changes every minute. Only unambiguous official matches receive an estimate; other amounts remain requests. ZEC estimates convert the entire approved budget at the CoinGecko price, refreshed hourly and valid for at most one hour or until UTC midnight, whichever comes first. They exclude fees and do not deduct previous payments. Each payment uses its payment-day rate; a market estimate is not a payment record.</p><p>Feedback is a summary of published minutes. Local likes and comments do not change committee votes. Public profile images come from <a href="https://openzcash.org/zcg/committee" target="_blank" rel="noopener noreferrer">OpenZcash’s committee directory ↗</a>.</p></details>
  </div>;
}
