import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTIVITY_CACHE_VERSION, resumeCollectionCache, collectPublicPages, collectReleasePages, releaseActivity, unlistedReleaseHistory, snapshotPublicationIssues, canPublishSnapshot } from "./ecosystem-collection.mjs";

test("enumerates beyond the first owner page and verifies the trailing page", async () => {
  const calls = [];
  const result = await collectPublicPages(async page => {
    calls.push(page);
    return page <= 2 ? Array.from({ length: 100 }, (_, index) => ({ private: false, id: page * 100 + index })) : [];
  });
  assert.equal(result.items.length, 200);
  assert.equal(result.pages, 3);
  assert.deepEqual(calls, [1, 2, 3]);
});
test("retains only explicitly public results but paginates by raw response size", async () => {
  const result = await collectPublicPages(async page => page === 1
    ? [{ private: true }, { private: false }] : page === 2 ? [{ private: false }, { id: "unknown visibility" }] : [], 2);
  assert.equal(result.items.length, 2);
  assert.equal(result.pages, 3);
});
test("a failed page cannot be mistaken for an empty complete inventory", async () => {
  await assert.rejects(collectPublicPages(async page => {
    if (page === 2) throw new Error("unavailable");
    return [{ private: false }];
  }, 1), /unavailable/);
  await assert.rejects(collectPublicPages(async () => ({ message: "rate limited" })), /Invalid owner/);
});
test("release collection follows all creation-ordered pages even after old publications", async () => {
  const old = { publishedAt: "2020-01-01" };
  const recent = { publishedAt: "2026-09-08" };
  const releases = await collectReleasePages({ nodes: [old], pageInfo: { hasNextPage: true, endCursor: "a" } },
    async cursor => {
      assert.equal(cursor, "a");
      return { nodes: [recent, { publishedAt: null }], pageInfo: { hasNextPage: false } };
    });
  assert.deepEqual(releases, [old, recent, { publishedAt: null }]);
});
test("missing or repeated release cursors fail closed", async () => {
  const connection = { nodes: [], pageInfo: { hasNextPage: true, endCursor: "a" } };
  await assert.rejects(collectReleasePages(connection, async () => connection), /did not advance/);
  await assert.rejects(collectReleasePages(connection, async () => null), /Incomplete release/);
});
const cutoff = "2026-10-04T12:00:00Z";
const since = "2026-07-06T12:00:00Z";
const release = (tag, date, fields = {}) => ({ name: tag, tagName: tag, publishedAt: date,
  url: `https://github.com/example/project/releases/tag/${tag}`, isPrerelease: false, isDraft: false, ...fields });
const repository = (name = "example/project", fields = {}) => ({ id: "stable-node-id", fullName: name, aliases: [],
  activity: { checkedAt: cutoff, releaseHistory: [], releases: [], latestRelease: null }, ...fields });
const snapshot = (fields = {}) => ({ collectedAt: cutoff, repositories: [repository()], owners: [{ complete: true }], ...fields });

