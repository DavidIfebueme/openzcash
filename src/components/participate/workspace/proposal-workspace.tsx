"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OPEN_COMMENT_EVENT, type CommentDestination } from "@/lib/participate/workspace/domain/discussion-notifications";
import { WorkspaceFrame, type WorkspaceFrameProps } from "@/components/participate/workspace/community-workspace";
import { ZcgProposalExamples, type ProposalListItem } from "@/components/participate/workspace/zcg-proposal-examples";
import { ProposalEconomyProvider, ProposalEconomyNotice, ProposalEngagement } from "@/components/participate/workspace/proposal-economy";
import { ProposalInlineDetails, type ProposalPanel } from "@/components/participate/workspace/proposal-inline-details";
import { ZCG_PROPOSAL_EXAMPLES } from "@/lib/participate/workspace/data/zcg-proposal-examples";
import { ZCG_REVIEW_PROPOSALS } from "@/lib/participate/workspace/data/zcg-review-proposals";
import type { ProposalParticipation, ProposalParticipationBoard } from "@/lib/participate/workspace/domain/proposal-participation";
import { ParticipateTour } from "@/components/participate/workspace/participate-tour";
import type { SubmissionDraft } from "@/lib/participate/workspace/domain/proposal-submission";
import { AbandonmentNotice, SubmissionLifecycleAction } from "@/components/participate/workspace/submission-lifecycle";

import { zcgApprovedBudget, type ApprovedBudgetSnapshot } from "@/lib/participate/workspace/data/zcg-approved-budgets";
import { formatProposalUsd } from "@/lib/participate/workspace/domain/proposal-funding";
import { ProposalZecEstimate, useProposalZecPrice } from "@/components/participate/workspace/proposal-zec-estimate";
import { useOfficialProposals } from "./official-proposals";
import { OfficialReviewQueue, reviewProposalMatches } from "./official-review-queue";
import { officialIssueNumber, type OfficialProposalSnapshot, type ParticipateProposalOutcome } from "@/lib/participate/official-proposals-model";
import { zcgSourceMetadata } from "@/lib/participate/workspace/data/zcg-source-metadata";
import { useApprovedProposalBudgets, budgetStatusText } from "./approved-proposal-budgets";
import { ProposalScreeningNote } from "./proposal-screening-note";
import { PUBLISHED_COMMITTEE_DECISIONS, publishedDecisionForIssue } from "@/lib/zcg/committee-minutes";
import { matchesProposalFilters, proposalSectors, type ProposalFilters } from "@/lib/participate/workspace/domain/proposal-filters";
import { ProposalCard } from "./proposal-card";
import { PublishedDecisionCard } from "./published-decision-card";
import { SignedReviewCard } from "./signed-review-card";
import { PendingCommitteeCard } from "./pending-committee-card";

const requestedDollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 });

function proposalFilter(proposal?: ProposalParticipation) {
  return proposal?.sourceCapture?.proposal.outcome ?? (proposal?.abandonment ? "abandoned" : "under_review");
}

/** A recaptured curated record keeps its published vote; callers still drop one whose outcome changed. */
function committeeDecision(recordId: string, sourceUrl: string | null | undefined) {
  return publishedDecisionForIssue(sourceUrl) ?? ZCG_PROPOSAL_EXAMPLES.find(example => example.id === recordId) ?? null;
}

