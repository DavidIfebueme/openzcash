import { describe, expect, it } from "vitest";
import { safeExternalUrl } from "@/lib/ecosystem/catalog";
import { COMMUNITIES, COMMUNITIES_VERIFIED_ON } from "@/lib/communities/data";
import type { Catalog, Repository } from "@/lib/ecosystem/types";
import registry from "@/data/ecosystem/registry.json";
import snapshot from "@/data/ecosystem/snapshot.json";
import { buildProjectHistory } from "./build";
import { historyIdentities } from "./identities";
import { projectInsights } from "./insights";
import { projectSourceContext } from "./sources";
import type { FinanceRecords, HistoryIdentity } from "./types";

const checkedAt = "2026-10-04T21:05:24.676Z";
const repo: Repository = {
  id: "alpha", fullName: "example/alpha", name: "alpha", owner: "example", url: "https://github.com/example/alpha",
  description: "Test repository", homepage: null, archived: false, fork: false, disabled: false, language: "Rust",
  topics: [], stars: 0, createdAt: "2024-01-01T00:00:00Z", pushedAt: "2026-09-20T10:00:00Z", defaultBranch: "main",
  sourceUrl: "https://api.github.com/repos/example/alpha", aliases: [],
  activity: { checkedAt, since: {}, commits: {}, latestRelease: null, releases: [], releaseHistory: [], sourceUrl: "https://github.com/example/alpha/activity" },
};
const identity: HistoryIdentity = {
  id: "alpha", name: "Alpha", description: "Test", category: "Infrastructure", website: "https://example.org",
  communityId: null, recipientKeys: [], applicationTopics: [], reportTopics: [], repositories: [repo], checkedAt: "2026-09-01",
  project: { id: "alpha", name: "Alpha", description: "Test", category: "Infrastructure", website: "https://example.org", organizationId: null,
    tags: [], repositories: [repo.fullName], sources: [
      { title: "Official Alpha documentation", url: "https://EXAMPLE.ORG:443/" },
      { title: "Scope evidence", url: "https://example.org/proposal#scope" },
    ], funding: { label: "Grant", status: "approved", events: [{ title: "Alpha grant", status: "approved", program: "zcg", date: "2024-01-01",
      sourceUrl: "https://example.org/decision", scopeSourceUrl: "https://example.org/proposal#scope", reviewedAt: "2026-10-02" }] } },
};
const finance: FinanceRecords = { proposals: [], payments: [], proposalsAvailable: true, paymentsAvailable: true, importedAt: null };
const make = (current = identity) => buildProjectHistory(current, [current], finance, checkedAt, [], new Date(checkedAt));

