import type { HistoryEvent, HistoryIdentity, Program, ProjectHistory } from "./types";

/** Coverage facts only: never infer lateness, adoption or acceptance from payment. */
export function projectInsights(history: ProjectHistory) {
  const rows = [...new Map(history.grants.flatMap(grant => grant.milestones).map(row => [row.id, row])).values()];
  const paid = rows.filter(row => row.paymentRecorded);
  const accepted = rows.filter(row => row.deliveryEvidence.length > 0);
  const published = history.timeline.filter(event => event.evidence === "published_artifact");
  const integrations = history.timeline.filter(event => event.kind === "integration");
  const usage = history.timeline.filter(event => event.kind === "usage");
  const reportSources = new Set(history.timeline.filter(event => event.kind === "report").map(event => event.source.url));
  const publicWorkSources = new Set(history.timeline.filter(event => ["release", "report", "delivery", "integration", "usage"].includes(event.kind)).map(event => event.source.url));
  const latest = (kinds: HistoryEvent["kind"][]) => history.timeline.find(event => event.sourceState !== "unlisted" && event.date && kinds.includes(event.kind)) ?? null;
  const acceptanceGaps = history.coverage.paymentsAvailable ? paid.filter(row => !row.deliveryEvidence.length).length : null;
  const checks: { title: string; detail: string; section: "funding" | "evidence" | "timeline" }[] = [];
  if (!history.coverage.paymentsAvailable || !history.coverage.proposalsAvailable) checks.push({ title: "Restore financial source coverage", detail: "A source could not be read. Current payment or decision coverage is incomplete.", section: "evidence" });
  if (history.grants.some(grant => grant.statusBasis === "ambiguous")) checks.push({ title: "Resolve the grant identity", detail: "Several proposals share a title. Amounts remain withheld until the exact award is identified.", section: "funding" });
  if (acceptanceGaps) checks.push({ title: "Link milestone acceptance", detail: `${acceptanceGaps} paid ledger ${acceptanceGaps === 1 ? "entry has" : "entries have"} no linked acceptance evidence. Check the funded scope and the decision that accepted it.`, section: "funding" });
  if (!usage.length) checks.push({ title: "Establish measured use", detail: "No usage observation with a defined period and population is linked. Usage remains unassessed.", section: "evidence" });
  if (!published.length && !history.timeline.some(event => event.kind === "report")) checks.push({ title: "Link public work", detail: "Add dated project reports or artifacts, including non-code output. Missing links do not establish inactivity.", section: "evidence" });
  return {
    grants: history.grants.length,
    paidEntries: history.coverage.paymentsAvailable ? paid.length : null,
    ledgerEntries: history.coverage.paymentsAvailable ? rows.length : null,
    acceptedEntries: accepted.length, acceptanceGaps,
    publishedArtifacts: published.length, integrations: integrations.length, usageObservations: usage.length,
    reportSources: reportSources.size, publicWorkSources: publicWorkSources.size,
    latestWork: latest(["release", "delivery", "report", "integration", "usage"]),
    latestPayment: latest(["payment"]), latestDecision: latest(["decision"]),
    latestEvent: latest(["release", "delivery", "report", "integration", "usage", "payment", "decision", "proposal", "context"]),
    checks,
  };
}
export type ProjectInsights = ReturnType<typeof projectInsights>;
export type HistoryIndexItem = ProjectHistory["project"] & {
  insights: Pick<ProjectInsights, "grants" | "paidEntries" | "acceptedEntries" | "acceptanceGaps" | "publishedArtifacts" | "integrations" | "usageObservations" | "reportSources" | "publicWorkSources">;
  latestEvent: Pick<HistoryEvent, "title" | "date" | "kind" | "releaseChannel"> | null;
};

/** Navigation is based on reviewed associations, never substring similarity. */
export function historyLinksForGrant(identities: HistoryIdentity[], grant: { title: string; program: Program; recipientKey?: string }) {
  const normalize = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();
  return identities.filter(identity =>
    identity.project?.funding.events.some(event => event.kind !== "context" && event.program === grant.program && event.status !== "organization-level" && normalize(event.title) === normalize(grant.title)) ||
    (grant.recipientKey && identity.recipientKeys.includes(grant.recipientKey))
  ).map(({ id, name }) => ({ id, name, href: `/ecosystem/history/${id}?section=funding` }));
}
