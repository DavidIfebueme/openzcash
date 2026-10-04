/** Read-only reproducible coverage audit. Never imports or changes the financial ledger. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { validateCatalog } from "../src/lib/ecosystem/catalog";
import { isPreviewRelease } from "../src/lib/ecosystem/releases";
import { historyIdentities } from "../src/lib/project-history/identities";
import { buildProjectHistory, prepareHistoryBindings } from "../src/lib/project-history/build";
import { projectInsights } from "../src/lib/project-history/insights";
import { evidenceSchema } from "../src/lib/project-history/evidence";
import type { Catalog } from "../src/lib/ecosystem/types";
import type { FinanceRecords } from "../src/lib/project-history/types";

const option = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
const read = async (path: string) => JSON.parse(await readFile(resolve(path), "utf8"));
async function main() {
const catalog: Catalog = { registry: await read("src/data/ecosystem/registry.json"), snapshot: await read("src/data/ecosystem/snapshot.json") };
validateCatalog(catalog);
const reviewed = evidenceSchema.parse(await read("src/data/project-history/evidence.json")).entries;
const financePath = option("--finance");
const finance: FinanceRecords = financePath ? await read(financePath) : { proposals: [], payments: [], proposalsAvailable: false, paymentsAvailable: false, importedAt: null };
const now = new Date(), issues: string[] = [];
const ageDays = (now.getTime() - Date.parse(catalog.snapshot.collectedAt)) / 86_400_000;
if (ageDays > 7 || ageDays < 0) issues.push("Repository snapshot is outside the 7-day freshness budget");
if (createHash("sha256").update(JSON.stringify(catalog.registry)).digest("hex") !== catalog.snapshot.registryHash) issues.push("Registry hash mismatch");
if (catalog.snapshot.problems.length || catalog.snapshot.owners.some(owner => !owner.complete)) issues.push("Collection has unresolved failures");
const identities = historyIdentities(catalog), index = prepareHistoryBindings(identities, finance);
for (const entry of reviewed) if (!identities.some(identity => identity.id === entry.projectId)) issues.push("Unknown reviewed identity: " + entry.projectId);
const records = identities.map(identity => {
  const mappedNames = new Set(identity.repositories.flatMap(repo => [repo.fullName, ...repo.aliases].map(name => name.toLowerCase())));
  const missingRepositories = (identity.project?.repositories ?? []).filter(name => !mappedNames.has(name.toLowerCase()));
  if (missingRepositories.length) issues.push(identity.id + ": unresolved repositories " + missingRepositories.join(", "));
  const history = buildProjectHistory(identity, identities, finance, catalog.snapshot.collectedAt, reviewed, now, index);
  const facts = projectInsights(history);
  return { id: identity.id, name: identity.name, category: identity.category, communityId: identity.communityId,
    identityReviewedAt: identity.checkedAt, repositories: identity.repositories.map(repo => ({
      id: repo.id, name: repo.fullName, url: repo.url, archived: repo.archived, fork: repo.fork,
      checkedAt: repo.activity?.checkedAt ?? null, currentReleaseRecords: repo.activity?.releaseHistory?.length ?? null,
      latestGitHubMarker: repo.activity?.latestRelease ?? null,
      latestNonPreviewByDate: repo.activity?.releaseHistory?.find(release => !isPreviewRelease(release)) ?? null,
      latestPreviewByDate: repo.activity?.releaseHistory?.find(isPreviewRelease) ?? null,
      unlistedReleaseRecords: repo.activity?.unlistedReleases?.length ?? 0,
    })), missingRepositories, grants: history.grants.map(grant => ({ id: grant.id, title: grant.title, program: grant.program,
      status: grant.status, statusBasis: grant.statusBasis, sharedWith: grant.sharedWith, source: grant.source, ledgerEntries: grant.milestones.length })),
    reportLinks: history.reportLinks, latestWork: facts.latestWork, reviewedSources: history.reviews,
    counts: { grants: facts.grants, paidEntries: facts.paidEntries, publishedArtifacts: facts.publishedArtifacts, reportSources: facts.reportSources,
      acceptedEntries: facts.acceptedEntries, integrations: facts.integrations, usageObservations: facts.usageObservations },
    gaps: history.gaps,
  };
});
for (const repo of catalog.snapshot.repositories) {
  if (!repo.activity?.releaseHistory || repo.activity.checkedAt !== catalog.snapshot.collectedAt) issues.push("Incomplete repository collection: " + repo.fullName);
  for (const release of [...(repo.activity?.releaseHistory ?? []), ...(repo.activity?.latestRelease ? [repo.activity.latestRelease] : [])]) {
    if (Date.parse(release.publishedAt) > Date.parse(catalog.snapshot.collectedAt)) issues.push("Release exceeds collection cutoff: " + release.url);
  }
}
const baselinePath = option("--baseline");
const baseline: Catalog["snapshot"] | null = baselinePath ? await read(baselinePath) : null;
const changed = baseline ? catalog.snapshot.repositories.flatMap(repo => {
  const previous = baseline.repositories.find(row => row.id === repo.id);
  return previous && previous.activity?.latestRelease?.tagName !== repo.activity?.latestRelease?.tagName ? [{ repository: repo.fullName, previous: previous?.activity?.latestRelease?.tagName ?? null, current: repo.activity?.latestRelease?.tagName ?? null }] : [];
}) : [];
const normalized = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
const mappedGrants = new Set(records.flatMap(record => record.grants.map(grant => `${grant.program}|${normalized(grant.title)}`)));
const unmappedRecentApprovedProposals = finance.proposals.filter(proposal => ["approved", "paid"].includes(proposal.status) && proposal.decisionDate && proposal.decisionDate >= (baseline?.collectedAt.slice(0, 10) ?? catalog.registry.checkedAt.slice(0, 10)) && !mappedGrants.has(`${proposal.program}|${normalized(proposal.title)}`)).map(({ title, program, status, decisionDate, platformLink, forumLink }) => ({ title, program, status, decisionDate, platformLink, forumLink }));
const newRepositories = baseline ? catalog.snapshot.repositories.filter(repo => !baseline.repositories.some(previous => previous.id === repo.id)).map(repo => repo.fullName) : [];
const summary = { auditedAt: now.toISOString(), repositoryCutoff: catalog.snapshot.collectedAt, repositoryAgeDays: Math.floor(ageDays),
  registryReviewedAt: catalog.registry.checkedAt, financeImportedAt: finance.importedAt, financeAvailable: { proposals: finance.proposalsAvailable, payments: finance.paymentsAvailable },
  identities: records.length, projects: catalog.registry.projects.length, communities: records.filter(row => row.communityId).length,
  repositories: catalog.snapshot.repositories.length, collectionProblems: catalog.snapshot.problems.length,
  identitiesWithoutGitHub: records.filter(row => !row.repositories.length).length, identitiesWithReportLinks: records.filter(row => row.reportLinks.length).length,
  ambiguousGrantViews: records.flatMap(row => row.grants).filter(grant => grant.statusBasis === "ambiguous").length,
  unlistedReleaseRecords: catalog.snapshot.repositories.reduce((sum, repo) => sum + (repo.activity?.unlistedReleases?.length ?? 0), 0),
  releaseMarkerChanges: changed.length, newRepositories: newRepositories.length, unmappedRecentApprovedProposals: unmappedRecentApprovedProposals.length, issues,
};
const report = { summary, limits: [
  "This audits source freshness, identity mappings and assembled evidence; it does not certify every project claim, grant delivery or adoption.",
  "GitHub release markers and version tags do not prove stable deployments. App Store versions are platform-specific reviewed additions.",
  "Financial rows are the explicitly supplied public mirror export, not a new ledger import or an independent settlement audit.",
  "Non-GitHub projects and undated community reports require their own source reviews. A missing record is not zero work or zero funding."
], newRepositories, unmappedRecentApprovedProposals, changedReleaseMarkers: changed, records };
const output = option("--output");
if (output) { await mkdir(dirname(resolve(output)), { recursive: true }); await writeFile(resolve(output), JSON.stringify(report, null, 2) + "\n"); }
console.log(JSON.stringify(summary, null, 2));
if (issues.length) process.exitCode = 1;

}
main().catch(error => { console.error(error instanceof Error ? error.message : "Audit failed"); process.exitCode = 1; });
