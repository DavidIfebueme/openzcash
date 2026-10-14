"use client";

import { ZcgVoteBar, type FeedbackSelection } from "./zcg-vote-bar";
import { summarizeZcgVotes, type ZcgProposalExample } from "@/lib/participate/workspace/data/zcg-proposal-examples";

export function PublishedDecisionCard({ decision, selection, onSelectionChange }: {
  decision: ZcgProposalExample;
  selection?: FeedbackSelection | null;
  onSelectionChange?: (selection: FeedbackSelection | null) => void;
}) {
  const counts = summarizeZcgVotes(decision.votes);
  const summary = decision.unanimous ? `Unanimous · ${counts.total} of 5`
    : `${counts.approve} approve · ${counts.reject} reject${counts.abstain ? ` · ${counts.abstain} abstain` : ""}`;
  const hasCollectiveVotes = decision.votes.some(vote => vote.basis === "unanimous");
  return <section className="proposal-published-decision" aria-label="Published committee verdict">
    <div className="proposal-published-decision-heading"><div><strong>Committee verdict</strong><span>{summary}</span></div><a className="dao-text-button" href={decision.minutesUrl} target="_blank" rel="noopener noreferrer">Meeting minutes ↗</a></div>
    <ZcgVoteBar proposal={decision} showSummary={false} selection={selection} onSelectionChange={onSelectionChange} />
    <p className="proposal-published-decision-caption">{hasCollectiveVotes ? "Select a member for feedback. Collective votes have no individual comment." : "Select a member for feedback from the minutes."}</p>
  </section>;
}
