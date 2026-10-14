"use client";

import Image from "next/image";
import Link from "next/link";
import { PUBLISHED_COMMITTEE_DECISIONS } from "@/lib/zcg/committee-minutes";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { ZcgProposalLabels } from "@/components/participate/workspace/zcg-proposal-labels";
import { ZCG_EXAMPLE_MEMBERS, summarizeZcgVotes, summarizeZcgParticipation, type ZcgMemberId, type ZcgProposalExample } from "@/lib/participate/workspace/data/zcg-proposal-examples";
import { ZCG_REVIEW_CHECKED_AT } from "@/lib/participate/workspace/data/zcg-review-proposals";
import type { ZcgReviewProposal } from "@/lib/participate/workspace/domain/zcg-review";
import { zcgSourceMetadata, ZCG_SOURCE_CHECKED_AT } from "@/lib/participate/workspace/data/zcg-source-metadata";
import { githubProposalOutcome } from "@/lib/participate/workspace/domain/zcg-source-metadata";
import { zcgApprovedBudget, type ApprovedBudgetMap, type ApprovedBudgetStatus } from "@/lib/participate/workspace/data/zcg-approved-budgets";
import { formatProposalUsd } from "@/lib/participate/workspace/domain/proposal-funding";
import { ProposalZecEstimate, type PriceState } from "@/components/participate/workspace/proposal-zec-estimate";

import { budgetStatusText } from "./approved-proposal-budgets";
import { PendingCommitteeCard } from "./pending-committee-card";

const voteLabels = { approve: "Approve", reject: "Reject", abstain: "Abstain" };
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

type FeedbackSelection = { memberId: ZcgMemberId; pinned: boolean };

