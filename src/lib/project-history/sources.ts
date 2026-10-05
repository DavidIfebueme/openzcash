import { safeExternalUrl } from "@/lib/ecosystem/catalog";
import type { ReviewedEvidence } from "./evidence";
import type { GrantHistory, HistoryIdentity, HistoryRepository, HistorySource } from "./types";

const genericCatalogLabels = new Set(["Maintainer repository and project evidence", "Project scope or funding evidence"]);
const validDate = (value: string | null | undefined) => value && /^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value.slice(0, 10) ? value : null;

/** Public references remain useful even when they establish no dated publication.
 * Individual releases and payments retain their own URLs in the timeline; this
 * directory indexes source families without copying thousands of event links.
 */
export function projectSourceContext(identity: HistoryIdentity, grants: GrantHistory[], reviews: ReviewedEvidence[], repositorySnapshotAt: string) {
  const sources = new Map<string, HistorySource>();
  const add = (entry: HistorySource) => {
    const url = safeExternalUrl(entry.url);
    if (!url) return;
    const observedAt = validDate(entry.observedAt);
    const existing = sources.get(url);
    if (!existing) sources.set(url, { ...entry, url, observedAt });
    else sources.set(url, {
      ...existing,
      // Preserve curated titles, but replace generic catalog placeholders with
      // the known source role or proposal title when the URL is the same.
      label: genericCatalogLabels.has(existing.label) && !genericCatalogLabels.has(entry.label) ? entry.label : existing.label,
      kind: existing.kind === "reference" ? entry.kind : existing.kind,
      observedAt: !existing.observedAt || (observedAt && observedAt > existing.observedAt) ? observedAt : existing.observedAt,
    });
  };
  for (const reference of identity.project?.sources ?? []) add({
    kind: "reference", label: reference.title, url: reference.url, observedAt: identity.checkedAt,
  });
  for (const reference of identity.referenceSources ?? []) add({ ...reference, kind: "reference" });
  add({ kind: "website", label: "Project website", url: identity.website, observedAt: identity.checkedAt });

  const repositories: HistoryRepository[] = [];
  const seenRepositories = new Set<string>();
  for (const repo of identity.repositories) {
    const url = safeExternalUrl(repo.url);
    if (!url || seenRepositories.has(url)) continue;
    seenRepositories.add(url);
    // checkedAt records when metadata was observed; pushedAt is not a release date.
    const observedAt = validDate(repo.activity?.checkedAt) ?? validDate(repositorySnapshotAt);
    const source = { label: "Repository metadata", url: safeExternalUrl(repo.sourceUrl) ?? url, observedAt };
    const activityUrl = safeExternalUrl(repo.activity?.sourceUrl);
    repositories.push({ name: repo.fullName, url, archived: repo.archived === true,
      lastPushedAt: validDate(repo.pushedAt), source, activityUrl });
    add({ kind: "repository", label: repo.fullName, url, observedAt });
    if (activityUrl) add({ kind: "repository", label: `${repo.fullName} · activity`, url: activityUrl, observedAt });
    const parsed = new URL(url);
    if (parsed.hostname === "github.com" && /^\/[^/]+\/[^/]+\/?$/.test(parsed.pathname)) {
      parsed.pathname = `${parsed.pathname.replace(/\/$/, "")}/releases`;
      parsed.search = ""; parsed.hash = "";
      add({ kind: "repository", label: `${repo.fullName} · release archive`, url: parsed.href, observedAt });
    }
  }
  for (const event of identity.project?.funding.events ?? []) {
    const observedAt = event.reviewedAt ?? identity.checkedAt;
    add({ kind: "funding", label: event.title, url: event.sourceUrl, observedAt });
    if (event.scopeSourceUrl) add({ kind: "funding", label: `${event.title} · proposal scope`, url: event.scopeSourceUrl, observedAt });
    if (event.repositoryEvidenceUrl) add({
      kind: event.repositoryEvidenceKind === "maintainer-grant-progress" ? "report" : "reference",
      label: `${event.title} · supporting source`, url: event.repositoryEvidenceUrl, observedAt,
    });
  }
  for (const grant of grants) {
    add({ ...grant.source, label: grant.source.label === "OpenZcash proposal ledger" ? `${grant.title} · ledger` : grant.source.label, kind: "funding" });
    if (grant.requestedAmountReview) add({ ...grant.requestedAmountReview.source, label: `${grant.title} · requested amount`, kind: "funding" });
    if (grant.scopeUrl) add({ kind: "funding", label: `${grant.title} · proposal scope`, url: grant.scopeUrl, observedAt: grant.source.observedAt });
  }
  for (const topic of identity.reportTopics) add({
    kind: "report", label: topic.title, url: `https://forum.zcashcommunity.com/t/${topic.id}`, observedAt: identity.checkedAt,
  });
  for (const proposal of identity.daoFundingSources ?? []) add({
    kind: "funding", label: `ZecHub DAO ${proposal.ref} · ${proposal.title}`, url: proposal.url, observedAt: proposal.reviewedAt,
  });
  for (const review of reviews) add({
    kind: review.kind === "team_reported" ? "report" : "publication",
    label: review.title, url: review.sourceUrl, observedAt: review.reviewedAt,
  });
  return { sources: [...sources.values()], repositories };
}
