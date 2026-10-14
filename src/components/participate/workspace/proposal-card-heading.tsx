import type { ReactNode } from "react";
import type { ZcgProposalExample } from "@/lib/participate/workspace/data/zcg-proposal-examples";
import "./proposal-card-heading.css";

const dates = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const times = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

function date(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value);
  return Number.isFinite(+parsed) ? parsed : null;
}

/** One layout for imported proposals, the live queue and published decisions. */
export function ProposalCardHeading({ title, budget, submittedAt, applicant, decision, checkedAt }: {
  title: ReactNode;
  budget: ReactNode;
  submittedAt?: string | null;
  applicant?: string | null;
  decision?: Pick<ZcgProposalExample, "decisionDate" | "decisionMode" | "meetingDate">;
  checkedAt?: string | null;
}) {
  const submitted = date(submittedAt);
  const decided = date(decision?.decisionDate);
  const meeting = decision?.meetingDate !== decision?.decisionDate ? date(decision?.meetingDate) : null;
  const checked = date(checkedAt);
  const items: ReactNode[] = [];
  if (submitted) items.push(<time dateTime={submittedAt!}>Submitted {dates.format(submitted)}</time>);
  if (applicant) items.push(<span>{applicant}</span>);
  if (decided) items.push(<time dateTime={decision!.decisionDate}>Decision {dates.format(decided)}{decision?.decisionMode === "async" ? " (async)" : ""}</time>);
  if (meeting) items.push(<time dateTime={decision!.meetingDate}>Minutes {dates.format(meeting)}</time>);
  if (checked) items.push(<time dateTime={checkedAt!}>Source checked {dates.format(checked)} · {times.format(checked)} UTC</time>);

  return <header className="proposal-card-header">
    <h2 className="dao-proposal-heading">{title}</h2>
    {budget}
    {items.length ? <ul className="proposal-card-metadata" aria-label="Proposal dates and author">
      {items.map((item, index) => <li key={index}>{index ? <span className="proposal-card-separator" aria-hidden="true">—</span> : null}{item}</li>)}
    </ul> : null}
  </header>;
}
