import { applicationSections, projectSummaryFromBody } from "@/lib/zcg/github-applications-parse";
import type { TopicAnalysis } from "./proposal-topics";

import { ACTIVE_CYCLE, COINHOLDER_REPOSITORY, READY_FOR_VOTE_LABEL, cyclePhase } from "./cycles";

export { COINHOLDER_REPOSITORY, READY_FOR_VOTE_LABEL } from "./cycles";
export const Q4 = ACTIVE_CYCLE;

export type Q4Issue = {
  number: number;
  title: string;
  state: "open" | "closed";
  created_at: string;
  updated_at: string;
  body?: string | null;
  labels: (string | { name: string })[];
  user?: { login: string } | null;
  pull_request?: unknown;
};

export type Q4Proposal = {
  number: number;
  title: string;
  url: string;
  reviewDecisionUrl?: string;
  applicant: string;
  organization: string | null;
  category: string | null;
  summary: string | null;
  requestedUsdCents: number | null;
  createdAt: string;
  updatedAt: string;
  body: string;
  topicAnalysis?: TopicAnalysis;
  topicsPending?: boolean;
};
export type Q4ProposalSummary = Omit<Q4Proposal, "body">;
export type Q4Snapshot = {
  status: "current" | "stale" | "unavailable";
  fetchedAt: string | null;
  proposals: Q4Proposal[] | null;
};

function standaloneUsdCents(text: string): number | null {
  const match = text.trim().match(/^(?:US\$|\$|USD\s+)?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s*(?:USD)?$/i);
  if (!match) return null;
  const cents = Number(match[1].replaceAll(",", "")) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

/** Read the explicit request, optionally followed by a historical revision
 * note. Arbitrary prose and conditional amounts remain unknown; never borrow
 * a project's total budget or the previous amount from the note. */
export function requestedCents(text: string | undefined): number | null {
  if (!text) return null;
  const revision = text.trim().match(/^(.+?)\s+\((reduced|increased)\s+from\s+(.+?)(?:,\s*see\s+[a-z][a-z /&-]*)?\)$/i);
  const current = standaloneUsdCents(revision?.[1] ?? text);
  if (!revision || current === null) return current;
  const amounts = revision[3].split(/\s+and\s+to\s+/i).map((part) =>
    standaloneUsdCents(part.replace(/\s+on\s+\d{4}-\d{2}-\d{2}$/i, "")));
  if (amounts.length === 1) amounts.push(current);
  if (amounts.at(-1) !== current) return null;
  const reduced = revision[2].toLowerCase() === "reduced";
  for (let i = 1; i < amounts.length; i++) {
    const previous = amounts[i - 1], next = amounts[i];
    if (previous === null || next === null || (reduced ? next >= previous : next <= previous)) return null;
  }
  return current;
}

export function q4Proposals(issues: Q4Issue[], retained?: Q4Proposal): Q4Proposal[] {
  const byNumber = new Map<number, Q4Proposal>();
  if (retained && !issues.some((issue) => issue.number === retained.number)) byNumber.set(retained.number, retained);
  for (const issue of issues) {
    const labels = issue.labels.map((label) => typeof label === "string" ? label : label.name);
    const created = Date.parse(issue.created_at);
    if (issue.pull_request || issue.state !== "open" || !labels.includes(READY_FOR_VOTE_LABEL) ||
        !Number.isFinite(created) || created < Date.parse(Q4.submissionsOpen) || created >= Date.parse(Q4.intakeEnds) ||
        labels.some((label) => /approved by coinholders|rejected by coinholders|funds disbursed|withdrawn|cancelled|veto/i.test(label))) continue;
    const fields = applicationSections(issue.body ?? undefined, { perSection: 65_536, total: 100_000 });
    const field = (name: string) => fields.find((s) => s.heading.toLowerCase() === name.toLowerCase())?.text ?? null;
    byNumber.set(issue.number, {
      number: issue.number,
      title: issue.title.replace(/^\s*Retroactive Grant Application\s*[-–—:]\s*/i, "").trim() || issue.title,
      url: `https://github.com/${COINHOLDER_REPOSITORY}/issues/${issue.number}`,
      applicant: issue.user?.login ?? "",
      organization: field("Organization or Individual Name"),
      category: field("Category"),
      summary: projectSummaryFromBody(issue.body),
      requestedUsdCents: requestedCents(field("Requested Grant Amount (USD)") ?? undefined),
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      body: issue.body ?? "",
    });
  }
  return [...byNumber.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.number - a.number);
}

export function q4Summary(proposal: Q4Proposal): Q4ProposalSummary {
  const { body, ...summary } = proposal;
  void body;
  return summary;
}

export function q4Totals(proposals: Pick<Q4ProposalSummary, "requestedUsdCents">[]) {
  return {
    requestedUsdCents: proposals.reduce((sum, p) => sum + (p.requestedUsdCents ?? 0), 0),
    missingAmounts: proposals.filter((p) => p.requestedUsdCents === null).length,
  };
}

export function q4Phase(now = Date.now()) {
  return cyclePhase(ACTIVE_CYCLE, now);
}

export function q4Usd(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 });
}

export function q4Timestamp(value: string) {
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
}
