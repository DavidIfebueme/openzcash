import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import registry from "@/data/ecosystem/registry.json";
import snapshot from "@/data/ecosystem/snapshot.json";
import { EcosystemExplorer } from "@/components/ecosystem/explorer";
import type { Catalog, Project } from "./types";
import { ecosystemCatalogFilters, ecosystemView, updateEcosystemCatalogSearch } from "./overview-route";

const route = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(route.search) }));

const project = (id: string, name: string, category: string, approved: boolean): Project => ({
  id, name, category, organizationId: "zcash-foundation", tags: [], description: name,
  website: "https://example.org", repositories: [], sources: [],
  funding: { label: "Funding record", status: "reviewed", events: approved
    ? [{ title: "Award", status: "approved", sourceUrl: "https://example.org/award" }]
    : [] },
});
const catalog = {
  registry: { ...registry, projects: [
    project("alpha", "Alpha wallet", "Wallets", true),
    project("beta", "Beta wallet", "Wallets", false),
    project("gamma", "Gamma node", "Nodes", true),
  ] },
  snapshot: { ...snapshot, repositories: [] },
} as unknown as Catalog;
const filters = (search: string) => ecosystemCatalogFilters(new URLSearchParams(search), catalog.registry);
const render = (search: string, mode: "ecosystem" | "development" = "ecosystem") => {
  route.search = search;
  return renderToStaticMarkup(createElement(EcosystemExplorer, { catalog, mode }));
};

beforeEach(() => { route.search = ""; });

describe("ecosystem overview and catalog routing", () => {
  it("opens the overview for the plain route and unrelated parameters", () => {
    expect(ecosystemView({})).toBe("overview");
    expect(ecosystemView({ utm_source: "forum", view: "unknown" })).toBe("overview");
  });

  it("opens the catalog explicitly or for every supported legacy/insight filter", () => {
    expect(ecosystemView({ view: "catalog" })).toBe("catalog");
    for (const key of ["project", "org", "category", "funding", "q"]) {
      expect(ecosystemView({ [key]: "" }), key).toBe("catalog");
      expect(ecosystemView({ [key]: "unknown" }), key).toBe("catalog");
    }
    expect(ecosystemView({ view: ["catalog", "overview"] })).toBe("catalog");
    expect(ecosystemView({ view: ["overview", "catalog"] })).toBe("overview");
  });

  it("keeps legacy organization precedence and falls back to a valid project", () => {
    expect(filters("org=zcash-foundation&project=alpha")).toMatchObject({ organization: "zcash-foundation", projectId: null });
    expect(filters("org=unknown&project=alpha")).toMatchObject({ organization: "", projectId: "alpha" });
    expect(filters("project=unknown").projectId).toBeNull();
  });

  it("normalizes unsupported filters without losing search or a selected project", () => {
    expect(filters("project=alpha&category=Unknown&funding=unknown&q=Alpha")).toEqual({
      projectId: "alpha", organization: "", category: "", funding: "", query: "Alpha",
    });
  });
});

describe("shareable catalog filters", () => {
  it("filters the rendered catalog by category and grant approval together", () => {
    const html = render("view=catalog&category=Wallets&funding=grants");
    expect(html).toContain('aria-label="View Alpha wallet"');
    expect(html).not.toContain('aria-label="View Beta wallet"');
    expect(html).not.toContain('aria-label="View Gamma node"');
  });

  it("opens the exact legacy project and keeps the overview link and organization anchor", () => {
    const html = render("project=beta");
    expect(html).toContain('aria-label="View Beta wallet"');
    expect(html).not.toContain('aria-label="View Alpha wallet"');
    expect(html).toContain('href="/ecosystem"');
    expect(html).toContain("← Ecosystem overview");
    expect(html).toContain('id="organizations"');
  });

  it("reads each current URL without retaining the previous search when navigating back", () => {
    const first = "view=catalog&category=Wallets&q=Beta";
    expect(render(first)).toContain('aria-label="View Beta wallet"');
    const next = "view=catalog&category=Nodes";
    expect(render(next)).toContain('aria-label="View Gamma node"');
    const restored = render(first);
    expect(restored).toContain('aria-label="View Beta wallet"');
    expect(restored).not.toContain('aria-label="View Gamma node"');
  });

  it("preserves relevant project/organization selections when changing other filters", () => {
    const next = updateEcosystemCatalogSearch("project=alpha&utm_source=forum", { category: "Wallets", funding: "grants", q: "Alpha" });
    expect(filters(next)).toMatchObject({ projectId: "alpha", category: "Wallets", funding: "grants", query: "Alpha" });
    expect(new URLSearchParams(next).get("utm_source")).toBe("forum");
    const organization = updateEcosystemCatalogSearch("org=zcash-foundation", { category: "Nodes" });
    expect(filters(organization).organization).toBe("zcash-foundation");
  });

  it("replaces a competing project selection only when the user changes organization", () => {
    const next = updateEcosystemCatalogSearch("project=alpha&category=Wallets", { org: "zcash-foundation" });
    expect(new URLSearchParams(next).has("project")).toBe(false);
    expect(filters(next)).toMatchObject({ organization: "zcash-foundation", category: "Wallets" });
  });

  it("clears catalog filters without returning to the overview", () => {
    const search = updateEcosystemCatalogSearch("project=alpha&category=Wallets&funding=grants&q=Alpha", {
      project: "", org: "", category: "", funding: "", q: "",
    });
    expect(search).toBe("view=catalog");
    expect(filters(search)).toEqual({ query: "", category: "", organization: "", projectId: null, funding: "" });
    expect(ecosystemView(Object.fromEntries(new URLSearchParams(search)))).toBe("catalog");
  });

  it("keeps Development's existing controls and overview destination", () => {
    const html = render("", "development");
    expect(html).toContain('href="/ecosystem"');
    expect(html).toContain('aria-label="Filter by GitHub owner"');
    expect(html).toContain('aria-label="Filter repository type"');
    expect(html).not.toContain("← Ecosystem overview");
  });
});
