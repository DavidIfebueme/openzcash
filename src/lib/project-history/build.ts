import { createHash } from "node:crypto";
import { isPreviewRelease } from "@/lib/ecosystem/releases";
import { safeExternalUrl } from "@/lib/ecosystem/catalog";
import type { ReviewedEvidence } from "./evidence";
import { historyAmount } from "./format";
import type { Amount, FinanceRecords, GrantHistory, HistoryEvent, HistoryIdentity, Program, ProjectHistory, Source } from "./types";

const normalize = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();
const key = (program: Program, title: string) => `${program}|${normalize(title)}`;
const stableId = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 24);
const validDate = (value: string | null | undefined) => value && /^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value.slice(0, 10) ? value : null;
const source = (label: string, url: string, observedAt: string | null): Source => ({ label, url: safeExternalUrl(url) ?? "https://openzcash.org/ecosystem", observedAt });
const forumTopic = (value: string | null) => {
  try {
    const url = new URL(value ?? ""), parts = url.pathname.split("/");
    if (url.hostname !== "forum.zcashcommunity.com" || parts[1] !== "t") return null;
    return Number(/^\d+$/.test(parts[2]) ? parts[2] : /^\d+$/.test(parts[3] ?? "") ? parts[3] : "") || null;
  } catch { return null; }
};

/** Missing values stay missing, even if every available value is zero. Refunds retain their sign. */
export function sumAmounts(values: (string | null)[]): Amount {
  const known = values.filter((value): value is string => value !== null && /^-?\d+$/.test(value));
  return { known: known.length ? known.reduce((sum, value) => sum + BigInt(value), 0n).toString() : null, records: values.length, missing: values.length - known.length };
}

function bindings(identity: HistoryIdentity, finance: FinanceRecords) {
  const result = new Map<string, { title: string; program: Program; source: Source; status: string; date: string | null; scopeUrl: string | null; note: string }>();
  for (const event of identity.project?.funding.events ?? []) {
    if (event.kind === "context" || !event.program || !["zcg", "coinholder"].includes(event.program) || event.status === "organization-level") continue;
    const id = key(event.program, event.title);
    if (!result.has(id)) result.set(id, { title: event.title, program: event.program, source: source("Catalog funding source", event.sourceUrl, event.reviewedAt ?? identity.checkedAt), status: event.status, date: validDate(event.date), scopeUrl: safeExternalUrl(event.scopeSourceUrl), note: event.associationNote ?? "" });
  }
  // Community recipient associations were reviewed in the community catalog.
  // An umbrella recipient is never split into its regional beneficiaries here.
  for (const row of finance.payments) {
    if (!identity.recipientKeys.includes(row.recipientKey) || !row.project.trim()) continue;
    const id = key(row.program, row.project);
    if (!result.has(id)) result.set(id, { title: row.project, program: row.program, source: row.source, status: "ledger-recorded", date: null, scopeUrl: null, note: "Linked through the community's reviewed ledger recipient." });
  }
  for (const row of finance.proposals) {
    if (!identity.applicationTopics.includes(forumTopic(row.forumLink) ?? -1)) continue;
    const id = key(row.program, row.title);
    if (!result.has(id)) result.set(id, { title: row.title, program: row.program, source: row.source, status: row.status, date: row.decisionDate, scopeUrl: safeExternalUrl(row.forumLink), note: "Linked through a reviewed community application topic." });
  }
  return result;
}

/** Reuse the association index across the directory, instead of N repeated joins. */
export function prepareHistoryBindings(identities: HistoryIdentity[], finance: FinanceRecords) {
  const byIdentity = new Map(identities.map(identity => [identity.id, bindings(identity, finance)]));
  const ownership = new Map<string, { id: string; name: string }[]>();
  for (const other of identities) for (const id of byIdentity.get(other.id)!.keys()) {
    ownership.set(id, [...(ownership.get(id) ?? []), { id: other.id, name: other.name }]);
  }
  return { byIdentity, ownership };
}

