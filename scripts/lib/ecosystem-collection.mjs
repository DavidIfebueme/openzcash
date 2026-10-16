// Pure collection boundaries shared by the collector and offline regression tests.
export const ACTIVITY_CACHE_VERSION = 4;

export function resumeCollectionCache(value, now = new Date()) {
  const cutoff = Date.parse(value?.collectedAt);
  const age = now.getTime() - cutoff;
  if (!Number.isFinite(cutoff) || age < 0 || age > 24 * 60 * 60 * 1000)
    throw new Error("Cached collection is missing a valid cutoff or is older than 24 hours. Run sync-ecosystem without --cached.");
  return {
    version: ACTIVITY_CACHE_VERSION, collectedAt: value.collectedAt,
    owners: value.owners ?? {}, repositories: value.repositories ?? {},
    // v4 also verifies public visibility and stable identity on every GraphQL page.
    activity: value.version === ACTIVITY_CACHE_VERSION ? value.activity ?? {} : {},
  };
}

export async function collectPublicPages(fetchPage, pageSize = 100) {
  const items = [];
  let pages = 0;
  for (let page = 1; ; page++) {
    const rows = await fetchPage(page);
    if (!Array.isArray(rows)) throw new Error("Invalid owner listing");
    pages++;
    items.push(...rows.filter(row => row.private === false));
    if (rows.length < pageSize) return { items, pages };
  }
}

export async function collectReleasePages(first, fetchAfter) {
  const items = [];
  const cursors = new Set();
  let connection = first;
  for (;;) {
    if (!Array.isArray(connection?.nodes) || typeof connection.pageInfo?.hasNextPage !== "boolean")
      throw new Error("Incomplete release listing");
    // Keep the raw listing until the visibility and date checks below.
    if (connection.nodes.some(release => !release)) throw new Error("Incomplete release listing");
    items.push(...connection.nodes);
    if (!connection.pageInfo.hasNextPage) return items;
    const cursor = connection.pageInfo.endCursor;
    if (!cursor || cursors.has(cursor)) throw new Error("Release pagination did not advance");
    cursors.add(cursor);
    connection = await fetchAfter(cursor);
  }
}

export function publishedReleases(releases, cutoff) {
  const through = Date.parse(cutoff);
  if (!Number.isFinite(through)) throw new Error("Invalid release cutoff");
  const byUrl = new Map();
  for (const release of releases) {
    if (typeof release?.isDraft !== "boolean") throw new Error("Unverified release visibility");
    if (release.isDraft) continue;
    const published = Date.parse(release.publishedAt);
    if (!Number.isFinite(published) || typeof release.isPrerelease !== "boolean" ||
      typeof release.tagName !== "string" || typeof release.url !== "string")
      throw new Error("Incomplete published release");
    if (published > through) continue;
    // Persist public fields only. A tag is not a release without a publication record.
    byUrl.set(release.url, {
      name: release.name ?? null, tagName: release.tagName, publishedAt: release.publishedAt,
      url: release.url, isPrerelease: release.isPrerelease,
    });
  }
  return [...byUrl.values()].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.url.localeCompare(b.url));
}

export function releaseActivity(releases, latestRelease, cutoff, since) {
  const releaseHistory = publishedReleases(releases, cutoff);
  const latest = latestRelease ? publishedReleases([latestRelease], cutoff)[0] : null;
  return {
    // Preserve GitHub's designation when it exists at the cutoff. A later release
    // or draft cannot enter through latestRelease and escape the history filter.
    latestRelease: latest ?? releaseHistory.find(release => !release.isPrerelease) ?? null,
    releases: releaseHistory.filter(release => Date.parse(release.publishedAt) >= Date.parse(since)),
    releaseHistory,
  };
}

/** Preserve previously public observations without presenting them as current releases. */
export function unlistedReleaseHistory(currentReleases, previousActivity, cutoff) {
  if (!previousActivity) return [];
  // This reconciliation is already scoped to one stable repository ID. A
  // repository transfer changes release URLs, not the identity of its tags.
  const currentUrls = new Set(currentReleases.map(release => release.url));
  const currentTags = new Set(currentReleases.map(release => release.tagName));
  const currentlyListed = release => currentUrls.has(release.url) || currentTags.has(release.tagName);
  const archived = new Map((previousActivity.unlistedReleases ?? []).map(release => [release.url, release]));
  const previousRecords = [...(previousActivity.releaseHistory ?? previousActivity.releases ?? []),
    ...(previousActivity.latestRelease ? [previousActivity.latestRelease] : [])];
  const observedAt = previousActivity.checkedAt;
  if (previousRecords.length && (!Number.isFinite(Date.parse(observedAt)) || Date.parse(observedAt) > Date.parse(cutoff)))
    throw new Error("Invalid previous release observation date");
  for (const release of previousRecords) {
    if (!currentlyListed(release)) archived.set(release.url, {
      ...release, lastObservedAt: observedAt, missingAsOf: cutoff,
    });
  }
  return [...archived.values()].filter(release => !currentlyListed(release))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.url.localeCompare(b.url));
}

const repositoryByName = (repositories, name) => repositories.find(repo =>
  [repo.fullName, ...(repo.aliases ?? [])].some(alias => alias.toLowerCase() === name.toLowerCase()));

/**
 * @param {import("../../src/lib/ecosystem/types").Snapshot} snapshot
 * @param {{ requiredRepositories?: string[], previousSnapshot?: import("../../src/lib/ecosystem/types").Snapshot | null }} [options]
 */
export function snapshotPublicationIssues(snapshot, { requiredRepositories = [], previousSnapshot = null } = {}) {
  const issues = [];
  if (snapshot.problems?.length) issues.push("Source collection reported failures");
  if (!snapshot.repositories.length) issues.push("Empty repository inventory");
  if (snapshot.owners.some(owner => !owner.complete)) issues.push("Incomplete owner inventory");
  for (const repo of snapshot.repositories) {
    if (!repo.activity || repo.activity.checkedAt !== snapshot.collectedAt || !Array.isArray(repo.activity.releaseHistory))
      issues.push("Incomplete activity or release history: " + repo.fullName);
  }
  for (const name of requiredRepositories) {
    const current = repositoryByName(snapshot.repositories, name);
    const previous = previousSnapshot && repositoryByName(previousSnapshot.repositories, name);
    if (!current) issues.push("Required repository unavailable: " + name);
    else if (previous && previous.id !== current.id)
      issues.push("Required repository identity changed; review before publishing: " + name);
  }
  return issues;
}

export function canPublishSnapshot(snapshot, options) {
  return snapshotPublicationIssues(snapshot, options).length === 0;
}
