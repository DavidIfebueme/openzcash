"use client";

import { ZcgVoteBar } from "./zcg-proposal-examples";
import type { PublishedCommitteeDecision } from "@/lib/zcg/committee-minutes";

const date = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function PublishedDecisionCard({ decision }: { decision: PublishedCommitteeDecision }) {
  return <section className="proposal-published-decision" aria-label="Published committee verdict">
    <div className="proposal-published-decision-heading"><div><strong>Committee verdict</strong><span>{decision.unanimous ? "Unanimous · 5 of 5" : "Published votes"} · {date(decision.decisionDate)}{decision.decisionMode === "async" ? " · Async" : ""}</span></div><a className="dao-text-button" href={decision.minutesUrl} target="_blank" rel="noopener noreferrer">Meeting minutes ↗</a></div>
    <ZcgVoteBar proposal={decision} showSummary={false} />
    <p className="proposal-published-decision-caption">Select a member for feedback. Collective votes have no individual comment.</p>
  </section>;
}
