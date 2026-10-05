import type { Registry } from "./types";

export type EcosystemSearchParams = Record<string, string | string[] | undefined>;
const CATALOG_FILTERS = ["project", "org", "category", "funding", "q"] as const;
type CatalogFilter = (typeof CATALOG_FILTERS)[number];

/** Existing record links keep opening the catalog, including invalid/empty filters. */
export function ecosystemView(params: EcosystemSearchParams): "overview" | "catalog" {
  const view = Array.isArray(params.view) ? params.view[0] : params.view;
  return view === "catalog" || CATALOG_FILTERS.some((key) => params[key] !== undefined)
    ? "catalog"
    : "overview";
}

/** The catalog reads the URL on every render, including browser back/forward. */
export function ecosystemCatalogFilters(
  params: Pick<URLSearchParams, "get"> | null,
  registry: Pick<Registry, "projects" | "organizations">,
) {
  const organization = registry.organizations.find((item) => item.id === params?.get("org"))?.id ?? "";
  const projectId = organization ? null : registry.projects.find((item) => item.id === params?.get("project"))?.id ?? null;
  const requestedCategory = params?.get("category") ?? "";
  return {
    query: params?.get("q") ?? "",
    category: registry.projects.some((item) => item.category === requestedCategory) ? requestedCategory : "",
    organization,
    projectId,
    funding: params?.get("funding") === "grants" ? "grants" : "",
  };
}

/** Filter changes retain the catalog view and unrelated selections/parameters. */
export function updateEcosystemCatalogSearch(
  search: string,
  values: Partial<Record<CatalogFilter, string>>,
) {
  const params = new URLSearchParams(search);
  params.set("view", "catalog");
  if (Object.hasOwn(values, "org")) params.delete("project");
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  return params.toString();
}
