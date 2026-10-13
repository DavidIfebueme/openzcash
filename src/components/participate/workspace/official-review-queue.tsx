"use client";
import { useState, type ReactNode } from "react";
import type { OfficialProposalListing } from "@/lib/participate/official-proposals-model";
import type { ProposalParticipation } from "@/lib/participate/workspace/domain/proposal-participation";
import { ZCG_REVIEW_PROPOSALS } from "@/lib/participate/workspace/data/zcg-review-proposals";
import { ZcgProposalLabels } from "./zcg-proposal-labels";
import { GitHubComments } from "./github-comments";

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const dates = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function OfficialReviewQueue({ proposals, records, renderActions, renderPanel, isOpen, toggle }: {
  proposals: readonly OfficialProposalListing[];
  records: ReadonlyMap<number, ProposalParticipation>;
  renderActions: (recordId: string) => ReactNode;
  renderPanel: (recordId: string) => ReactNode;
  isOpen: (recordId: string) => boolean;
  toggle: (recordId: string) => void;
}) {
  const [openSource, setOpenSource] = useState<number | null>(null);
  return <ul className="dao-proposal-list dao-zcg-list" aria-label="Official ZCG review queue">
    {proposals.filter(proposal => proposal.outcome === "under_review").map(proposal => {
      const record = records.get(proposal.issueNumber);
      const recordId = record?.recordId ?? `zcg-github-${proposal.issueNumber}`;
      const submitted = proposal.submitted ? new Date(`${proposal.submitted.slice(0, 10)}T12:00:00Z`) : null;
      return <li key={proposal.issueNumber} className="dao-proposal-row dao-zcg-proposal" data-official-issue={proposal.issueNumber}>
        <div className="dao-proposal-card-heading dao-zcg-card-heading">
          <div className="dao-proposal-primary">
            <h2 className="dao-proposal-heading">{record
              ? <button type="button" className="dao-proposal-title proposal-title-toggle" aria-expanded={isOpen(recordId)} aria-controls={`proposal-panel-${recordId}`} onClick={() => toggle(recordId)}>{proposal.title}</button>
              : <a className="dao-proposal-title" href={proposal.url} target="_blank" rel="noopener noreferrer">{proposal.title}</a>}</h2>
            <div className="dao-proposal-created">{submitted && Number.isFinite(+submitted) ? <time dateTime={proposal.submitted}>Submitted {dates.format(submitted)}</time> : null}{proposal.applicant ? <><span aria-hidden="true">·</span><span>{proposal.applicant}</span></> : null}</div>
          </div>
          <div className="dao-zcg-budget" role="group" aria-label={proposal.requestedUsd === null ? "Amount not specified" : `Requested budget: ${dollars.format(proposal.requestedUsd)} USD`}>
            {proposal.requestedUsd === null ? <span>Amount not specified</span> : <div className="dao-zcg-budget-amount"><strong>{dollars.format(proposal.requestedUsd)}</strong><span>USD requested</span></div>}
          </div>
        </div>
        <ZcgProposalLabels recordId={recordId} title={proposal.title} tags={record?.sourceCapture?.proposal.tags ?? ZCG_REVIEW_PROPOSALS.find(row => row.id === recordId)?.tags ?? []} outcome="under_review" committeeLabels={record?.labels} sourceOverride={record?.sourceCapture?.source} categoryOverride={record?.sourceCategory} />
        <div className="dao-proposal-card-footer">
          {record ? renderActions(recordId) : <span className="dao-zcg-record-label" title="Listed from the official proposal queue. Discussions and verification become available after the source archive is imported.">Awaiting source import</span>}
          <div className="dao-zcg-record-actions"><a className="dao-text-button" href={proposal.url} target="_blank" rel="noopener noreferrer">Source ↗</a>
            {record ? <button id={`proposal-read-${recordId}`} type="button" className="dao-text-button proposal-read-toggle" aria-expanded={isOpen(recordId)} aria-controls={`proposal-panel-${recordId}`} onClick={() => toggle(recordId)}>Read & verify <span className="proposal-disclosure-arrow" aria-hidden="true">⌄</span></button> : <button type="button" className="dao-text-button" aria-expanded={openSource === proposal.issueNumber} aria-controls={`github-comments-${proposal.issueNumber}`} onClick={() => setOpenSource(value => value === proposal.issueNumber ? null : proposal.issueNumber)}>GitHub comments <span aria-hidden="true">⌄</span></button>}
          </div>
        </div>
        {record ? renderPanel(recordId) : openSource === proposal.issueNumber ? <div id={`github-comments-${proposal.issueNumber}`}><GitHubComments issueNumber={proposal.issueNumber} visible /></div> : null}
      </li>;
    })}
  </ul>;
}