export function ProposalWorkspace({ community, communities, viewer, board, initialProfile, initialCreditSummary, embedded = false, drafts = [], draftsUnavailable = false, initialRecordId, initialCommentId, initialBudgets = null, initialOfficialProposals = null }: Omit<WorkspaceFrameProps, "children"> & { board: ProposalParticipationBoard; drafts?: SubmissionDraft[]; draftsUnavailable?: boolean; initialRecordId?: string; initialCommentId?: string; initialBudgets?: ApprovedBudgetSnapshot | null; initialOfficialProposals?: OfficialProposalSnapshot | null }) {
  const [panels, setPanels] = useState<Record<string, ProposalPanel | null>>(initialRecordId ? { [initialRecordId]: initialCommentId ? "discussion" : "record" } : {});
  const [commentTarget, setCommentTarget] = useState({ recordId: initialRecordId, id: initialCommentId, request: 0 });
  useEffect(() => {
    function openComment(event: Event) {
      const target = (event as CustomEvent<CommentDestination>).detail;
      if (target?.communityId !== community.id || typeof target.commentId !== "string" || !board.proposals.some(proposal => proposal.recordId === target.recordId)) return;
      event.preventDefault();
      setPanels(previous => ({ ...previous, [target.recordId]: "discussion" }));
      setCommentTarget(previous => ({ recordId: target.recordId, id: target.commentId, request: previous.request + 1 }));
    }
    window.addEventListener(OPEN_COMMENT_EVENT, openComment);
    return () => window.removeEventListener(OPEN_COMMENT_EVENT, openComment);
  }, [community.id, board.proposals]);
  const officialState = useOfficialProposals(initialOfficialProposals, embedded);
  const official = officialState.snapshot;
  const officialByIssue = new Map(official?.proposals.map(row => [row.issueNumber, row]));
  const officialRecords = new Map<number, ProposalParticipation>();
  const officialOutcomes: Record<string, ParticipateProposalOutcome> = {};
  for (const record of board.proposals) {
    const source = record.sourceCapture?.source ?? zcgSourceMetadata(record.recordId);
    const issue = source ? officialIssueNumber(source.url) : /^zcg-github-([1-9]\d*)$/.test(record.recordId) ? Number(record.recordId.slice(11)) : null;
    if (!issue) continue;
    officialRecords.set(issue, record);
    const current = officialByIssue.get(issue);
    // An explicit author withdrawal is not a committee rejection, even when
    // the spreadsheet groups it under Rejected. Keep the source label visible.
    if (source?.labels.some(label => label.name === "Grant Withdrawn by Submitter")) {
      officialOutcomes[record.recordId] = "abandoned";
      if (current) officialByIssue.set(issue, { ...current, outcome: "abandoned" });
    } else if (current) officialOutcomes[record.recordId] = current.outcome;
  }
  const officialListings = [...officialByIssue.values()];
  const officialRecordIds = new Set([...officialRecords.values()].map(record => record.recordId));
  const currentFilter = (proposal?: ProposalParticipation) => (proposal && officialOutcomes[proposal.recordId]) ?? proposalFilter(proposal);
  const ids = board.proposals.map(proposal => proposal.recordId);
  const examples = [...ZCG_REVIEW_PROPOSALS, ...ZCG_PROPOSAL_EXAMPLES].filter(proposal => ids.includes(proposal.id) && !board.proposals.find(row => row.recordId === proposal.id)?.sourceCapture);
  // A published decision can be browsed before its archive exists, but gets no
  // invented discussion or verification controls. Imported records stay unique.
  for (const decision of PUBLISHED_COMMITTEE_DECISIONS) {
    if (!ids.includes(decision.id) && officialByIssue.get(decision.issueNumber)?.outcome === decision.outcome) examples.push(decision);
  }
  examples.sort((a, b) => (b.outcome === "under_review" ? b.submittedAt : b.decisionDate).localeCompare(a.outcome === "under_review" ? a.submittedAt : a.decisionDate));
  const other = board.proposals.filter(proposal => !examples.some(example => example.id === proposal.recordId));
  const budgetState = useApprovedProposalBudgets(initialBudgets);
  const approvedBudgets = budgetState.snapshot?.budgets ?? {};
  const ledgerImportedAt = budgetState.snapshot?.importedAt;
  const price = useProposalZecPrice(Object.keys(approvedBudgets).length > 0);
  function toggle(recordId: string, panel: ProposalPanel) { setPanels(previous => ({ ...previous, [recordId]: previous[recordId] === panel ? null : panel })); }
  function close(recordId: string) {
    const trigger = document.getElementById(`proposal-${panels[recordId] === "discussion" ? "comments" : "read"}-${recordId}`);
    setPanels(previous => ({ ...previous, [recordId]: null }));
    trigger?.focus({ preventScroll: true });
  }
  const renderPanel = (recordId: string) => <ProposalInlineDetails communityId={community.id} recordId={recordId} active={panels[recordId] ?? null} sessionKey={viewer?.nick ?? "guest"} focusComment={commentTarget.recordId === recordId && commentTarget.id ? { id: commentTarget.id, request: commentTarget.request } : undefined} onClose={() => close(recordId)} preview={{ commentCount: board.proposals.find(proposal => proposal.recordId === recordId)?.commentCount ?? 0, canParticipate: board.canParticipate, participation: board.participation }} />;
  const renderActions = (recordId: string) => <ProposalEngagement recordId={recordId} onToggleComments={() => toggle(recordId, "discussion")} commentsOpen={panels[recordId] === "discussion"} />;
  const toolbar = embedded ? <div className="participate-submission-actions">{drafts.length ? <details className="participate-submission-menu"><summary>My proposals <span>{drafts.length}</span></summary><nav aria-label="My proposals">{drafts.map(draft => <div className="participate-submission-menu-item" key={draft.id}><Link href={draft.state === "DRAFT" ? `/zcg/participate?compose=${draft.id}` : `/zcg/participate?record=${draft.recordId}`}><span>{draft.payload.title || "Untitled proposal"}</span><small>{draft.state === "DRAFT" ? "Draft" : draft.state === "ABANDONED" ? "Abandoned" : draft.state === "PUBLISHED_DEMO" ? "Legacy test" : "Published"}</small></Link>{draft.state === "DRAFT" ? <SubmissionLifecycleAction draft={draft} /> : null}</div>)}</nav></details> : null}<Link href="/zcg/participate?compose=new" prefetch={false} className="dao-button dao-button--primary">+ New proposal</Link></div> : null;
  const nativeRecords = (filter: string, search?: ProposalFilters) => other.filter(proposal => {
    if (currentFilter(proposal) !== filter || (official && filter === "under_review" && officialRecordIds.has(proposal.recordId))) return false;
    const captured = proposal.sourceCapture;
    const source = captured?.source ?? zcgSourceMetadata(proposal.recordId);
    const title = captured?.proposal.title ?? proposal.title;
    return matchesProposalFilters({ title, recordId: proposal.recordId, issueNumber: officialIssueNumber(source?.url),
      applicant: captured?.proposal.applicant ?? proposal.application?.applicant,
      sectors: proposalSectors(title, captured?.proposal.tags ?? [], proposal.sourceCategory ?? source?.category) }, search);
  });
  const reviewCount = (search?: ProposalFilters) => officialListings.filter(proposal => proposal.outcome === "under_review" && reviewProposalMatches(proposal, officialRecords.get(proposal.issueNumber), search)).length;
  const additionalRecords = (filter: string, search: ProposalFilters) => official && filter === "under_review" ? <OfficialReviewQueue communityId={community.id} search={search} proposals={officialListings} records={officialRecords} renderActions={renderActions} renderPanel={renderPanel} isOpen={recordId => panels[recordId] === "record"} toggle={recordId => toggle(recordId, "record")} /> : null;
  // Imported records join the curated cards in one list ordered by decision date.
  const additionalCards = (filter: string, search: ProposalFilters) => nativeRecords(filter, search).map((proposal): ProposalListItem => {
      const mine = drafts.find(draft => draft.recordId === proposal.recordId);
      const captured = proposal.sourceCapture;
      const outcome = currentFilter(proposal);
      const source = captured?.source ?? zcgSourceMetadata(proposal.recordId);
      const issue = source ? officialIssueNumber(source.url) : null;
      const listing = issue ? officialByIssue.get(issue) : undefined;
      const published = committeeDecision(proposal.recordId, source?.url);
      const decision = published?.outcome === outcome ? published : undefined;
      const submittedAt = captured?.proposal.submittedAt ?? proposal.application?.submittedAt;
      const requestedUsd = proposal.application ? Number(proposal.application.requestedAmountUsd) : captured && outcome !== "approved" ? proposal.sourceRequestedUsd ?? captured.proposal.requestedUsd : null;
      const requestedBudget = requestedUsd == null ? null : requestedDollars.format(requestedUsd);
      const approvedBudget = outcome === "approved" ? zcgApprovedBudget(approvedBudgets, proposal.recordId, captured?.source) : null;
      return { key: proposal.recordId, sortDate: decision?.decisionDate ?? submittedAt ?? listing?.submitted ?? "", card: <ProposalCard recordId={proposal.recordId}
        labels={{ title: captured?.proposal.title ?? proposal.title, tags: captured?.proposal.tags ?? [], sourceOverride: captured?.source ?? null, categoryOverride: proposal.sourceCategory, outcome, committeeLabels: proposal.labels }}
        engagement={renderActions(proposal.recordId)}
        actions={<button id={`proposal-read-${proposal.recordId}`} type="button" className="dao-text-button proposal-read-toggle" aria-expanded={panels[proposal.recordId] === "record"} aria-controls={`proposal-panel-${proposal.recordId}`} onClick={() => toggle(proposal.recordId, "record")}>Read & verify <span className="proposal-disclosure-arrow" aria-hidden="true">⌄</span></button>}
        panel={<>{mine && !proposal.abandonment ? <SubmissionLifecycleAction draft={mine} /> : null}{renderPanel(proposal.recordId)}</>}
          title={<button type="button" className="dao-proposal-title proposal-title-toggle" aria-expanded={panels[proposal.recordId] === "record"} aria-controls={`proposal-panel-${proposal.recordId}`} onClick={() => toggle(proposal.recordId, "record")}>{captured?.proposal.title ?? proposal.title}</button>}
          submittedAt={submittedAt}
          applicant={captured ? `@${captured.proposal.applicant}` : proposal.application ? `${proposal.application.publication === "COMMUNITY_PUBLICATION" ? "Community proposal" : "Legacy test proposal"} · ${proposal.application.applicant}` : undefined}
          decision={decision}
          checkedAt={captured?.checkedAt}
          budget={approvedBudget ? <div className="dao-zcg-budget" data-approved role="group" aria-label={`Approved budget: ${formatProposalUsd(approvedBudget.usdCents)}`}><div className="dao-zcg-budget-amount"><strong>{formatProposalUsd(approvedBudget.usdCents).replace(" USD", "").replace(/\.00$/, "")}</strong><span>USD</span></div><ProposalZecEstimate budget={approvedBudget} state={price} ledgerImportedAt={ledgerImportedAt} /></div> : outcome === "approved" ? <div className="dao-zcg-budget" role="status">{budgetStatusText(budgetState.status)}</div> : requestedBudget !== null ? <div className="dao-zcg-budget" data-approved={false} role="group" aria-label={`Requested budget: ${requestedBudget} USD`}><div className="dao-zcg-budget-amount"><strong>{requestedBudget}</strong><span>USD requested</span></div></div> : <div className="dao-zcg-budget"><span>Amount not specified</span></div>}
        >
        {outcome === "filtered" && listing ? <ProposalScreeningNote listing={listing} source={source ?? undefined} /> : null}
        {decision ? <PublishedDecisionCard decision={decision} /> : null}
        <SignedReviewCard review={proposal.review} communityId={community.id} recordId={proposal.recordId} />
        {issue && outcome === "under_review" ? <PendingCommitteeCard /> : null}
        {proposal.abandonment ? <AbandonmentNotice value={proposal.abandonment} endpoint={`/api/communities/${encodeURIComponent(community.id)}/archives/${encodeURIComponent(proposal.recordId)}`} /> : null}
      </ProposalCard> };
    });
  return <WorkspaceFrame community={community} communities={communities} viewer={viewer} workspaceModule="proposals" creditScope={board.participation?.creditScope} initialProfile={initialProfile} initialCreditSummary={initialCreditSummary} embedded={embedded}>
    <ProposalEconomyProvider communityId={community.id} initial={board}>
      <h1 className="dao-sr-only">Proposals</h1>
      {embedded ? <ParticipateTour signedIn={Boolean(viewer)} canUseCredits={Boolean(viewer && viewer.canEditProfile !== false)} /> : null}
      <ProposalEconomyNotice />
      {officialState.unavailable ? <p className="proposal-economy-warning" role="status">Proposal updates are temporarily unavailable. Showing the last available list.</p> : null}
      {draftsUnavailable ? <p className="proposal-economy-warning" role="status">Your proposals and drafts could not be loaded. <a className="dao-text-button" href="/zcg/participate">Try again</a></p> : null}
      {ids.length || official ? <ZcgProposalExamples officialProposals={officialListings} officialOutcomes={officialOutcomes} replaceReviewQueue={Boolean(official)} ledgerImportedAt={ledgerImportedAt} approvedBudgets={approvedBudgets} budgetStatus={budgetState.status} price={price} filterResetKey={commentTarget.request} filterTarget={commentTarget.recordId ? { recordId: commentTarget.recordId, fallback: currentFilter(board.proposals.find(row => row.recordId === commentTarget.recordId)) } : undefined} committeeLabels={Object.fromEntries(board.proposals.map(row => [row.recordId, row.labels ?? []]))} proposals={examples} communityId={community.id} archiveRecordIds={ids} renderActions={renderActions} renderReview={recordId => <SignedReviewCard review={board.proposals.find(row => row.recordId === recordId)?.review} communityId={community.id} recordId={recordId} />} toolbar={toolbar} additionalRecords={additionalRecords} additionalCards={additionalCards} additionalCount={(filter, search) => nativeRecords(filter, search).length + (filter === "under_review" ? reviewCount(search) : 0)} inline={{ isRecordOpen: recordId => panels[recordId] === "record", toggleRecord: recordId => toggle(recordId, "record"), renderPanel }} /> : toolbar}
      {!ids.length && !official ? <div className="dao-empty-state"><p>No public proposals yet.</p><Link href="/zcg/participate?view=history" className="dao-text-button">View decision history →</Link></div> : null}
    </ProposalEconomyProvider>
  </WorkspaceFrame>;
}
