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

/** Only an explicit, standalone USD amount in the requested field. Do not
 * substitute a project's total cost for the amount requested from voters. */
export function requestedCents(text: string | undefined): number | null {
  if (!text) return null;
  const match = text.trim().match(/^(?:US\$|\$|USD\s+)?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s*(?:USD)?$/i);
  if (!match) return null;
  const cents = Number(match[1].replaceAll(",", "")) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function q4Proposals(issues: Q4Issue[]): Q4Proposal[] {
  const byNumber = new Map<number, Q4Proposal>();
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

export function q4Totals(proposals: Q4ProposalSummary[]) {
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