export function ZcgVoteBar({ proposal, selection: controlledSelection, onSelectionChange, showSummary = true }: { proposal: ZcgProposalExample; selection?: FeedbackSelection | null; onSelectionChange?: (selection: FeedbackSelection | null) => void; showSummary?: boolean }) {
  const [localSelection, setLocalSelection] = useState<FeedbackSelection | null>(null);
  const selection = controlledSelection === undefined ? localSelection : controlledSelection;
  const setSelection = onSelectionChange ?? setLocalSelection;
  const active = selection?.memberId;
  const pinned = selection?.pinned;
  const root = useRef<HTMLDivElement>(null);
  const feedbackPanel = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState({ side: "below", maxHeight: 400 });
  const popoverId = useId();
  const counts = summarizeZcgVotes(proposal.votes);
  const selected = proposal.votes.find(vote => vote.memberId === active);
  const selectedMember = selected ? ZCG_EXAMPLE_MEMBERS[selected.memberId] : null;

  useLayoutEffect(() => {
    if (!active) return;
    function position() {
      if (!root.current || !feedbackPanel.current) return;
      const bounds = root.current.getBoundingClientRect();
      const above = bounds.top - 12;
      const below = window.innerHeight - bounds.bottom - 12;
      const side = below < feedbackPanel.current.scrollHeight + 2 && above > below ? "above" : "below";
      const maxHeight = Math.max(1, side === "above" ? above : below);
      setPlacement(previous => previous.side === side && previous.maxHeight === maxHeight ? previous : { side, maxHeight });
    }
    position();
    window.addEventListener("resize", position);
    document.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      document.removeEventListener("scroll", position, true);
    };
  }, [active, selected?.summary]);

  useEffect(() => {
    if (!active) return;
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) { setSelection(null); }
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [active, setSelection]);

  function close(restoreFocus = false) {
    if (restoreFocus && active) root.current?.querySelector<HTMLButtonElement>(`[data-member="${active}"]`)?.focus();
    setSelection(null);
  }

  return <div ref={root} className="dao-zcg-votes" onMouseLeave={() => { if (!pinned) setSelection(null); }} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) close();
  }} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); close(true); } }}>
    <div className={showSummary ? "dao-zcg-vote-summary" : "dao-sr-only"}>
      {showSummary ? <div className="dao-zcg-support"><strong>{counts.supportPercent === null ? "—" : `${counts.supportPercent}%`}</strong><span>support <span className="dao-zcg-denominator">· {counts.approve} of {counts.total}</span></span></div> : null}
      <div className="dao-zcg-legend" aria-label={`${counts.approve} approve, ${counts.reject} reject, ${counts.abstain} abstain`}>
        <span data-vote="approve">{counts.approve} approve</span><span data-vote="reject">{counts.reject} reject</span>{counts.abstain > 0 ? <span data-vote="abstain">{counts.abstain} abstain</span> : null}
      </div>
    </div>
    <div className="dao-zcg-vote-rail" role="group" aria-label="Committee votes and feedback">
      {proposal.votes.map(vote => {
        const member = ZCG_EXAMPLE_MEMBERS[vote.memberId];
        return <button key={vote.memberId} type="button" className="dao-zcg-voter" data-member={vote.memberId} data-vote={vote.vote} aria-label={`${member.name}: ${voteLabels[vote.vote]}${vote.basis === "unanimous" ? " via unanimous record" : ""}. Read feedback`} aria-expanded={active === vote.memberId} aria-controls={active === vote.memberId ? popoverId : undefined} onMouseEnter={() => { if (!pinned) setSelection({ memberId: vote.memberId, pinned: false }); }} onFocus={() => setSelection({ memberId: vote.memberId, pinned: false })} onClick={() => active === vote.memberId && pinned ? close() : setSelection({ memberId: vote.memberId, pinned: true })}>
          <span className="dao-zcg-vote-segment" aria-hidden="true" />
          <span className="dao-zcg-voter-identity"><span className="dao-zcg-portrait"><Image src={member.avatar} alt="" width={40} height={40} /><span className="dao-zcg-vote-symbol" aria-hidden="true">{vote.vote === "approve" ? "✓" : vote.vote === "reject" ? "×" : "−"}</span></span><span>{member.shortName}{vote.basis === "unanimous" ? <small className="dao-zcg-vote-basis">Collective vote</small> : null}</span></span>
        </button>;
      })}
    </div>
    {selected && selectedMember ? <div ref={feedbackPanel} id={popoverId} className="dao-zcg-feedback" data-placement={placement.side} style={{ "--zcg-anchor": `${(proposal.votes.indexOf(selected) + 0.5) / proposal.votes.length * 100}%`, maxHeight: placement.maxHeight } as CSSProperties} role="dialog" aria-label={`${selectedMember.name}'s feedback`}>
      <div className="dao-zcg-feedback-heading"><strong>{selectedMember.name}</strong><span data-vote={selected.vote}>{voteLabels[selected.vote]}</span><button type="button" aria-label="Close feedback" onClick={() => close(true)}>×</button></div>
      <p>{selected.summary}</p>
      <div className="dao-zcg-feedback-source"><span>{selected.basis === "unanimous" ? "Unanimous vote record" : "From the minutes · Summary"}</span><a href={selected.basis === "unanimous" ? proposal.voteEvidenceUrl ?? proposal.minutesUrl : proposal.minutesUrl} target="_blank" rel="noopener noreferrer">Read source ↗</a></div>
    </div> : null}
  </div>;
}

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

