import type { ProposalTableRow } from "@/app/zcg/proposals/proposals-table";
import type { DecisionRow, ProposalInput } from "@/lib/governance/decisions";
import { PUBLISHED_COMMITTEE_DECISIONS, publishedDecisionForIssue } from "./committee-minutes";

/** Public minutes can settle an undecided sheet row without modifying the ledger. */
export function applyPublishedMinutes(rows: readonly ProposalTableRow[], now = Date.now()) {
  let minutesDecided = 0;
  const proposals = rows.map(row => {
    const decision = row.program === "zcg" ? publishedDecisionForIssue(row.platformLink, now) : null;
    if (!decision || row.status !== "under_review" || row.submitted > decision.decisionDate
      || (row.decisionDate && row.decisionDate > decision.decisionDate)) return row;
    minutesDecided++;
    return { ...row, status: decision.outcome, statusLabel: decision.outcome === "approved" ? "Approved" : "Rejected",
      decisionDate: decision.decisionDate, statusSourceUrl: decision.minutesUrl, source: "minutes" as const,
      amountUsd: row.amountUsd ?? decision.requestedUsd };
  });
  return { rows: proposals, minutesDecided };
}

/** Add exact, reviewed source decisions once; leave later verdicts and amounts intact. */
export function mergeMinutesHistory(rows: readonly DecisionRow[], proposals: readonly ProposalInput[], now = Date.now()): DecisionRow[] {
  const result = [...rows];
  for (const decision of PUBLISHED_COMMITTEE_DECISIONS) {
    if (Date.parse(decision.publishedAt) > now) continue;
    const proposal = proposals.find(row => row.program === "zcg" && publishedDecisionForIssue(row.platformLink, now)?.issueNumber === decision.issueNumber);
    if (!proposal || !["under_review", decision.outcome].includes(proposal.status)
      || (proposal.decisionDate && proposal.decisionDate > decision.decisionDate)) continue;
    const index = result.findIndex(row => row.process === "committee" && row.sources.some(source => publishedDecisionForIssue(source.href, now)?.issueNumber === decision.issueNumber));
    const existing = index >= 0 ? result[index] : null;
    if (existing && (existing.date > decision.decisionDate || existing.outcome.toLowerCase() !== decision.outcome)) continue;
    const sources = [
      ...(existing?.sources.filter(source => source.label !== "Minutes" && source.label !== "Votes & feedback") ?? [{ label: "Application", href: decision.issueUrl }]),
      { label: "Minutes", href: decision.minutesUrl },
      { label: "Votes & feedback", href: `https://openzcash.org/zcg/participate?record=${decision.id}` },
    ];
    const updated: DecisionRow = { id: existing?.id ?? `minutes-${decision.id}-${decision.decisionDate}`,
      date: existing?.date ?? decision.decisionDate, process: "committee", outcome: decision.outcome === "approved" ? "Approved" : "Rejected",
      tone: decision.outcome === "approved" ? "emerald" : "rose", subject: existing?.subject ?? decision.title,
      subjectHref: existing?.subjectHref ?? null, detail: existing?.detail ?? proposal.applicantsRaw,
      decidedBy: "ZCG committee", sources };
    if (index >= 0) result[index] = updated;
    else result.push(updated);
  }
  return result;
}