test("retains older history while keeping the 90-day analytics window", () => {
  const old = release("v1", "2020-01-01T12:00:00Z"), recent = release("v2", "2026-09-01T12:00:00Z");
  const result = releaseActivity([old, recent, recent], recent, cutoff, since);
  assert.deepEqual(result.releaseHistory.map(item => item.tagName), ["v2", "v1"]);
  assert.deepEqual(result.releases.map(item => item.tagName), ["v2"]);
  assert.equal(result.latestRelease.tagName, "v2");
  assert.ok(result.releaseHistory.every(item => !("isDraft" in item)));
});
test("excludes drafts and after-cutoff publications from both history and latest release", () => {
  const stable = release("v1", "2026-09-01T12:00:00Z");
  const draft = release("v2-draft", "2026-09-20T12:00:00Z", { isDraft: true });
  const future = release("v3", "2026-10-04T12:00:01Z");
  const result = releaseActivity([stable, draft, future], future, cutoff, since);
  assert.deepEqual(result.releaseHistory.map(item => item.tagName), ["v1"]);
  assert.equal(result.latestRelease.tagName, "v1");
  assert.equal(releaseActivity([stable, draft], draft, cutoff, since).latestRelease.tagName, "v1");
  assert.equal(releaseActivity([draft, future], future, cutoff, since).latestRelease, null);
});
test("retains prerelease records separately from the latest stable designation", () => {
  const stable = release("v1", "2026-09-01T12:00:00Z");
  const candidate = release("v2-rc0", "2026-09-20T12:00:00Z", { isPrerelease: true });
  const result = releaseActivity([stable, candidate], stable, cutoff, since);
  assert.deepEqual(result.releaseHistory.map(item => item.tagName), ["v2-rc0", "v1"]);
  assert.equal(result.releaseHistory[0].isPrerelease, true);
  assert.equal(result.latestRelease.tagName, "v1");
  assert.equal(releaseActivity([candidate], null, cutoff, since).latestRelease, null);
});
test("a partially returned release or unverified visibility fails the read", async () => {
  assert.throws(() => releaseActivity([{ ...release("v1", cutoff), isDraft: undefined }], null, cutoff, since), /visibility/);
  assert.throws(() => releaseActivity([release("v1", "invalid")], null, cutoff, since), /Incomplete published/);
  await assert.rejects(collectReleasePages({ nodes: [null], pageInfo: { hasNextPage: false } }, async () => null), /Incomplete release/);
  await assert.rejects(collectReleasePages({ nodes: [], pageInfo: {} }, async () => null), /Incomplete release/);
});
test("failed owner scans, incomplete activity and empty snapshots preserve the previous artifact", () => {
  assert.equal(canPublishSnapshot(snapshot({ repositories: [] })), false);
  assert.equal(canPublishSnapshot(snapshot({ owners: [{ complete: false }] })), false);
  assert.equal(canPublishSnapshot(snapshot({ repositories: [repository("example/project", { activity: null })] })), false);
  assert.equal(canPublishSnapshot(snapshot({ repositories: [repository("example/project", { activity: { checkedAt: cutoff, releases: [] } })] })), false);
  const stale = repository(); stale.activity.checkedAt = "2026-09-08T12:00:00Z";
  assert.equal(canPublishSnapshot(snapshot({ repositories: [stale] })), false);
  assert.equal(canPublishSnapshot(snapshot()), true);
});
test("selected-repository failures cannot publish an otherwise complete owner inventory", () => {
  const options = { requiredRepositories: ["example/project", "missing/project"] };
  assert.equal(canPublishSnapshot(snapshot(), options), false);
  assert.deepEqual(snapshotPublicationIssues(snapshot(), options), ["Required repository unavailable: missing/project"]);
});
test("aliases survive transfers but a reused repository name requires identity review", () => {
  const previousSnapshot = snapshot();
  const renamed = repository("new-owner/renamed", { aliases: ["example/project"] });
  const options = { requiredRepositories: ["EXAMPLE/PROJECT"], previousSnapshot };
  assert.equal(canPublishSnapshot(snapshot({ repositories: [renamed] }), options), true);
  const replacement = repository("example/project", { id: "unrelated-new-node" });
  assert.equal(canPublishSnapshot(snapshot({ repositories: [replacement] }), options), false);
  assert.match(snapshotPublicationIssues(snapshot({ repositories: [replacement] }), options)[0], /identity changed/);
});
test("cached resume retains its original cutoff and invalidates pre-history activity", () => {
  const cache = { version: 2, collectedAt: cutoff, owners: { old: { complete: true } }, repositories: { repo: 1 }, activity: { old: 1 } };
  const resumed = resumeCollectionCache(cache, new Date("2026-10-04T13:00:00Z"));
  assert.equal(resumed.version, ACTIVITY_CACHE_VERSION);
  assert.equal(resumed.collectedAt, cutoff);
  assert.deepEqual(resumed.owners, cache.owners);
  assert.deepEqual(resumed.activity, {});
  assert.deepEqual(resumeCollectionCache({ ...cache, version: ACTIVITY_CACHE_VERSION }, new Date(cutoff)).activity, cache.activity);
});
test("stale, future-dated and undated cache runs cannot appear as a fresh snapshot", () => {
  const now = new Date("2026-10-06T12:00:00Z");
  assert.throws(() => resumeCollectionCache({ collectedAt: cutoff }, now), /without --cached/);
  assert.throws(() => resumeCollectionCache({ collectedAt: "2026-10-07T12:00:00Z" }, now), /without --cached/);
  assert.throws(() => resumeCollectionCache({}, now), /without --cached/);
});

test("unlisted releases retain the original observation without contaminating current history", () => {
  const old = release("v1", "2026-08-01T12:00:00Z");
  const removed = release("v2", "2026-09-08T12:00:00Z");
  const checkedAt = "2026-09-09T12:00:00Z";
  const previous = { checkedAt, releases: [old, removed], latestRelease: old };
  const archived = unlistedReleaseHistory([old], previous, cutoff);
  assert.deepEqual(archived, [{ ...removed, lastObservedAt: checkedAt, missingAsOf: cutoff }]);
  const nextCutoff = "2026-10-05T12:00:00Z";
  const next = unlistedReleaseHistory([old], { checkedAt: cutoff, releaseHistory: [old], unlistedReleases: archived }, nextCutoff);
  assert.deepEqual(next, archived);
  assert.deepEqual(unlistedReleaseHistory([old, removed], { checkedAt: cutoff, releaseHistory: [old], unlistedReleases: archived }, nextCutoff), []);
});
test("legacy latest records outside the rolling window can be preserved as unlisted history", () => {
  const old = release("v1", "2020-01-01T12:00:00Z");
  const previous = { checkedAt: "2026-09-08T12:00:00Z", releases: [], latestRelease: old };
  assert.equal(unlistedReleaseHistory([], previous, cutoff)[0].tagName, "v1");
  assert.throws(() => unlistedReleaseHistory([], { ...previous, checkedAt: "2026-11-01T12:00:00Z" }, cutoff), /observation date/);
});

test("a transferred repository does not make the same release tag look unlisted", () => {
  const before = release("v1", "2026-09-01T12:00:00Z");
  const after = { ...before, url: "https://github.com/new-owner/renamed/releases/tag/v1" };
  const previous = { checkedAt: "2026-09-08T12:00:00Z", releases: [before], latestRelease: before };
  assert.deepEqual(unlistedReleaseHistory([after], previous, cutoff), []);
});
