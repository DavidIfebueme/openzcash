import { createHash } from "node:crypto";
import { ACTIVITY_CACHE_VERSION, collectPublicPages, collectReleasePages, releaseActivity, unlistedReleaseHistory, snapshotPublicationIssues } from "./ecosystem-collection.mjs";

// Shared by the gh CLI and the server's fixed-host HTTP transport. Only public
// metadata is collected; no repository code is cloned or executed.
export async function collectEcosystem({ registry, previousSnapshot = null, request,
  startedAt = new Date().toISOString(), cached = { version: ACTIVITY_CACHE_VERSION, owners: {}, repositories: {}, activity: {} },
  reuseCache = false, report = () => {} }) {
  if (!Number.isFinite(Date.parse(startedAt))) throw new Error("Invalid collection cutoff");
  cached.collectedAt = startedAt;
  const problems = [];
  async function mapLimit(items, parallelism, fn) {
    let next = 0;
    const result = new Array(items.length);
    await Promise.all(Array.from({ length: Math.min(parallelism, items.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= items.length) break;
        result[index] = await fn(items[index], index);
      }
    }));
    return result;
  }

  function publicRepository(repo) {
    if (repo.private !== false || !repo.node_id || !repo.full_name) {
      throw new Error("Repository visibility or identity could not be verified");
    }
    return {
      id: repo.node_id, fullName: repo.full_name, name: repo.name,
      owner: repo.owner.login, url: repo.html_url,
      description: repo.description || "", homepage: repo.homepage || null,
      archived: repo.archived === true, fork: repo.fork === true,
      disabled: repo.disabled === true, language: repo.language,
      topics: repo.topics || [], stars: repo.stargazers_count || 0,
      createdAt: repo.created_at, pushedAt: repo.pushed_at,
      defaultBranch: repo.default_branch,
      sourceUrl: "https://api.github.com/repos/" + repo.full_name,
    };
  }

  async function collectOwner(owner) {
    const key = owner.login.toLowerCase();
    if (reuseCache && cached.owners[key]?.complete) return cached.owners[key];
    const user = await request("users/" + encodeURIComponent(owner.login));
    const kind = user.type === "Organization" ? "orgs" : "users";
    const endpoint = kind + "/" + encodeURIComponent(user.login) + "/repos";
    // An empty trailing page is intentionally fetched for an exact multiple of
    // 100. No first-page-only inventories and no silent page cap.
    const { items, pages } = await collectPublicPages(async page => {
      const query = "?type=" + (kind === "orgs" ? "public" : "owner") +
        "&sort=full_name&direction=asc&per_page=100&page=" + page;
      return request(endpoint + query);
    });
    const found = items.map(publicRepository);
    const value = {
      login: user.login, type: user.type, pages, complete: true,
      repositoryCount: found.length, collectedAt: new Date().toISOString(),
      sourceUrl: "https://api.github.com/" + endpoint,
      identitySource: owner.sourceUrl, repositories: found,
    };
    cached.owners[key] = value;
    report(user.login + ": " + found.length + " public repositories / " + pages + " page(s)");
    return value;
  }

  const ownerResults = await mapLimit(
    registry.owners.filter(owner => owner.scope === "all"), 3,
    async owner => {
      try { return await collectOwner(owner); }
      catch (error) {
        problems.push({ scope: owner.login, message: error.message });
        return { login: owner.login, type: "Unknown", complete: false, pages: 0,
          repositoryCount: 0, collectedAt: null, sourceUrl: owner.sourceUrl,
          identitySource: owner.sourceUrl, repositories: [] };
      }
    },
  );

  const byId = new Map();
  const canonicalNames = new Map();
  for (const result of ownerResults) {
    for (const repo of result.repositories) {
      byId.set(repo.id, repo);
      canonicalNames.set(repo.fullName.toLowerCase(), repo.id);
    }
  }
  const selectedNames = [...new Set([
    ...registry.projects.flatMap(project => project.repositories || []),
    ...(registry.selectedRepositories || []),
  ])].filter(name => /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name));
  await mapLimit(selectedNames, 4, async name => {
    if (canonicalNames.has(name.toLowerCase())) return;
    try {
      let repo = cached.repositories[name.toLowerCase()];
      if (!repo || !reuseCache) {
        repo = publicRepository(await request("repos/" + name));
        repo.collectedAt = new Date().toISOString();
        cached.repositories[name.toLowerCase()] = repo;
      }
      byId.set(repo.id, repo);
      // Retain both the requested alias and the canonical GitHub identity.
      canonicalNames.set(name.toLowerCase(), repo.id);
      canonicalNames.set(repo.fullName.toLowerCase(), repo.id);
    } catch (error) {
      problems.push({ scope: name, message: error.message });
    }
  });
  const repositories = [...byId.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
  const periods = [7, 30, 90];
  const since = Object.fromEntries(periods.map(days => [
    days, new Date(Date.parse(startedAt) - days * 86_400_000).toISOString(),
  ]));
  const activityTargets = repositories.filter(repo =>
    !reuseCache || !cached.activity[repo.id],
  );

  async function collectActivity(batch) {
    const query = "query { " + batch.map((repo, index) => {
      const [owner, name] = repo.fullName.split("/");
      return "r" + index + ": repository(owner:" + JSON.stringify(owner) +
        ",name:" + JSON.stringify(name) + ") { id isPrivate isEmpty defaultBranchRef { name target { " +
        "... on Commit { " + periods.map(days => "d" + days +
          ":history(since:" + JSON.stringify(since[days]) + ",until:" + JSON.stringify(startedAt) + ") { totalCount }").join(" ") +
        " } } } latestRelease { name tagName publishedAt url isPrerelease isDraft } " +
        "releases(first:100,orderBy:{field:CREATED_AT,direction:DESC}) {" +
        "nodes { name tagName publishedAt url isPrerelease isDraft } pageInfo { hasNextPage endCursor } } }";
    }).join(" ") + " }";
    const result = await request("graphql", query);
    for (let index = 0; index < batch.length; index++) {
      const repo = batch[index];
      const item = result.data?.["r" + index];
      if (!item || item.id !== repo.id || item.isPrivate !== false) {
        problems.push({ scope: repo.fullName, message: "Activity unavailable" });
        continue;
      }
      const commits = Object.fromEntries(periods.map(days => [
        days, item.isEmpty ? 0 : item.defaultBranchRef?.target?.["d" + days]?.totalCount ?? null,
      ]));
      // Enumerate every page: creation order and publication time can differ.
      // Stopping at an old creation date could miss a recently published release.
      const releases = await collectReleasePages(item.releases, async cursor => {
        const [owner, name] = repo.fullName.split("/");
        const page = await request("graphql", "query { repository(owner:" +
          JSON.stringify(owner) + ",name:" + JSON.stringify(name) +
          ") { id isPrivate releases(first:100,after:" + JSON.stringify(cursor) +
          ",orderBy:{field:CREATED_AT,direction:DESC}) { nodes { name tagName publishedAt url isPrerelease isDraft } " +
          "pageInfo { hasNextPage endCursor } } } }");
        if (page.data?.repository?.id !== repo.id || page.data.repository.isPrivate !== false)
          throw new Error("Repository visibility or identity changed");
        return page.data?.repository?.releases;
      });
      cached.activity[repo.id] = {
        checkedAt: startedAt, since, commits,
        ...releaseActivity(releases, item.latestRelease, startedAt, since[90]),
        unlistedReleases: unlistedReleaseHistory(releases.filter(release => release.isDraft === false),
          previousSnapshot?.repositories.find(previous => previous.id === repo.id)?.activity, startedAt),
        sourceUrl: "https://github.com/" + repo.fullName + "/activity",
      };
    }
  }

  for (let offset = 0; offset < activityTargets.length; offset += 12) {
    const batch = activityTargets.slice(offset, offset + 12);
    try { await collectActivity(batch); }
    catch {
      // One unavailable/renamed repository must not erase other repositories.
      for (const repo of batch) {
        try { await collectActivity([repo]); }
        catch { problems.push({ scope: repo.fullName, message: "Activity request failed" }); }
      }
    }
    report("Activity: " + Math.min(offset + 12, activityTargets.length) + "/" + activityTargets.length);
  }

  const snapshot = {
    schemaVersion: 1, collectedAt: startedAt,
    registryHash: createHash("sha256").update(JSON.stringify(registry)).digest("hex"),
    owners: ownerResults.map(result => {
      const owner = { ...result };
      delete owner.repositories;
      return owner;
    }),
    repositories: repositories.map(repo => ({
      ...repo, activity: cached.activity[repo.id] || null,
      aliases: [...canonicalNames.entries()].filter(([, id]) => id === repo.id)
        .map(([name]) => name).filter(name => name !== repo.fullName.toLowerCase()),
    })),
    problems, selectedRepositoryCount: selectedNames.length,
  };
  const publicationIssues = snapshotPublicationIssues(snapshot, { requiredRepositories: selectedNames, previousSnapshot });
  return { snapshot, cached, publicationIssues };
}