export function buildProjectHistory(identity: HistoryIdentity, identities: HistoryIdentity[], finance: FinanceRecords,
  repositorySnapshotAt: string, reviewed: ReviewedEvidence[] = [], now = new Date(),
  index = prepareHistoryBindings(identities, finance)): ProjectHistory {
  const linked = index.byIdentity.get(identity.id) ?? bindings(identity, finance);
  const { ownership } = index;
  const timeline: HistoryEvent[] = [], grants: GrantHistory[] = [], gaps: string[] = [];
  const eventIds = new Set<string>();
  const add = (event: HistoryEvent) => { if (!eventIds.has(event.id)) { eventIds.add(event.id); timeline.push(event); } };
  const eligibleReviews = reviewed.filter(entry => entry.reviewedAt <= now.toISOString().slice(0, 10));
  const superseded = new Set(eligibleReviews.map(entry => entry.supersedes).filter(Boolean));
  const activeReviews = eligibleReviews.filter(entry => entry.projectId === identity.id && !superseded.has(entry.id));
  const linkedMilestoneIds = activeReviews.some(entry => entry.kind === "reviewed_delivery")
    ? new Set(finance.payments.filter(row => linked.has(key(row.program, row.project)) && finance.proposals.filter(proposal => key(proposal.program, proposal.title) === key(row.program, row.project)).length <= 1).map(row => row.id))
    : new Set<string>();
  const acceptanceReviews = activeReviews.filter(entry => entry.kind === "reviewed_delivery" && entry.milestoneIds.every(id => linkedMilestoneIds.has(id)));

  for (const [bindingKey, binding] of linked) {
    const id = `grant-${stableId(bindingKey)}`;
    const candidates = finance.proposals.filter(row => key(row.program, row.title) === bindingKey);
    const ambiguous = candidates.length > 1;
    const proposal = candidates.length === 1 ? candidates[0] : undefined;
    const payments = ambiguous ? [] : [...new Map(finance.payments.filter(row => key(row.program, row.project) === bindingKey).map(row => [row.id, row])).values()];
    const paid = payments.filter(row => row.isPaid);
    const status = ambiguous ? "identity-unresolved" : proposal?.status ?? binding.status;
    const grantSource = proposal?.source ?? binding.source;
    const milestones = payments.map(row => ({
      id: row.id, title: row.milestone || "Ledger milestone", deliverable: row.deliverable,
      paymentRecorded: row.isPaid, paidDate: validDate(row.paidDate), source: row.source,
      deliveryEvidence: acceptanceReviews.filter(entry => entry.milestoneIds.includes(row.id)).map(entry => ({
        id: `review-${entry.id}`, kind: "delivery" as const, title: entry.title, detail: entry.summary,
        date: entry.date, evidence: "reviewed_delivery" as const, grantId: id,
        source: source("Reviewed delivery evidence", entry.sourceUrl, entry.reviewedAt),
      })),
    }));
    grants.push({ id, title: binding.title, program: binding.program, status,
      statusBasis: ambiguous ? "ambiguous" : proposal ? "published_proposal" : binding.status === "ledger-recorded" ? "ledger_only" : "dated_catalog",
      sharedWith: (ownership.get(bindingKey) ?? []).filter(item => item.id !== identity.id),
      requestedUsdCents: proposal?.requestedUsdCents ?? null, approvedUsdCents: null,
      budgetUsdCents: sumAmounts(payments.map(row => row.budgetUsdCents)),
      paidBudgetUsdCents: sumAmounts(paid.map(row => row.budgetUsdCents)),
      recordedZecZat: sumAmounts(paid.map(row => row.recordedZecZat)),
      source: grantSource, scopeUrl: safeExternalUrl(proposal?.forumLink) ?? binding.scopeUrl, milestones,
    });
    if (ambiguous) gaps.push(`${binding.title}: multiple proposals use this title in ${binding.program.toUpperCase()}; amounts and milestone links are withheld until identity is resolved.`);
    if (proposal) add({ id: `${id}-proposal`, kind: "proposal", title: binding.title,
      detail: "Application recorded. Requested funding is separate from approval and payment.",
      date: validDate(proposal.submittedDate), evidence: "source_record", source: grantSource, grantId: id });
    if (proposal && !["pending", "under_review"].includes(proposal.status)) add({ id: `${id}-decision`, kind: "decision",
      title: `${proposal.status.replaceAll("_", " ")} · ${binding.title}`, detail: "Published proposal status from the OpenZcash ledger mirror.",
      date: validDate(proposal.decisionDate), evidence: "source_record", source: grantSource, grantId: id });
    // An older catalog decision remains explicitly dated context if the current
    // proposal source is unavailable or unlinked; it never supplies new amounts.
    if (!proposal && !ambiguous) add({ id: `${id}-catalog`, kind: "context", title: `${binding.status} · ${binding.title}`,
      detail: ["Dated catalog funding reference; current proposal status is not linked.", binding.note].filter(Boolean).join(" "),
      date: binding.date, evidence: "source_record", source: binding.source, grantId: id });
    for (const row of paid) add({ id: `payment-${row.id}`, kind: "payment", title: `${binding.title}${row.milestone ? ` · ${/^\d+(?:\.\d+)?$/.test(row.milestone) ? "Milestone " : ""}${row.milestone}` : ""}`,
      detail: [row.budgetUsdCents !== null ? `Budget value: ${historyAmount(row.budgetUsdCents)}.` : "Budget value not linked.", row.recordedZecZat !== null ? `Recorded payment: ${historyAmount(row.recordedZecZat, "ZEC")}.` : "ZEC amount not linked."].join(" "),
      budgetUsdCents: row.budgetUsdCents, recordedZecZat: row.recordedZecZat,
      date: validDate(row.paidDate), evidence: "source_record", source: row.source, grantId: id });
    for (const milestone of milestones) for (const evidence of milestone.deliveryEvidence) add(evidence);
    if (finance.paymentsAvailable && !payments.length && !ambiguous) gaps.push(`${binding.title}: no payment rows matched the exact grant title and program. This does not establish zero funding.`);
  }

  for (const repo of identity.repositories) {
    const releases = [...(repo.activity?.releaseHistory ?? repo.activity?.releases ?? []), ...(repo.activity?.latestRelease ? [repo.activity.latestRelease] : [])];
    for (const release of releases) add({ id: `release-${stableId(release.url)}`, kind: "release",
      title: `${repo.fullName} · ${release.tagName}`, detail: `${isPreviewRelease(release) ? "Prerelease (GitHub flag or version tag)" : "Release"} published by the repository maintainer. No grant milestone acceptance is inferred.`,
      releaseChannel: isPreviewRelease(release) ? "prerelease" : "release",
      date: validDate(release.publishedAt), evidence: "published_artifact", grantId: null,
      source: source("Repository release", release.url, repo.activity?.checkedAt ?? repositorySnapshotAt) });
  }
  // Prior observations remain traceable when a release disappears from the public listing.
  for (const repo of identity.repositories) for (const release of repo.activity?.unlistedReleases ?? []) {
    add({ id: `release-${stableId(release.url)}`, kind: "release", title: `${repo.fullName} · ${release.tagName}`,
      detail: `Previously observed release; no longer listed in the repository's public releases as of ${release.missingAsOf.slice(0, 10)}. Last observed ${release.lastObservedAt.slice(0, 10)}. Current download availability is unverified.`,
      releaseChannel: isPreviewRelease(release) ? "prerelease" : "release", sourceState: "unlisted",
      date: validDate(release.publishedAt), evidence: "published_artifact", grantId: null,
      source: source("Previously observed repository release", release.url, release.lastObservedAt) });
  }
  for (const event of identity.project?.funding.events ?? []) {
    if (event.kind === "context") {
      add({ id: `funding-context-${stableId(event.sourceUrl)}`, kind: "context", title: event.title,
        detail: "Dated source about an existing grant. This status update is not a separate award and supplies no payment amount.",
        date: validDate(event.date), evidence: "source_record", grantId: null,
        source: source("Grant status context", event.sourceUrl, identity.checkedAt) });
      continue;
    }
    if (event.status === "organization-level") add({ id: `context-${stableId(event.sourceUrl)}`, kind: "context", title: "Organization-level funding context",
      detail: "This source describes the organization. It does not establish a separate grant or an allocation to this component.",
      date: validDate(event.date), evidence: "source_record", grantId: null, source: source("Organization source", event.sourceUrl, identity.checkedAt) });
    if (event.repositoryEvidenceKind === "maintainer-grant-progress" && event.repositoryEvidenceUrl) add({
      id: `report-${stableId(event.repositoryEvidenceUrl)}`, kind: "report", title: `Maintainer progress reference · ${event.title}`,
      detail: "Progress reference mapped in the reviewed catalog. Its publication date and individual claims have not been extracted into this history.",
      date: null, evidence: "team_reported", grantId: null, source: source("Maintainer progress reference", event.repositoryEvidenceUrl, identity.checkedAt),
    });
  }
  for (const topic of identity.reportTopics) {
    const url = `https://forum.zcashcommunity.com/t/${topic.id}`;
    if (!timeline.some(event => event.source.url === url)) add({ id: `community-report-${topic.id}`, kind: "report",
      title: topic.title, detail: "Linked community report source. Individual claims and publication dates have not yet been extracted or accepted in this history.",
      date: null, evidence: "team_reported", grantId: null, source: source("Community report", url, identity.checkedAt) });
  }
  for (const proposal of identity.daoFundingSources ?? []) add({
    id: `dao-context-${proposal.ref}`, kind: "context", title: `ZecHub DAO ${proposal.ref} · ${proposal.title}`,
    detail: `Approved DAO proposal in the community catalog reviewed ${proposal.reviewedAt}. Timeline date is proposal creation, not approval or payment. Stated period: ${proposal.period}. DAO financial totals are outside this history’s ZCG/Coinholder records.`,
    date: validDate(proposal.createdAt), evidence: "source_record", grantId: null,
    source: source("ZecHub DAO proposal", proposal.url, proposal.reviewedAt),
  });
  const reviewKinds = { team_reported: "report", published_artifact: "release", documented_integration: "integration", usage_observation: "usage" } as const;
  for (const entry of activeReviews.filter(item => item.kind !== "reviewed_delivery")) {
    let observed: HistoryEvent | undefined;
    // A review can enrich a publication, but cannot reverse a later missing-source observation.
    if (entry.kind === "published_artifact") {
      const duplicate = timeline.findIndex(event => event.kind === "release" && event.source.url === entry.sourceUrl);
      if (duplicate >= 0) { observed = timeline.splice(duplicate, 1)[0]; eventIds.delete(observed.id); }
    }
    add({ id: `review-${entry.id}`, kind: reviewKinds[entry.kind as keyof typeof reviewKinds],
      title: entry.title, detail: observed?.sourceState === "unlisted" ? `${entry.summary} ${observed.detail}` : entry.summary, date: entry.date, evidence: entry.kind, grantId: null,
      ...(observed?.sourceState ? { sourceState: observed.sourceState } : {}), ...(observed?.releaseChannel ? { releaseChannel: observed.releaseChannel } : {}),
      source: source(entry.kind === "team_reported" ? "Team report" : "Reviewed public source", entry.sourceUrl, entry.reviewedAt) });
  }
  const reviews = eligibleReviews.filter(entry => entry.projectId === identity.id).map(entry => ({ ...entry,
    supersededBy: eligibleReviews.find(item => item.supersedes === entry.id)?.id ?? null,
    linked: timeline.some(event => event.id === `review-${entry.id}`),
  }));
  if (reviews.some(entry => !entry.supersededBy && !entry.linked)) gaps.push("A reviewed record cannot be linked to the current ledger. Its acceptance claim is withheld pending an exact re-link.");
  if (!finance.proposalsAvailable) gaps.push("The proposal source is unavailable. Dated catalog references are retained; current decisions and requested amounts cannot be confirmed.");
  if (!finance.paymentsAvailable) gaps.push("The payment source is unavailable. Missing totals must not be interpreted as zero.");
  if (identity.daoFundingSources?.length) gaps.push("ZecHub DAO grants are linked as dated context. DAO payments and totals are not included in these ZCG/Coinholder financial records; see the community funding sources.");
  if (!grants.length) gaps.push("No project-specific ZCG/Coinholder grant identity is linked. This does not establish that the project is unfunded.");
  if (!timeline.some(event => event.evidence === "reviewed_delivery")) gaps.push("No milestone acceptance evidence is linked in this history yet. This is a coverage gap, not a finding of non-delivery.");
  if (!identity.repositories.length) gaps.push("No repository is linked. Community output and other non-code work must be assessed from its own sources.");
  timeline.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.id.localeCompare(b.id));
  const latestGrantDate = (id: string) => timeline.find(event => event.grantId === id && event.date)?.date ?? "";
  grants.sort((a, b) => latestGrantDate(b.id).localeCompare(latestGrantDate(a.id)) || a.id.localeCompare(b.id));
  return {
    schemaVersion: 1, project: { id: identity.id, name: identity.name, description: identity.description, category: identity.category, website: identity.website, communityId: identity.communityId },
    assembledAt: now.toISOString(), registryCheckedAt: identity.checkedAt, repositorySnapshotAt, ledgerImportedAt: finance.importedAt,
    coverage: { proposalsAvailable: finance.proposalsAvailable, paymentsAvailable: finance.paymentsAvailable, releasesComplete: false },
    grants, timeline, gaps, reviews, reportLinks: identity.reportTopics.map(topic => ({ title: topic.title, url: `https://forum.zcashcommunity.com/t/${topic.id}` })),
    notes: [
      "Requested USD, approved status, ledger budgets and recorded ZEC payments are distinct. The current ledger has no separate authoritative approved-amount field.",
      "Amounts belong to associated grants, not an allocation to this component. Shared grants must not be added across project histories; programs remain separate.",
      "Repository releases are a bounded dated snapshot, not a complete release history. A release proves publication, not milestone acceptance, adoption or causal impact.",
      "No record is evidence of missing coverage, not zero funding, a missed deadline or team failure. Reports outside the linked sources may exist.",
    ],
  };
}

/** Calendar event filter, not a claim to reconstruct what was known at that date. */
export function eventsInMonth(events: HistoryEvent[], month: string): HistoryEvent[] {
  if (!/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(month)) throw new Error("Invalid calendar month");
  return events.filter(event => event.date?.slice(0, 7) === month);
}
