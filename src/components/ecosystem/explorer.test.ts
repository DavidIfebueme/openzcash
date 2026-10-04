import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import registry from "@/data/ecosystem/registry.json";
import snapshot from "@/data/ecosystem/snapshot.json";
import type { Catalog } from "@/lib/ecosystem/types";
import { classifyRepositories, isGrantFunded, displayDate } from "@/lib/ecosystem/catalog";
import { DetailDialog, EcosystemExplorer } from "./explorer";

const catalog = { registry, snapshot } as unknown as Catalog;
const render = (mode: "ecosystem" | "development") => renderToStaticMarkup(
  createElement(EcosystemExplorer, { catalog, mode }),
);

describe("compact catalog presentation", () => {
  it("ships real app links without preview-only flags or destinations", () => {
    const html = render("development");
    for (const href of ["/ecosystem", "/development", "/wallets", "/zcg/proposals", "/zcg/grants"])
      expect(html).toContain(`href="${href}"`);
    expect(html).not.toContain("Preview");
    expect(html).not.toContain("127.0.0.1");
    expect(html).not.toContain("Integration preview");
  });

  it.each(["ecosystem", "development"] as const)("uses the organisation header with the Zcash mark and the stats in %s", mode => {
    const html = render(mode);
    expect(html).toContain(`${mode === "development" ? "Development" : "Ecosystem"}</h1>`);
    expect(html).toContain('class="ws-org-head"');
    expect(html).toContain("/logos/ecosystem/zcash.png");
    expect(html).toContain("Catalog statistics");
    expect(html).toContain("bg-clip-text text-transparent");
    expect(html).not.toContain("Follow the code.");
    expect(html).not.toContain("An ecosystem, connected.");
  });

  it("keeps funding, purpose, maintainer and lifecycle controls accessible", () => {
    const html = render("development");
    for (const label of ["Search repositories", "Filter by purpose", "Filter by GitHub owner", "Filter by funding", "Filter repository type"])
      expect(html).toContain(`aria-label="${label}"`);
    for (const days of [7, 30, 90]) expect(html).toContain(`aria-label="${days} days"`);
    expect(html).toContain("Former Dev Fund recipient");
    expect(html).toContain('aria-label="Development repositories"');
    expect(html).toContain('aria-label="Repository results"');
  });

  it("offers every namespace, including owners without an organization record", () => {
    const html = render("development");
    for (const owner of ["elemental-pay", "emersonian", "open-wallet-standard", "Supercoolkayy", "zecpublish", "zecwalletco"])
      expect(html).toContain(`value="${owner}"`);
    expect(html).toContain("All GitHub owners");
    expect(render("ecosystem")).toContain('aria-label="Filter by project association"');
  });

  it("removes card descriptions but keeps categories, approvals and uniquely named detail controls", () => {
    const html = render("ecosystem");
    expect(html).not.toContain(catalog.registry.projects.find(project => project.id === "zebra")!.description);
    expect(html).toContain('aria-label="View Zebra"');
    expect(html).toContain('aria-label="View Zodl wallet"');
    expect(html).toContain("Grant history");
    expect(html).toContain("Grant approval ≠ payment or current funding");
  });

  it("retains snapshot and measurement limitations under sources", () => {
    const html = render("development");
    expect(html).toContain(`Snapshot ${displayDate(snapshot.collectedAt)}`);
    expect(html).toContain("Repository-wide totals · excludes forks");
    expect(html).toContain("Sources &amp; methodology");
    expect(html).toContain("Shared and multichain codebases may include non-Zcash work.");
    expect(html).toContain("Missing measurements appear as a dash.");
    expect(html).toContain('href="/api/ecosystem"');
  });
  it.each(["ecosystem", "development"] as const)("renders semantic category colors and sourced identities in %s", mode => {
    const html = render(mode);
    expect(html).toContain("--category-ink:#6d28d9");
    expect(html).toContain("--category-ink:#1d4ed8");
    expect(html).toContain('data-brand-kind="maintainer"');
    expect(html).toContain('data-brand-kind="namespace"');
    expect(html).toContain("they do not imply endorsement");
    expect(html).toContain("Grant history");
  });
});

describe("source and scope in catalog details", () => {
  const repositories = classifyRepositories(catalog);
  const details = (selection: Parameters<typeof DetailDialog>[0]["selection"]) => renderToStaticMarkup(
    createElement(DetailDialog, { selection, close: () => {}, repositories,
      organizations: catalog.registry.organizations, projects: catalog.registry.projects }),
  );
  const project = (id: string) => catalog.registry.projects.find(item => item.id === id)!;

  it("shows the YWallet support notice in both apps without inventing archival", () => {
    const wallet = project("ywallet");
    const repo = repositories.find(item => item.fullName === "hhanh00/zwallet")!;
    expect(repo.archived).toBe(false);
    for (const selection of [{ kind: "project", value: wallet }, { kind: "repository", value: repo }] as const) {
      const html = details(selection);
      expect(html).toContain("Zcash support deprecated");
      expect(html).toContain("23 Aug 2026");
      expect(html).toContain(wallet.notices![0].sourceUrl);
      expect(html).not.toContain(">Archived<");
    }
    const single = { ...catalog, registry: { ...catalog.registry, projects: [wallet] } };
    expect(renderToStaticMarkup(createElement(EcosystemExplorer, { catalog: single, mode: "ecosystem" })))
      .toContain("Zcash support deprecated");
    expect(renderToStaticMarkup(createElement(EcosystemExplorer, { catalog: { ...single,
      snapshot: { ...single.snapshot, repositories: [repo] } }, mode: "development" })))
      .toContain("Zcash support deprecated");
  });

  it("renders distinct ZCG and Coinholder programs and the Maya privacy qualification", () => {
    const html = details({ kind: "project", value: project("maya-zcash") });
    expect(html).toContain("ZCG · ");
    expect(html).toContain("Coinholder Grants · ");
    expect(html).toContain("Privacy scope");
    expect(html).toContain("not end-to-end private custody");
  });

  it("retains every project-specific funding scope in repository details", () => {
    for (const repo of repositories.filter(item => item.projects.some(isGrantFunded))) {
      const html = details({ kind: "repository", value: repo });
      for (const project of repo.projects.filter(isGrantFunded)) {
        const escaped = project.funding.scopeNote!.replaceAll("&", "&amp;").replaceAll("'", "&#x27;")
          .replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
        expect(html, repo.fullName + " / " + project.id).toContain(escaped);
      }
    }
  });

  it("explains a shared-repository grant without copying it to the component", () => {
    const tool = project("qedit-zcash-tx-tool");
    expect(isGrantFunded(tool)).toBe(false);
    const html = details({ kind: "project", value: tool });
    expect(html).toContain("Funding on shared repositories");
    expect(html).toContain('href="/ecosystem?project=qedit-zsa"');
    expect(html).toContain("do not establish a separate award to this component");
  });

  it("distinguishes reviewed repository sources from project-linked and inferred purposes", () => {
    const reviewed = repositories.find(item => item.fullName === "QED-it/zcash_tx_tool")!;
    expect(details({ kind: "repository", value: reviewed })).toContain("Purpose source");
    const linked = repositories.find(item => item.classification === "project-associated")!;
    expect(details({ kind: "repository", value: linked })).toContain("has not received an individual purpose review");
    const inferred = repositories.find(item => item.classification === "inferred")!;
    expect(details({ kind: "repository", value: inferred })).toContain("Purpose is inferred");
  });
});
