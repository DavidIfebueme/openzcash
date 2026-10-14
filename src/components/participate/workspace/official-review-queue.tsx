"use client";
import { useState, type ReactNode } from "react";
import { zcgSourceMetadata } from "@/lib/participate/workspace/data/zcg-source-metadata";
import { matchesProposalFilters, proposalSectors, type ProposalFilters } from "@/lib/participate/workspace/domain/proposal-filters";
import type { OfficialProposalListing } from "@/lib/participate/official-proposals-model";
import type { ProposalParticipation } from "@/lib/participate/workspace/domain/proposal-participation";
import { ZCG_REVIEW_PROPOSALS } from "@/lib/participate/workspace/data/zcg-review-proposals";
import { ProposalCard } from "./proposal-card";
import { GitHubComments } from "./github-comments";
import { PendingCommitteeCard } from "./pending-committee-card";

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function reviewProposalMatches(proposal: OfficialProposalListing, record: ProposalParticipation | undefined, search?: ProposalFilters) {
  const recordId = record?.recordId ?? `zcg-github-${proposal.issueNumber}`;
  const source = record?.sourceCapture?.source ?? zcgSourceMetadata(recordId);
  const tags = record?.sourceCapture?.proposal.tags ?? ZCG_REVIEW_PROPOSALS.find(row => row.id === recordId)?.tags ?? [];
  return matchesProposalFilters({ title: proposal.title, applicant: proposal.applicant, recordId, issueNumber: proposal.issueNumber,
    sectors: proposalSectors(proposal.title, tags, record?.sourceCategory ?? source?.category) }, search);
}

export function OfficialReviewQueue({ proposals, records, search, renderActions, renderPanel, isOpen, toggle }: {
  proposals: readonly OfficialProposalListing[];
  search?: ProposalFilters;
  records: ReadonlyMap<number, ProposalParticipation>;
  renderActions: (recordId: string) => ReactNode;
  renderPanel: (recordId: string) => ReactNode;
  isOpen: (recordId: string) => boolean;
  toggle: (recordId: string) => void;
}) {
  const [openSource, setOpenSource] = useState<number | null>(null);
  return <ul className="dao-proposal-list dao-zcg-list" aria-label="Official ZCG review queue">
    {proposals.filter(proposal => proposal.outcome === "under_review" && reviewProposalMatches(proposal, records.get(proposal.issueNumber), search)).map(proposal => {
      const record = records.get(proposal.issueNumber);
      const recordId = record?.recordId ?? `zcg-github-${proposal.issueNumber}`;
      return <ProposalCard key={proposal.issueNumber} recordId={recordId} officialIssue={proposal.issueNumber}
        labels={{ title: proposal.title, tags: record?.sourceCapture?.proposal.tags ?? ZCG_REVIEW_PROPOSALS.find(row => row.id === recordId)?.tags ?? [], outcome: "under_review", committeeLabels: record?.labels, sourceOverride: record?.sourceCapture?.source, categoryOverride: record?.sourceCategory }}
        engagement={record ? renderActions(recordId) : <span className="dao-zcg-record-label" title="Discussions and verification become available after the source archive is imported.">Awaiting source import</span>}
        actions={<><a className="dao-text-button" href={proposal.url} target="_blank" rel="noopener noreferrer">Source ↗</a>
          {record ? <button id={`proposal-read-${recordId}`} type="button" className="dao-text-button proposal-read-toggle" aria-expanded={isOpen(recordId)} aria-controls={`proposal-panel-${recordId}`} onClick={() => toggle(recordId)}>Read & verify <span className="proposal-disclosure-arrow" aria-hidden="true">⌄</span></button> : <button type="button" className="dao-text-button" aria-expanded={openSource === proposal.issueNumber} aria-controls={`github-comments-${proposal.issueNumber}`} onClick={() => setOpenSource(value => value === proposal.issueNumber ? null : proposal.issueNumber)}>GitHub comments <span aria-hidden="true">⌄</span></button>}
        </>}
        panel={record ? renderPanel(recordId) : openSource === proposal.issueNumber ? <div id={`github-comments-${proposal.issueNumber}`}><GitHubComments issueNumber={proposal.issueNumber} visible /></div> : null}
          title={record
              ? <button type="button" className="dao-proposal-title proposal-title-toggle" aria-expanded={isOpen(recordId)} aria-controls={`proposal-panel-${recordId}`} onClick={() => toggle(recordId)}>{proposal.title}</button>
              : <a className="dao-proposal-title" href={proposal.url} target="_blank" rel="noopener noreferrer">{proposal.title}</a>}
          submittedAt={proposal.submitted}
          applicant={proposal.applicant}
          checkedAt={record?.sourceCapture?.checkedAt}
          budget={<div className="dao-zcg-budget" role="group" aria-label={proposal.requestedUsd === null ? "Amount not specified" : `Requested budget: ${dollars.format(proposal.requestedUsd)} USD`}>
            {proposal.requestedUsd === null ? <span>Amount not specified</span> : <div className="dao-zcg-budget-amount"><strong>{dollars.format(proposal.requestedUsd)}</strong><span>USD requested</span></div>}
          </div>}
        >
        <PendingCommitteeCard />
      </ProposalCard>;
    })}
  </ul>;
}
