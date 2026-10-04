import type { Catalog, ClassifiedRepository, Organization, Project, Repository } from "./types";

export const CATEGORIES = [
  "Nodes", "Wallets", "Libraries & SDKs", "Cryptography", "Infrastructure",
  "Protocol", "Developer tools", "Payments & DeFi", "Identity",
  "Community", "Education", "Research", "Historical", "Other",
] as const;

export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password
      ? url.href : null;
  } catch { return null; }
}

export function displayDate(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not available";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(value));
}

function inferCategory(repo: Repository): string {
  const text = [repo.name, repo.description, ...repo.topics].join(" ").toLowerCase().replace(/[_-]/g, " ");
  if (/orchard|sapling|halo.?2|frost|jubjub|bellman|pairing|pasta|cryptograph|zero.knowledge proof/.test(text)) return "Cryptography";
  if (/lightwalletd|indexer|explorer|zaino|zinder|rpc|infrastructure/.test(text)) return "Infrastructure";
  if (/sdk|librar|binding|\b(?:uniffi|ffi|crates?)\b/.test(text)) return "Libraries & SDKs";
  if (/wallet|zodl|zashi|zecwallet|zwallet/.test(text)) return "Wallets";
  if (/\bnode\b|zebra|zakura|zcashd/.test(text)) return "Nodes";
  if (/payment|btcpay|swap|bridge|merchant|defi|zsa/.test(text)) return "Payments & DeFi";
  if (/zcash improvement|protocol|consensus|\bzips\b|crosslink|tachyon/.test(text)) return "Protocol";
  if (/identity|name service|zns/.test(text)) return "Identity";
  if (/research|experiment|prototype|simulation/.test(text)) return "Research";
  if (/\bbooks?\b|wiki|education|tutorial|documentation|website|\.github\.io/.test(text)) return "Education";
  if (/community|social|forum|governance/.test(text)) return "Community";
  if (/\b(?:tests?|testing|testnet|ztest|ci)\b|tool|build|docker|devnet|regtest|deploy/.test(text)) return "Developer tools";
  return "Other";
}

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  return tags.map(tag => tag.trim()).filter(tag => {
    const key = tag.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function fundingProgramLabel(program: string | undefined): string | null {
  return program === "zcg" ? "ZCG" : program === "coinholder" ? "Coinholder Grants" : null;
}

export function classifyRepositories(catalog: Catalog): ClassifiedRepository[] {
  const reviews = new Map((catalog.registry.repositoryClassifications || []).map(review => [review.repositoryId, review]));
  return catalog.snapshot.repositories.map(repo => {
    const names = new Set([repo.fullName, ...repo.aliases].map(name => name.toLowerCase()));
    const projects = catalog.registry.projects.filter(project =>
      project.repositories.some(name => names.has(name.toLowerCase())))
      .sort((a, b) => a.id.localeCompare(b.id));
    const organization = catalog.registry.organizations.find(org =>
      org.githubOwners.some(owner => owner.toLowerCase() === repo.owner.toLowerCase())) || null;
    const review = reviews.get(repo.id) || null;
    const projectCategories = new Set(projects.map(project => project.category));
    const mappedCategory = projectCategories.size === 1 ? projects[0].category : null;
    const category = review?.category || mappedCategory || inferCategory(repo);
    return {
      ...repo, projects, organization, category,
      review,
      classification: review ? "reviewed" : mappedCategory ? "project-associated" : "inferred",
      notices: projects.flatMap(project => project.notices || [])
        .filter(notice => notice.repositoryIds?.includes(repo.id))
        .filter((notice, index, all) => all.findIndex(other => other.sourceUrl === notice.sourceUrl && other.label === notice.label) === index),
      tags: normalizeTags([
        category,
        // Family capabilities are not properties of every component. Only
        // individually reviewed tags and GitHub flags belong to this repo.
        ...(review?.tags || []),
        ...(repo.archived ? ["Archived"] : []),
        ...(repo.fork ? ["Fork"] : []),
        ...(repo.disabled ? ["Disabled"] : []),
      ]),
    };
  });
}

export type Filters = {
  query: string;
  category: string;
  organization: string;
  owner?: string;
  funding: string;
  lifecycle?: string;
};

function matchesQuery(query: string, values: (string | null | undefined)[]): boolean {
  const haystack = values.filter(Boolean).join(" ").toLowerCase();
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean).every(term => haystack.includes(term));
}

export function isGrantFunded(project: Project): boolean {
  // Only an explicit positive decision associated with this product qualifies.
  // Funding of an owner or a similar-titled application is not substituted.
  return project.funding.events.some(event =>
    event.kind !== "context" && /^(approved|awarded|funded|paid)$/i.test(event.status));
}

export function filterRepositories(repositories: ClassifiedRepository[], filters: Filters) {
  return repositories.filter(repo => {
    if (filters.category && repo.category !== filters.category) return false;
    if (filters.organization && repo.organization?.id !== filters.organization) return false;
    if (filters.owner && repo.owner.toLowerCase() !== filters.owner.toLowerCase()) return false;
    if (filters.funding === "grants" && !repo.projects.some(isGrantFunded)) return false;
    if (filters.funding === "historical-dev-fund" &&
      !repo.organization?.funding.history.some(event => /(?:development|dev)[\s-]*fund/i.test(event.program || event.label))) return false;
    if (filters.lifecycle === "original" && (repo.fork || repo.archived)) return false;
    if (filters.lifecycle === "archived" && !repo.archived) return false;
    if (filters.lifecycle === "forks" && !repo.fork) return false;
    return matchesQuery(filters.query, [
      repo.fullName, repo.description, repo.organization?.name,
      repo.language, ...repo.tags, ...repo.topics,
      ...repo.projects.map(project => project.name),
    ]);
  });
}

export function repositoryOwners(repositories: Repository[]): string[] {
  return [...new Map(repositories.map(repo => [repo.owner.toLowerCase(), repo.owner])).values()]
    .sort((a, b) => a.localeCompare(b));
}

// This is a shared-repository association, never an inferred award to the
// component. Callers must keep it separate from the project's own decisions.
export function sharedRepositoryFunding(project: Project, repositories: ClassifiedRepository[]): Project[] {
  const matches = relatedRepositories(project, repositories).flatMap(repo => repo.projects)
    .filter(other => other.id !== project.id && isGrantFunded(other));
  return [...new Map(matches.map(other => [other.id, other])).values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function filterProjects(projects: Project[], filters: Filters, organizations: Organization[] = []) {
  return projects.filter(project => {
    if (filters.category && project.category !== filters.category) return false;
    if (filters.organization && project.organizationId !== filters.organization) return false;
    if (filters.funding === "grants" && !isGrantFunded(project)) return false;
    return matchesQuery(filters.query, [
      project.name, project.description, project.category, ...project.tags,
      organizations.find(org => org.id === project.organizationId)?.name,
      ...project.repositories,
    ]);
  });
}

export function activitySummary(repositories: Repository[], days: number) {
  // Fork history often repeats upstream commits. Keep forks in the inventory,
  // but never inflate the headline activity totals with their duplicate history.
  const original = repositories.filter(repo => !repo.fork);
  const measured = original.filter(repo => typeof repo.activity?.commits[String(days)] === "number");
  const commits = measured.reduce((sum, repo) => sum + (repo.activity!.commits[String(days)] || 0), 0);
  const active = measured.filter(repo => (repo.activity!.commits[String(days)] || 0) > 0).length;
  const releases = original.flatMap(repo => {
    const since = repo.activity?.since[String(days)];
    return since ? repo.activity!.releases.filter(release => release.publishedAt >= since) : [];
  }).length;
  return { commits, active, releases, measured: measured.length, eligible: original.length };
}

export function relatedRepositories(project: Project, repositories: ClassifiedRepository[]) {
  return repositories.filter(repo => repo.projects.some(item => item.id === project.id));
}

export function validateCatalog(catalog: Catalog): void {
  if (catalog.registry.schemaVersion !== 1 || catalog.snapshot.schemaVersion !== 1)
    throw new Error("Unsupported ecosystem catalog schema");
  if (!Number.isFinite(Date.parse(catalog.snapshot.collectedAt)))
    throw new Error("Catalog collection date is missing");
  for (const [name, items] of [
    ["projects", catalog.registry.projects],
    ["organizations", catalog.registry.organizations],
    ["repositories", catalog.snapshot.repositories],
  ] as const) {
    if (new Set(items.map(item => item.id)).size !== items.length)
      throw new Error("Duplicate catalog IDs in " + name);
  }
  if (!catalog.snapshot.repositories.length) throw new Error("Empty ecosystem repository snapshot");
  for (const project of catalog.registry.projects) {
    if (project.checkedAt && !Number.isFinite(Date.parse(project.checkedAt))) throw new Error("Invalid project review date: " + project.id);
    if (project.organizationId && !catalog.registry.organizations.some(org => org.id === project.organizationId))
      throw new Error("Unknown project organization: " + project.id);
    if (!CATEGORIES.includes(project.category as typeof CATEGORIES[number]))
      throw new Error("Unknown project category: " + project.id);
    if (normalizeTags(project.tags).length !== project.tags.length || project.tags.some(tag => tag !== tag.trim()))
      throw new Error("Duplicate or blank project tags: " + project.id);
    if (!project.sources.length || project.sources.some(source => !safeExternalUrl(source.url)) ||
      project.funding.events.some(event => !safeExternalUrl(event.sourceUrl) ||
        (event.repositoryEvidenceUrl && !safeExternalUrl(event.repositoryEvidenceUrl)) ||
        (event.scopeSourceUrl && !safeExternalUrl(event.scopeSourceUrl))))
      throw new Error("Invalid project provenance: " + project.id);
    if (project.funding.events.some(event => event.kind && !["grant", "context"].includes(event.kind)))
      throw new Error("Unknown funding event kind: " + project.id);
    if (project.funding.events.some(event => event.program && !fundingProgramLabel(event.program)))
      throw new Error("Unknown funding program: " + project.id);
    if (project.relatedProjectIds?.some(id => !catalog.registry.projects.some(item => item.id === id)))
      throw new Error("Unknown related project: " + project.id);
    for (const notice of project.notices || []) {
      if (!["support", "capability"].includes(notice.kind) || !notice.label.trim() || !notice.summary.trim() ||
        !safeExternalUrl(notice.sourceUrl) || !Number.isFinite(Date.parse(notice.date)))
        throw new Error("Invalid project notice: " + project.id);
      if (notice.repositoryIds?.some(id => !catalog.snapshot.repositories.some(repo =>
        repo.id === id && [repo.fullName, ...repo.aliases].some(name =>
          project.repositories.some(mapped => mapped.toLowerCase() === name.toLowerCase())))))
        throw new Error("Notice outside project repository scope: " + project.id);
    }
  }
  for (const proposal of catalog.registry.grantReview.classification) {
    if (proposal.projectId && !catalog.registry.projects.some(project => project.id === proposal.projectId))
      throw new Error("Unknown proposal project: " + proposal.projectId);
  }
  for (const repo of catalog.snapshot.repositories) {
    if (!safeExternalUrl(repo.url) || !safeExternalUrl(repo.sourceUrl))
      throw new Error("Invalid repository source URL");
    for (const count of Object.values(repo.activity?.commits || {})) {
      if (count !== null && (!Number.isSafeInteger(count) || count < 0))
        throw new Error("Invalid commit count");
    }
  }
  const reviews = catalog.registry.repositoryClassifications || [];
  if (new Set(reviews.map(review => review.repositoryId)).size !== reviews.length)
    throw new Error("Duplicate repository classifications");
  for (const review of reviews) {
    if (!catalog.snapshot.repositories.some(repo => repo.id === review.repositoryId))
      throw new Error("Unknown reviewed repository: " + review.repository);
    if (!CATEGORIES.includes(review.category as typeof CATEGORIES[number]) || !review.rationale.trim() ||
      !safeExternalUrl(review.sourceUrl) || !Number.isFinite(Date.parse(review.checkedAt)) ||
      normalizeTags(review.tags).length !== review.tags.length || review.tags.some(tag => tag !== tag.trim()))
      throw new Error("Invalid repository classification: " + review.repository);
    const repo = catalog.snapshot.repositories.find(repo => repo.id === review.repositoryId)!;
    if (review.tags.some(tag => /^(forks?|implementation-forks)$/i.test(tag)) && !repo.fork)
      throw new Error("Fork tag on an original repository: " + review.repository);
  }
}