export function ZcgProposalExamples({ officialOutcomes = {}, replaceReviewQueue = false, proposals, communityId, archiveRecordIds, renderActions, inline, toolbar, additionalRecords, additionalCount, committeeLabels = {}, filterResetKey = 0, filterTarget, ledgerImportedAt, approvedBudgets = {}, budgetStatus = "loading", price = { status: "loading", price: null } }: { officialOutcomes?: Record<string, ProposalFilter>; replaceReviewQueue?: boolean; ledgerImportedAt?: string; approvedBudgets?: ApprovedBudgetMap; budgetStatus?: ApprovedBudgetStatus; price?: PriceState; proposals: readonly ListedProposal[]; filterResetKey?: number; filterTarget?: { recordId: string; fallback: ProposalFilter }; committeeLabels?: Record<string, string[]>; communityId?: string; archiveRecordIds?: string[]; renderActions?: (recordId: string) => ReactNode; toolbar?: ReactNode; additionalRecords?: (filter: ProposalFilter) => ReactNode; additionalCount?: (filter: ProposalFilter) => number; inline?: { isRecordOpen: (recordId: string) => boolean; toggleRecord: (recordId: string) => void; renderPanel: (recordId: string) => ReactNode } }) {
  const [feedback, setFeedback] = useState<(FeedbackSelection & { proposalId: string }) | null>(null);
  const currentOutcome = (proposal: ListedProposal) => officialOutcomes[proposal.id] ?? listedFilter(proposal);
  const target = proposals.find(proposal => proposal.id === filterTarget?.recordId);
  const targetFilter = target ? currentOutcome(target) : filterTarget?.fallback ?? "under_review";
  const [selection, setSelection] = useState<{ filter: ProposalFilter; key: number; manual: boolean }>({ filter: targetFilter, key: filterResetKey, manual: false });
  const hasClosed = proposals.some(proposal => currentOutcome(proposal) === "closed") || (additionalCount?.("closed") ?? 0) > 0;
  const hasFiltered = proposals.some(proposal => currentOutcome(proposal) === "filtered") || (additionalCount?.("filtered") ?? 0) > 0;
  const selectedFilter = selection.key === filterResetKey && selection.manual ? selection.filter : targetFilter;
  const filter = (selectedFilter === "closed" && !hasClosed) || (selectedFilter === "filtered" && !hasFiltered) ? "under_review" : selectedFilter;
  const setFilter = (value: ProposalFilter) => setSelection({ filter: value, key: filterResetKey, manual: true });
  const filtered = proposals.filter(proposal => currentOutcome(proposal) === filter && !(replaceReviewQueue && filter === "under_review"));
  const publishedTarget = target && archiveRecordIds && !archiveRecordIds.includes(target.id) && !selection.manual ? target.id : null;
  useEffect(() => {
    // An unimported decision has no record panel to receive deep-link focus.
    if (publishedTarget) document.getElementById(`published-decision-${publishedTarget}`)?.focus();
  }, [publishedTarget]);
  return <div className="dao-zcg-examples">
    <div className="dao-proposal-tools" data-participate-tour="filters">
      <div className="dao-filter-list" aria-label="Filter proposals">{filters.filter(item => (item.value !== "closed" || hasClosed) && (item.value !== "filtered" || hasFiltered)).map(({ value, label }) => <button key={value} type="button" className={`dao-filter${filter === value ? " dao-filter--active" : ""}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      {toolbar}
    </div>
    {additionalRecords?.(filter)}
    <ul className="dao-proposal-list dao-zcg-list">{filtered.map(proposal => {
      const details = archiveRecordIds && !archiveRecordIds.includes(proposal.id) ? undefined : inline;
      const actions = archiveRecordIds && !archiveRecordIds.includes(proposal.id) ? undefined : renderActions;
      const inReview = proposal.outcome === "under_review";
      const outcome = currentOutcome(proposal);
      const published = inReview ? undefined : PUBLISHED_COMMITTEE_DECISIONS.find(decision => decision.id === proposal.id && decision.outcome === outcome);
      const approvedBudget = outcome === "approved" ? zcgApprovedBudget(approvedBudgets, proposal.id, published ? { issueNumber: published.issueNumber, url: published.issueUrl } : undefined) : null;
      const proposalDate = inReview ? proposal.submittedAt : `${proposal.decisionDate}T12:00:00Z`;
      const participation = inReview ? null : summarizeZcgParticipation(proposal.votes);
      const votes = inReview ? null : summarizeZcgVotes(proposal.votes);
      const budget = approvedBudget ? formatProposalUsd(approvedBudget.usdCents).replace(" USD", "").replace(/\.00$/, "") : outcome === "approved" || proposal.requestedUsd === null ? null : dollars.format(proposal.requestedUsd);
      return <li key={proposal.id} id={published ? `published-decision-${proposal.id}` : undefined} tabIndex={published ? -1 : undefined} className="dao-proposal-row dao-zcg-proposal">
      <div className="dao-proposal-card-heading dao-zcg-card-heading">
        <div className="dao-zcg-title-line">
          {participation && votes ? <div className="dao-zcg-title-score" data-outcome={outcome} role="group" aria-label={`Committee support: ${participation.supportPercent}%`} title={`${votes.approve} of ${participation.eligible} members approve · ${votes.reject} reject · ${votes.abstain} abstain`}><strong>{participation.supportPercent}%</strong></div> : null}
          <div className="dao-proposal-primary">
            <h2 className="dao-proposal-heading">{details ? <button type="button" className="dao-proposal-title proposal-title-toggle" aria-expanded={details.isRecordOpen(proposal.id)} aria-controls={`proposal-panel-${proposal.id}`} onClick={() => details.toggleRecord(proposal.id)}>{proposal.title}</button> : communityId && archiveRecordIds?.includes(proposal.id) ? <Link className="dao-proposal-title" href={`/communities/${encodeURIComponent(communityId)}/archives/${encodeURIComponent(proposal.id)}`}>{proposal.title}</Link> : <a className="dao-proposal-title" href={proposal.proposalUrl} target="_blank" rel="noopener noreferrer">{proposal.title}<span className="dao-zcg-external" aria-hidden="true"> ↗</span></a>}</h2>
            <div className="dao-proposal-created"><time dateTime={proposalDate}>{inReview ? "Submitted " : ""}{dateFormat.format(new Date(proposalDate))}</time>{inReview && outcome === "under_review" ? <><span aria-hidden="true">·</span><span>@{proposal.applicant}</span></> : null}{participation ? <><span aria-hidden="true">·</span><span className="dao-zcg-turnout" aria-label={`Committee turnout: ${participation.turnoutPercent}%, ${participation.recorded} of ${participation.eligible} members`} title="Turnout counts all recorded positions, including abstentions.">{participation.turnoutPercent}% turnout <span>· {participation.recorded}/{participation.eligible} members</span></span></> : null}</div>
          </div>
        </div>
        <div className="dao-zcg-budget" data-approved={!!approvedBudget} role="group" aria-label={approvedBudget ? `Approved budget: ${formatProposalUsd(approvedBudget.usdCents)}` : budget ? `Requested budget: ${budget} USD` : outcome === "approved" ? budgetStatusText(budgetStatus) : "Amount not specified"}>
          {budget ? <div className="dao-zcg-budget-amount"><strong>{budget}</strong><span>USD{!approvedBudget ? " requested" : ""}</span></div> : <span>{outcome === "approved" ? budgetStatusText(budgetStatus) : "Amount not specified"}</span>}
          {approvedBudget ? <ProposalZecEstimate budget={approvedBudget} state={price} ledgerImportedAt={ledgerImportedAt} /> : null}
        </div>
      </div>
      <ZcgProposalLabels recordId={proposal.id} title={proposal.title} tags={proposal.tags} committeeLabels={committeeLabels[proposal.id]} outcome={outcome} />
      {inReview ? outcome === "under_review" ? <PendingCommitteeCard /> : <div className="dao-zcg-review-state"><span>{outcome === "abandoned" ? "Withdrawn by the applicant on GitHub" : "Closed or decided on GitHub · See source"}</span><span>@{proposal.applicant}</span></div> : <ZcgVoteBar proposal={proposal} showSummary={false} selection={feedback?.proposalId === proposal.id ? feedback : null} onSelectionChange={selection => setFeedback(selection ? { ...selection, proposalId: proposal.id } : null)} />}
      {published ? <p className="proposal-published-decision-caption">Unanimous vote recorded in the October 12 minutes{published.decisionMode === "async" ? " · Voted asynchronously" : ""}. Select a member for published feedback.</p> : null}
      <div className="dao-proposal-card-footer" data-participate-tour={details ? "discussion" : undefined}>{actions ? actions(proposal.id) : <a className="dao-zcg-minutes" href={inReview ? proposal.proposalUrl : proposal.minutesUrl} target="_blank" rel="noopener noreferrer">{inReview ? "Application ↗" : "Meeting record ↗"}</a>}<div className="dao-zcg-record-actions">{inReview && actions ? <a className="dao-text-button" href={proposal.proposalUrl} target="_blank" rel="noopener noreferrer">Source ↗</a> : null}{details ? <button id={`proposal-read-${proposal.id}`} type="button" className="dao-text-button proposal-read-toggle" aria-expanded={details.isRecordOpen(proposal.id)} aria-controls={`proposal-panel-${proposal.id}`} onClick={() => details.toggleRecord(proposal.id)}>Read & verify <span className="proposal-disclosure-arrow" aria-hidden="true">⌄</span></button> : communityId && archiveRecordIds?.includes(proposal.id) ? <Link className="dao-text-button" href={`/communities/${encodeURIComponent(communityId)}/archives/${encodeURIComponent(proposal.id)}`}>Read & verify →</Link> : <span className="dao-zcg-record-label">{inReview ? "Committee review" : "Published decision"}</span>}</div></div>
      {details?.renderPanel(proposal.id)}
    </li>; })}</ul>
    {filtered.length === 0 && !additionalCount?.(filter) ? <div className="dao-empty-state"><p>{filter === "abandoned" ? "No withdrawn proposals." : "No matching proposals."}</p></div> : null}
    <details className="dao-zcg-method"><summary>Sources & methodology</summary>{replaceReviewQueue ? <p>The Under review list uses the same published proposal queue as <a href="/zcg/proposals?status=under_review">Proposals</a>. GitHub is checked every five minutes; this board refreshes every minute. New applications appear before source import. Discussions and verification open after import; automatic anchoring requires the official review labels. Current listing details do not replace preserved archive files.</p> : null}<p><strong>Labels & categories last checked:</strong> <time dateTime={ZCG_SOURCE_CHECKED_AT}>{dateFormat.format(new Date(ZCG_SOURCE_CHECKED_AT))}</time>.</p><p>Applications were captured on {dateFormat.format(new Date(ZCG_REVIEW_CHECKED_AT))}. GitHub labels and applicant categories are cross-checked with the <a href="https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues" target="_blank" rel="noopener noreferrer">official ZCG tracker ↗</a>. Terminal labels override a leftover review label in this list. These are dated snapshots; follow each source for updates.</p><p>GitHub labels retain their original names and colors. The current status stays visible; additional workflow labels are under “+ labels”. Sectors combine the applicant’s category with OpenZcash classification; hover a sector for its origin. Local committee annotations appear separately. Updating source metadata does not rewrite preserved files, create a pilot decision or confirm a payment.</p><p>The five historical examples were checked on October 9, 2026. Decisions from the October 12 meeting were cross-checked on October 14 by exact GitHub issue and forum topic. The minutes explicitly record unanimous votes; a missing individual comment is identified as such. Asynchronous decisions retain their earlier spreadsheet dates. These annotations do not rewrite archived revisions or establish a blockchain proof. Support is approvals divided by the five committee seats. Turnout is the share of members with a recorded position, including abstentions. Pending applications have no vote percentage. Approved budgets come from the official ZCG spreadsheet, summing all grant milestones. The shared ledger imports automatically every six hours; this board checks for imported changes every minute. Only unambiguous official matches receive an estimate; other amounts remain requests. ZEC estimates convert the entire approved budget at the CoinGecko price, refreshed hourly and valid for at most one hour or until UTC midnight, whichever comes first. They exclude fees and do not deduct previous payments. Each payment uses its payment-day rate; a market estimate is not a payment record.</p><p>Feedback is a summary of published minutes. Local likes and comments do not change committee votes. Public profile images come from <a href="https://openzcash.org/zcg/committee" target="_blank" rel="noopener noreferrer">OpenZcash’s committee directory ↗</a>.</p></details>
  </div>;
}
