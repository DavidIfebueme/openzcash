import test from "node:test";
import assert from "node:assert/strict";
import { collectEcosystem } from "./ecosystem-sync.mjs";
const startedAt = "2026-10-16T03:30:00.000Z";
const registry = { owners: [{ login: "public", scope: "all", sourceUrl: "https://github.com/public" }], projects: [{ repositories: ["public/wallet"] }], selectedRepositories: [] };
const repo = { private: false, node_id: "R_public", full_name: "public/wallet", name: "wallet", owner: { login: "public" }, html_url: "https://github.com/public/wallet" };
const release = { name: "v1", tagName: "v1", publishedAt: "2026-10-15T00:00:00Z", url: "https://github.com/public/wallet/releases/tag/v1", isPrerelease: false, isDraft: false };
const connection = (nodes, more = false) => ({ nodes, pageInfo: { hasNextPage: more, endCursor: more ? "next" : null } });
function transport({ privateFirst = false, privateNext = false, changedId = false, failOwner = false } = {}) {
  const calls = [];
  return { calls, request: async (endpoint, query) => {
    calls.push({ endpoint, query });
    if (endpoint === "users/public") return { login: "public", type: "Organization" };
    if (endpoint.startsWith("orgs/public/repos")) { if (failOwner) throw new Error("Unavailable"); return [repo, { ...repo, private: true, node_id: "PRIVATE" }]; }
    if (endpoint === "repos/public/wallet") return repo;
    if (endpoint === "graphql" && query.includes("after:")) return { data: { repository: {
      id: changedId ? "R_different" : repo.node_id, isPrivate: privateNext,
      releases: connection([{ ...release, tagName: "draft", isDraft: true }]),
    } } };
    if (endpoint === "graphql") return { data: { r0: {
      id: repo.node_id, isPrivate: privateFirst, isEmpty: false, defaultBranchRef: { target: { d7: { totalCount: 1 }, d30: { totalCount: 2 }, d90: { totalCount: 3 } } },
      latestRelease: release, releases: connection([release], true),
    } } };
    throw new Error("Unexpected request");
  } };
}
test("CLI/server core keeps complete public inventories, release pagination and the shared cutoff", async () => {
  const { request, calls } = transport();
  const result = await collectEcosystem({ registry, request, startedAt });
  assert.deepEqual(result.publicationIssues, []);
  assert.equal(result.snapshot.repositories.length, 1);
  assert.equal(result.snapshot.repositories[0].activity.checkedAt, startedAt);
  assert.equal(result.snapshot.repositories[0].activity.releaseHistory.length, 1);
  assert.deepEqual(result.snapshot.repositories[0].activity.commits, { 7: 1, 30: 2, 90: 3 });
  assert.equal(calls.filter(call => call.query?.includes("after:")).length, 1);
  assert.ok(calls.filter(call => call.query).every(call => call.query.includes("isPrivate")));
});
for (const reason of ["privateFirst", "privateNext", "changedId", "failOwner"]) {
  test(`does not publish when source validation fails: ${reason}`, async () => {
    const { request } = transport({ [reason]: true });
    const result = await collectEcosystem({ registry, request, startedAt });
    assert.ok(result.publicationIssues.length > 0);
    assert.ok(!JSON.stringify(result.snapshot).includes("PRIVATE"));
  });
}
test("keeps unlisted release evidence from the prior publication", async () => {
  const { request } = transport();
  const previous = (await collectEcosystem({ registry, request, startedAt })).snapshot;
  previous.repositories[0].activity.releaseHistory.push({ ...release, tagName: "old", url: release.url + "-old" });
  const result = await collectEcosystem({ registry, request, previousSnapshot: previous, startedAt: "2026-10-17T03:30:00.000Z" });
  assert.equal(result.snapshot.repositories[0].activity.unlistedReleases[0].tagName, "old");
  assert.equal(result.snapshot.repositories[0].activity.unlistedReleases[0].lastObservedAt, startedAt);
});
