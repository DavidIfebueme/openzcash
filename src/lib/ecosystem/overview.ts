import { activitySummary, classifyRepositories, isGrantFunded, safeExternalUrl } from "./catalog";
import { isPreviewRelease } from "./releases";
import type { Catalog, Repository } from "./types";

export const OVERVIEW_WINDOWS = [7, 30, 90] as const;
export type OverviewDays = typeof OVERVIEW_WINDOWS[number];

export type OverviewWindow = {
  days: OverviewDays;
  since: string;
  end: string;
  activeRepositories: number;
  measuredRepositories: number;
  unmeasuredRepositories: number;
  totalRepositories: number;
};

export type OverviewRelease = {
  repositoryId: string;
  repository: string;
  projectIds: string[];
  tagName: string;
  publishedAt: string;
  url: string;
  /** Includes an explicit alpha/beta/rc marker even when GitHub's flag is false. */
  isPrerelease: boolean;
};

/** A bounded, reproducible projection of the checked catalog; no live sources or financial joins. */
export function buildEcosystemOverview(catalog: Catalog) {
  const cutoff = Date.parse(catalog.snapshot.collectedAt);
  if (!Number.isFinite(cutoff)) throw new Error("Overview requires a valid repository snapshot date");
  const repositories = [...new Map(catalog.snapshot.repositories.map(repo => [repo.id, repo])).values()];
  const classified = classifyRepositories({ ...catalog, snapshot: { ...catalog.snapshot, repositories } });
  const projects = [...new Map(catalog.registry.projects.map(project => [project.id, project])).values()];
  const projectRepositories = classified.filter(repo => repo.projects.length > 0);
  const sameWindow = (repo: Repository, days: OverviewDays) => repo.activity !== null &&
    Date.parse(repo.activity.checkedAt) === cutoff &&
    Date.parse(repo.activity.since[String(days)]) === cutoff - days * 86_400_000;
  const windows = Object.fromEntries(OVERVIEW_WINDOWS.map(days => {
    // Match the existing activity summary: forks are excluded, archived originals remain eligible.
    // A measurement made for a different cutoff cannot silently become this snapshot's activity.
    const activity = activitySummary(repositories.map(repo => sameWindow(repo, days) ? repo : { ...repo, activity: null }), days);
    return [days, {
      days,
      since: new Date(cutoff - days * 86_400_000).toISOString(),
      end: catalog.snapshot.collectedAt,
      activeRepositories: activity.active,
      measuredRepositories: activity.measured,
      unmeasuredRepositories: activity.eligible - activity.measured,
      totalRepositories: activity.eligible,
    }];
  })) as Record<OverviewDays, OverviewWindow>;

  const releases = new Map<string, OverviewRelease>();
  const since = Date.parse(windows[30].since);
  for (const repo of projectRepositories.toSorted((a, b) => a.fullName.localeCompare(b.fullName))) {
    if (repo.fork || repo.archived || repo.disabled || !sameWindow(repo, 30)) continue;
    // This is the current bounded listing. The full archive and unlisted records cannot become news.
    for (const release of repo.activity?.releases ?? []) {
      const date = Date.parse(release.publishedAt);
      const url = safeExternalUrl(release.url);
      if (!url || !Number.isFinite(date) || date < since || date > cutoff) continue;
      const projectIds = [...new Set(repo.projects.map(project => project.id))].sort();
      const existing = releases.get(url);
      if (existing) {
        existing.projectIds = [...new Set([...existing.projectIds, ...projectIds])].sort();
        continue;
      }
      releases.set(url, {
        repositoryId: repo.id,
        repository: repo.fullName,
        projectIds,
        tagName: release.tagName,
        publishedAt: release.publishedAt,
        url,
        isPrerelease: isPreviewRelease(release),
      });
    }
  }
  const releases30d = [...releases.values()].sort((a, b) =>
    Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.repository.localeCompare(b.repository) || a.url.localeCompare(b.url));
  const latestByRepository = new Map<string, OverviewRelease>();
  for (const release of releases30d) {
    if (!latestByRepository.has(release.repositoryId)) latestByRepository.set(release.repositoryId, release);
  }

  const categoryCounts = new Map<string, number>();
  const fundingCoverage = {
    grantLinkedProjects: 0,
    organizationSupportedProjects: 0,
    applicationOnlyProjects: 0,
    unverifiedProjects: 0,
    otherProjects: 0,
  };
  for (const project of projects) {
    categoryCounts.set(project.category, (categoryCounts.get(project.category) ?? 0) + 1);
    // These mutually exclusive counts describe associations, never payments or separate awards.
    if (isGrantFunded(project)) fundingCoverage.grantLinkedProjects += 1;
    else if (project.funding.status === "organization-supported") fundingCoverage.organizationSupportedProjects += 1;
    else if (project.funding.status === "application-only") fundingCoverage.applicationOnlyProjects += 1;
    else if (["unassessed", "not-verified"].includes(project.funding.status)) fundingCoverage.unverifiedProjects += 1;
    else fundingCoverage.otherProjects += 1;
  }

  return {
    snapshotAt: catalog.snapshot.collectedAt,
    registryCheckedAt: catalog.registry.checkedAt,
    counts: {
      projects: projects.length,
      organizations: new Set(catalog.registry.organizations.map(org => org.id)).size,
      repositories: repositories.length,
      originalRepositories: repositories.filter(repo => !repo.fork).length,
      projectRepositories: projectRepositories.length,
    },
    categories: [...categoryCounts].map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)),
    windows,
    recentReleases: [...latestByRepository.values()].slice(0, 6),
    // "Stable" means no preview flag/marker; it does not establish production readiness or activation.
    stableReleaseCount30d: releases30d.filter(release => !release.isPrerelease).length,
    prereleaseCount30d: releases30d.filter(release => release.isPrerelease).length,
    repositoriesWithReleases30d: latestByRepository.size,
    projectsWithReleases30d: new Set(releases30d.flatMap(release => release.projectIds)).size,
    fundingCoverage,
  };
}

export type EcosystemOverview = ReturnType<typeof buildEcosystemOverview>;