describe("project history source coverage", () => {
  it("keeps reviewed references and source observation dates without promoting repository pushes to work", () => {
    const history = make();
    expect(history.sources.find(s => s.url === "https://example.org/")).toEqual({
      kind: "website", label: "Official Alpha documentation", url: "https://example.org/", observedAt: identity.checkedAt,
    });
    expect(history.sources.find(s => s.url === "https://example.org/proposal#scope")).toMatchObject({
      kind: "funding", label: "Scope evidence", observedAt: "2026-10-02",
    });
    expect(history.repositories).toEqual([{ name: repo.fullName, url: repo.url, archived: false, lastPushedAt: repo.pushedAt,
      source: { label: "Repository metadata", url: repo.sourceUrl, observedAt: checkedAt }, activityUrl: repo.activity!.sourceUrl }]);
    expect(history.timeline.map(event => event.kind)).toEqual(["context"]);
    expect(projectInsights(history)).toMatchObject({ latestWork: null, publicWorkSources: 0, publishedArtifacts: 0, acceptedEntries: 0 });
    expect(history.grants.every(grant => grant.milestones.every(m => m.deliveryEvidence.length === 0))).toBe(true);
  });

  it("replaces generic catalog labels with the matching source role while retaining genuine titles", () => {
    const current = structuredClone(identity);
    current.project!.sources = [
      { title: "Maintainer repository and project evidence", url: current.website },
      { title: "Project scope or funding evidence", url: "https://example.org/proposal#scope" },
      { title: "Maintainer repository and project evidence", url: repo.url },
      { title: "Independent design rationale", url: "https://example.org/design" },
    ];
    const history = make(current);
    expect(history.sources.find(source => source.url === "https://example.org/")?.label).toBe("Project website");
    expect(history.sources.find(source => source.url === "https://example.org/proposal#scope")?.label).toBe("Alpha grant · proposal scope");
    expect(history.sources.find(source => source.url === repo.url)?.label).toBe(repo.fullName);
    expect(history.sources.find(source => source.url === "https://example.org/design")?.label).toBe("Independent design rationale");
  });

  it("names grant ledger and requested-amount sources without changing provenance", () => {
    const source = { label: "OpenZcash proposal ledger", url: "https://example.org/ledger#row=9", observedAt: "2026-10-01" };
    const requestedSource = { label: "Requested amount source", url: "https://example.org/request", observedAt: "2026-10-02" };
    const grant = { ...make().grants[0], source, requestedAmountReview: { basis: "fixed" as const, summary: "Reviewed request", source: requestedSource } };
    const { sources } = projectSourceContext(identity, [grant], [], checkedAt);
    expect(sources.find(item => item.url === source.url)).toEqual({ ...source, kind: "funding", label: "Alpha grant · ledger" });
    expect(sources.find(item => item.url === requestedSource.url)).toEqual({ ...requestedSource, kind: "funding", label: "Alpha grant · requested amount" });
  });

  it("omits unsafe references and repositories without inventing a replacement home URL", () => {
    const unsafe = structuredClone(identity);
    unsafe.website = "javascript:alert(1)";
    unsafe.project!.sources = [{ title: "Unsafe", url: "https://secret:password@example.org/" }, { title: "Data", url: "data:text/html,unsafe" }];
    unsafe.project!.funding.events = [];
    unsafe.repositories = [{ ...repo, url: "javascript:alert(1)" }];
    const result = projectSourceContext(unsafe, [], [], checkedAt);
    expect(result).toEqual({ sources: [], repositories: [] });
  });

  it("retains exact source fragments and unknown dates instead of replacing them with snapshot time", () => {
    const current = structuredClone(identity);
    current.project!.sources = [
      { title: "Sheet row one", url: "https://example.org/sheet#row=1" },
      { title: "Sheet row two", url: "https://example.org/sheet#row=2" },
    ];
    current.checkedAt = "2026-02-30";
    current.repositories = [{ ...repo, pushedAt: "2026-02-30", activity: null }];
    const history = make(current);
    expect(history.sources.filter(s => s.url.includes("/sheet#"))).toHaveLength(2);
    expect(history.sources.find(s => s.url.endsWith("#row=1"))?.observedAt).toBeNull();
    expect(history.repositories[0]).toMatchObject({ lastPushedAt: null, activityUrl: null, source: { observedAt: checkedAt } });
  });

  it("uses a bounded release archive reference while keeping every publication in Activity", () => {
    const releases = Array.from({ length: 1000 }, (_, n) => ({ name: null, tagName: `v${n}`, publishedAt: "2026-09-01T00:00:00Z",
      url: `https://github.com/example/alpha/releases/tag/v${n}`, isPrerelease: false }));
    const current = { ...identity, repositories: [{ ...repo, activity: { ...repo.activity!, releaseHistory: releases } }] };
    const history = make(current);
    expect(history.timeline.filter(event => event.kind === "release")).toHaveLength(1000);
    expect(history.sources.filter(source => source.kind === "repository")).toHaveLength(3);
    expect(history.sources.some(source => source.url.endsWith("/releases"))).toBe(true);
    expect(history.sources.some(source => source.url.includes("/releases/tag/"))).toBe(false);
  });

  it("preserves withdrawn publication status separately from the repository source directory", () => {
    const unlisted = { tagName: "v0.1", name: null, publishedAt: "2025-01-01T00:00:00Z", url: `${repo.url}/releases/tag/v0.1`, isPrerelease: false,
      lastObservedAt: "2026-09-01T00:00:00Z", missingAsOf: checkedAt };
    const current = { ...identity, repositories: [{ ...repo, activity: { ...repo.activity!, unlistedReleases: [unlisted] } }] };
    const history = make(current);
    expect(history.timeline.find(event => event.kind === "release")).toMatchObject({ sourceState: "unlisted", source: { observedAt: unlisted.lastObservedAt } });
    expect(projectInsights(history).latestWork).toBeNull();
    expect(history.sources.find(source => source.url === repo.url)?.observedAt).toBe(checkedAt);
  });

  it("keeps curated community profiles visible without treating them as published work", () => {
    const identities = historyIdentities({ registry, snapshot } as unknown as Catalog);
    for (const community of COMMUNITIES) {
      const current = identities.find(item => item.communityId === community.id)!;
      const history = make(current);
      const urls = new Set(history.sources.map(source => source.url));
      for (const value of Object.values(community.links)) {
        const url = safeExternalUrl(value);
        if (url) expect(urls.has(url), `${community.id}: ${url}`).toBe(true);
      }
      for (const topic of community.forumTopics) expect(urls.has(`https://forum.zcashcommunity.com/t/${topic.id}`), `${community.id}: topic ${topic.id}`).toBe(true);
      expect(history.sources.length, community.id).toBeGreaterThan(0);
      expect(history.sources.every(source => source.url.startsWith("https://") || source.url.startsWith("http://"))).toBe(true);
      expect(current.referenceSources?.every(source => source.observedAt === COMMUNITIES_VERIFIED_ON)).toBe(true);
    }
    const profileOnly = identities.find(item => item.id === "community-zcash-indonesia")!;
    const history = make(profileOnly);
    expect(history.sources.length).toBeGreaterThan(0);
    expect(projectInsights(history)).toMatchObject({ latestWork: null, publicWorkSources: 0, acceptedEntries: 0 });
    expect(history.sources.some(source => source.url === "/communities")).toBe(false);
  });

  it("projects every safe registry reference and linked canonical repository across the full catalog", () => {
    const identities = historyIdentities({ registry, snapshot } as unknown as Catalog);
    for (const current of identities) {
      const history = make(current);
      const urls = new Set(history.sources.map(source => source.url));
      for (const reference of current.project?.sources ?? []) {
        const url = safeExternalUrl(reference.url);
        if (url) expect(urls.has(url), `${current.id}: ${url}`).toBe(true);
      }
      for (const repository of current.repositories) expect(urls.has(safeExternalUrl(repository.url)!), `${current.id}: ${repository.fullName}`).toBe(true);
    }
    const webzjs = make(identities.find(i => i.id === "webzjs")!);
    expect(webzjs.sources.some(source => source.url === "https://github.com/ChainSafe/WebZjs")).toBe(true);
    expect(webzjs.repositories).toHaveLength(1);
    expect(projectInsights(webzjs).latestWork).toBeNull();
  });
});
