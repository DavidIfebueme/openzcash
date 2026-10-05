import { describe, expect, it } from "vitest";
import { buildEcosystemOverview } from "./overview";
import type { Catalog, Project, Release, Repository } from "./types";

const cutoff = "2026-10-04T21:05:24.676Z";
const project = (id: string, repositories = ["owner/shared"], overrides: Partial<Project> = {}): Project => ({
  id, name: id, organizationId: null, category: "Infrastructure", tags: [], description: "Test project",
  website: "https://example.org", repositories, funding: { label: "Unassessed", status: "unassessed", events: [] },
  sources: [{ title: "Source", url: "https://example.org" }], ...overrides,
});
const release = (tagName: string, publishedAt = "2026-10-01T12:00:00Z", overrides: Partial<Release> = {}): Release => ({
  name: tagName, tagName, publishedAt, isPrerelease: false,
  url: `https://github.com/owner/shared/releases/tag/${tagName}`, ...overrides,
});
const repository = (id = "shared", overrides: Partial<Repository> = {}): Repository => ({
  id, fullName: `owner/${id}`, name: id, owner: "owner", url: `https://github.com/owner/${id}`,
  description: "Test repository", homepage: null, archived: false, fork: false, disabled: false,
  language: "Rust", topics: [], stars: 0, createdAt: "2024-01-01", pushedAt: cutoff, defaultBranch: "main",
  sourceUrl: `https://api.github.com/repos/owner/${id}`, aliases: [],
  activity: { checkedAt: cutoff,
    since: { "7": "2026-09-27T21:05:24.676Z", "30": "2026-09-04T21:05:24.676Z", "90": "2026-07-06T21:05:24.676Z" },
    commits: { "7": 1, "30": 2, "90": 3 }, latestRelease: null, releases: [],
    sourceUrl: `https://github.com/owner/${id}/activity` },
  ...overrides,
});
const catalog = (repositories: Repository[], projects: Project[] = [project("one")]): Catalog => ({
  registry: { schemaVersion: 1, checkedAt: "2026-09-08T23:10:23Z", organizations: [], projects,
    owners: [], selectedRepositories: [], coverageNotes: [], grantReview: { totalApproved: 0, classification: [], unresolved: [] } },
  snapshot: { schemaVersion: 1, collectedAt: cutoff, registryHash: "test", owners: [], repositories,
    problems: [], selectedRepositoryCount: 0 },
});

describe("ecosystem overview measurement coverage", () => {
  it("keeps missing measurements distinct from zero and excludes forks in every window", () => {
    const zero = repository("zero");
    zero.activity!.commits = { "7": 0, "30": 0, "90": 0 };
    const partial = repository("partial");
    partial.activity!.commits = { "7": null, "30": 0, "90": 3 };
    const overview = buildEcosystemOverview(catalog([
      repository(), zero, partial, repository("missing", { activity: null }),
      repository("fork", { fork: true }), repository("archived", { archived: true }),
    ]));
    expect(overview.windows[7]).toEqual({ days: 7, since: "2026-09-27T21:05:24.676Z", end: cutoff,
      activeRepositories: 2, measuredRepositories: 3, unmeasuredRepositories: 2, totalRepositories: 5 });
    expect(overview.windows[30]).toMatchObject({ since: "2026-09-04T21:05:24.676Z",
      activeRepositories: 2, measuredRepositories: 4, unmeasuredRepositories: 1 });
    expect(overview.windows[90]).toMatchObject({ since: "2026-07-06T21:05:24.676Z", activeRepositories: 3 });
    expect(overview.counts).toMatchObject({ repositories: 6, originalRepositories: 5 });
  });

  it("counts canonical repository IDs once across projects and former owner aliases", () => {
    const repo = repository("shared", { aliases: ["OldOwner/Shared"] });
    const overview = buildEcosystemOverview(catalog([repo, repo], [
      project("one"), project("two", ["OLDOWNER/SHARED"]), project("no-code", []),
    ]));
    expect(overview.counts).toEqual({ projects: 3, organizations: 0, repositories: 1,
      originalRepositories: 1, projectRepositories: 1 });
    expect(overview.categories).toEqual([{ category: "Infrastructure", count: 3 }]);
  });

  it("treats activity collected for another cutoff or start date as unmeasured", () => {
    const old = repository("old"), shifted = repository("shifted");
    old.activity!.checkedAt = "2026-10-03T21:05:24.676Z";
    shifted.activity!.since["30"] = "2026-09-03T21:05:24.676Z";
    old.activity!.releases = [release("old-source")];
    shifted.activity!.releases = [release("shifted-source")];
    const overview = buildEcosystemOverview(catalog([old, shifted], [project("one", ["owner/old", "owner/shifted"])]));
    expect(overview.windows[30]).toMatchObject({ activeRepositories: 0, measuredRepositories: 0,
      unmeasuredRepositories: 2, totalRepositories: 2 });
    expect(overview.windows[7]).toMatchObject({ activeRepositories: 1, measuredRepositories: 1, unmeasuredRepositories: 1 });
    expect(overview.recentReleases).toEqual([]);
  });

  it("handles an empty catalog and rejects a missing cutoff without reading the clock", () => {
    const empty = buildEcosystemOverview(catalog([], []));
    expect(empty.windows[30]).toMatchObject({ totalRepositories: 0, measuredRepositories: 0,
      unmeasuredRepositories: 0, activeRepositories: 0 });
    expect(empty.recentReleases).toEqual([]);
    const invalid = catalog([]);
    invalid.snapshot.collectedAt = "invalid";
    expect(() => buildEcosystemOverview(invalid)).toThrow("valid repository snapshot date");
  });
});

