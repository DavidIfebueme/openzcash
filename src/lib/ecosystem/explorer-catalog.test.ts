import { describe, expect, it } from "vitest";
import { explorerCatalog } from "./explorer-catalog";
import type { Catalog, Repository } from "./types";

const release = { name: "v2", tagName: "v2", publishedAt: "2026-09-20T00:00:00Z", url: "https://github.com/example/project/releases/tag/v2", isPrerelease: false };
const old = { ...release, name: "v1", tagName: "v1", publishedAt: "2020-01-01T00:00:00Z", url: "https://github.com/example/project/releases/tag/v1" };
const repo: Repository = {
  id: "stable-id", fullName: "example/project", name: "project", owner: "example",
  url: "https://github.com/example/project", sourceUrl: "https://api.github.com/repos/example/project",
  description: "Example", homepage: null, archived: false, fork: false, disabled: false,
  language: "Rust", topics: [], stars: 1, createdAt: "2020-01-01", pushedAt: null,
  defaultBranch: "main", aliases: ["former/project"], activity: {
    checkedAt: "2026-10-04T00:00:00Z", since: { "90": "2026-07-06T00:00:00Z" }, commits: { "90": 20 },
    latestRelease: release, releases: [release], releaseHistory: [release, old],
    unlistedReleases: [{ ...old, lastObservedAt: "2026-09-08T00:00:00Z", missingAsOf: "2026-10-04T00:00:00Z" }],
    sourceUrl: "https://github.com/example/project/activity",
  },
};
const catalog: Catalog = {
  registry: { schemaVersion: 1, checkedAt: "2026-09-08", organizations: [], projects: [], owners: [], selectedRepositories: [], coverageNotes: [], grantReview: { totalApproved: 0, classification: [], unresolved: [] } },
  snapshot: { schemaVersion: 1, collectedAt: "2026-10-04T00:00:00Z", registryHash: "example", owners: [], repositories: [repo], problems: [], selectedRepositoryCount: 1 },
};

describe("explorer client projection", () => {
  it("retains bounded activity and provenance without shipping all historical releases", () => {
    const before = structuredClone(catalog);
    const compact = explorerCatalog(catalog);
    expect(compact.snapshot.repositories[0].activity).toEqual({
      checkedAt: repo.activity!.checkedAt, since: repo.activity!.since, commits: repo.activity!.commits,
      latestRelease: release, releases: [release], sourceUrl: repo.activity!.sourceUrl,
    });
    expect(compact.snapshot.repositories[0].aliases).toEqual(["former/project"]);
    expect(compact.registry).toEqual(catalog.registry);
    expect(catalog).toEqual(before);
    expect(catalog.snapshot.repositories[0].activity!.releaseHistory).toHaveLength(2);
    expect(catalog.snapshot.repositories[0].activity!.unlistedReleases).toHaveLength(1);
    expect(JSON.stringify(compact)).not.toContain("releaseHistory");
    expect(JSON.stringify(compact)).not.toContain("unlistedReleases");
  });
  it("keeps unavailable activity null instead of turning it into empty measured records", () => {
    const compact = explorerCatalog({ ...catalog, snapshot: { ...catalog.snapshot, repositories: [{ ...repo, activity: null }] } });
    expect(compact.snapshot.repositories[0].activity).toBeNull();
  });
});
