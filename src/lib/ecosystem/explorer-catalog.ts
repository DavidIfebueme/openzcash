import type { Catalog } from "./types";

/** Only the explorer's bounded activity window crosses its client boundary.
 * Full release history remains in the public API and project histories. */
export function explorerCatalog(catalog: Catalog): Catalog {
  return {
    registry: catalog.registry,
    snapshot: {
      ...catalog.snapshot,
      repositories: catalog.snapshot.repositories.map(repo => ({
        ...repo,
        activity: repo.activity ? {
          checkedAt: repo.activity.checkedAt,
          since: repo.activity.since,
          commits: repo.activity.commits,
          latestRelease: repo.activity.latestRelease,
          releases: repo.activity.releases,
          sourceUrl: repo.activity.sourceUrl,
        } : null,
      })),
    },
  };
}