describe("ecosystem overview current releases", () => {
  it("uses inclusive snapshot boundaries, excludes missing/future dates and ignores removed archive records", () => {
    const repo = repository();
    repo.activity!.releases = [
      release("start", "2026-09-04T21:05:24.676Z"), release("end", cutoff),
      release("old", "2026-09-04T21:05:24.675Z"), release("future", "2026-10-04T21:05:24.677Z"),
      release("invalid", "not-a-date"), release("unsafe", undefined, { url: "javascript:alert(1)" }),
    ];
    repo.activity!.releaseHistory = [release("archive-only")];
    repo.activity!.unlistedReleases = [{ ...release("removed"), lastObservedAt: cutoff, missingAsOf: cutoff }];
    const overview = buildEcosystemOverview(catalog([repo]));
    expect(overview.recentReleases.map(item => item.tagName)).toEqual(["end"]);
    expect(overview.stableReleaseCount30d).toBe(2);
    expect(overview.repositoriesWithReleases30d).toBe(1);
  });

  it("excludes forks, archived/disabled repositories and repositories without a project association", () => {
    const repos = [repository("fork", { fork: true }), repository("archived", { archived: true }),
      repository("disabled", { disabled: true }), repository("unmapped"), repository()];
    for (const repo of repos) repo.activity!.releases = [release(repo.id)];
    const overview = buildEcosystemOverview(catalog(repos, [
      project("one", ["owner/fork", "owner/archived", "owner/disabled", "owner/shared"]),
    ]));
    expect(overview.recentReleases.map(item => item.repositoryId)).toEqual(["shared"]);
    expect(overview.projectsWithReleases30d).toBe(1);
  });

  it("deduplicates shared releases by source URL and recognizes preview tags independently of API flags", () => {
    const shared = repository(), other = repository("other");
    shared.activity!.releases = [release("v1"), release("v1"), release("v2.0-rc.1"),
      release("v3", undefined, { isPrerelease: true })];
    other.activity!.releases = [release("v1")];
    const overview = buildEcosystemOverview(catalog([shared, other], [
      project("one"), project("two"), project("three", ["owner/other"]),
    ]));
    expect(overview.recentReleases).toHaveLength(2);
    expect(overview.recentReleases.find(item => item.tagName === "v1")!.projectIds).toEqual(["one", "three", "two"]);
    expect(overview.stableReleaseCount30d).toBe(1);
    expect(overview.prereleaseCount30d).toBe(2);
    expect(overview.projectsWithReleases30d).toBe(3);
  });

  it("takes the latest per repository, caps the list and retains full totals with deterministic ties", () => {
    const repos = Array.from({ length: 8 }, (_, index) => {
      const repo = repository(`repo-${index}`);
      repo.activity!.releases = [release(`v${index}`, `2026-09-${String(20 + index).padStart(2, "0")}T12:00:00Z`)];
      return repo;
    });
    repos[7].activity!.releases.push(release("v7-older", "2026-09-05T12:00:00Z"));
    const projects = [project("one", repos.map(repo => repo.fullName))];
    const overview = buildEcosystemOverview(catalog(repos, projects));
    expect(overview.recentReleases.map(item => item.tagName)).toEqual(["v7", "v6", "v5", "v4", "v3", "v2"]);
    expect(overview.stableReleaseCount30d).toBe(9);
    expect(overview.repositoriesWithReleases30d).toBe(8);
    repos.forEach(repo => repo.activity!.releases.forEach(item => { item.publishedAt = "2026-10-01T12:00:00Z"; }));
    const forward = buildEcosystemOverview(catalog(repos, projects)).recentReleases;
    repos.reverse().forEach(repo => repo.activity!.releases.reverse());
    expect(buildEcosystemOverview(catalog(repos, projects)).recentReleases).toEqual(forward);
  });
});

describe("ecosystem overview funding associations", () => {
  it("counts projects once, distinguishes application/organization context, and never totals overlapping awards", () => {
    const award = { title: "Shared grant", status: "approved", sourceUrl: "https://example.org/grant" };
    const funding = (status: string, events: Project["funding"]["events"] = []) => ({ status, label: status, events });
    const overview = buildEcosystemOverview(catalog([], [
      project("funded-one", [], { funding: funding("historical-approval", [award, award]) }),
      project("funded-two", [], { funding: funding("historical-approval", [award]) }),
      project("organization", [], { funding: funding("organization-supported", [{ ...award, status: "organization-level" }]) }),
      project("application", [], { funding: funding("application-only", [{ ...award, status: "submitted-past-deadline" }]) }),
      project("unassessed", [], { funding: funding("unassessed") }),
      project("context", [], { funding: funding("not-verified", [{ ...award, kind: "context" }]) }),
      project("other", [], { funding: funding("future-state") }),
    ]));
    expect(overview.fundingCoverage).toEqual({ grantLinkedProjects: 2, organizationSupportedProjects: 1,
      applicationOnlyProjects: 1, unverifiedProjects: 2, otherProjects: 1 });
    expect(Object.values(overview.fundingCoverage).reduce((sum, count) => sum + count, 0)).toBe(overview.counts.projects);
  });
});
