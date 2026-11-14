import { describe, expect, it } from "vitest";
import registry from "@/data/ecosystem/registry.json";
import snapshot from "@/data/ecosystem/snapshot.json";
import { classifyRepositories, filterRepositories, isGrantFunded, normalizeTags, repositoryOwners,
  sharedRepositoryFunding, validateCatalog } from "./catalog";
import type { Catalog } from "./types";

const catalog = { registry, snapshot } as unknown as Catalog;
const repositories = classifyRepositories(catalog);
const filters = { query: "", category: "", organization: "", funding: "" };
const repo = (name: string) => repositories.find(item => item.fullName === name)!;

describe("September 2026 tag audit regressions", () => {
  it("classifies repository purpose independently of project record ordering", () => {
    const reversed = classifyRepositories({ ...catalog, registry: {
      ...catalog.registry, projects: [...catalog.registry.projects].reverse(),
    } });
    expect(reversed.map(item => [item.id, item.category, item.classification, item.tags]))
      .toEqual(repositories.map(item => [item.id, item.category, item.classification, item.tags]));
  });

  it.each([
    ["ZcashFoundation/ed25519-zebra", "Cryptography"],
    ["ZcashFoundation/reddsa", "Cryptography"],
    ["valargroup/reddsa", "Cryptography"],
    ["ZcashFoundation/zt", "Developer tools"],
    ["ZcashFoundation/zebra-fuzz-corpora", "Developer tools"],
    ["ZcashFoundation/zebra-net-ra-crash-repro", "Developer tools"],
    ["zcash-hackworks/zcashd_exporter", "Infrastructure"],
    ["zodl-inc/ecc_zcashd_exporter", "Infrastructure"],
    ["zecrocks/blockbook", "Infrastructure"],
    ["adityapk00/lightwalletd", "Infrastructure"],
    ["KeystoneHQ/keystone-sdk-ios", "Libraries & SDKs"],
    ["LedgerHQ/device-sdk-ts", "Libraries & SDKs"],
    ["Zondax/ledger-zcash-rs", "Libraries & SDKs"],
    ["zcash/zcash_client_memory", "Libraries & SDKs"],
    ["zcash/zcash-android-wallet-plugins", "Libraries & SDKs"],
    ["zcash/zewif-zcashd", "Libraries & SDKs"],
    ["zingolabs/zebra-rpc-ts", "Libraries & SDKs"],
    ["nighthawk-apps/zcashex", "Libraries & SDKs"],
    ["zingolabs/zaino-e2e", "Developer tools"],
    ["QED-it/zcash_tx_tool", "Developer tools"],
    ["zecpublish/platform", "Community"],
    ["zcash/sinsemilla", "Cryptography"],
    ["valargroup/sinsemilla", "Cryptography"],
    ["ZcashFoundation/ristretto255-dh", "Cryptography"],
    ["ZcashFoundation/infra-monitoring-kuma", "Infrastructure"],
    ["ZcashFoundation/powersoftau-attestations", "Cryptography"],
    ["adityapk00/zecwallet-light-cli", "Wallets"],
    ["zcash-hackworks/zcash-testnet-in-a-box", "Infrastructure"],
    ["zingolabs/zcash-wallet-formats", "Research"],
    ["zcash/zcash-seeder", "Infrastructure"],
    ["ZcashFoundation/dnsseeder", "Infrastructure"],
  ])("uses a sourced repository-level purpose for %s", (name, category) => {
    expect(repo(name).category).toBe(category);
    expect(repo(name).classification).toBe("reviewed");
  });

  it("does not leak family capabilities or fork tags into repository facts/search", () => {
    const tool = repo("QED-it/zcash_tx_tool");
    expect(tool.fork).toBe(false);
    expect(tool.tags).not.toContain("forks");
    expect(tool.tags).not.toContain("implementation-forks");
    expect(filterRepositories([tool], { ...filters, query: "forks" })).toHaveLength(0);
    expect(filterRepositories([tool], { ...filters, query: "QEDIT", category: "Developer tools" })).toHaveLength(1);
    expect(repo("adityapk00/lightwalletd").tags).not.toContain("desktop");
  });

  it("has no blank or case-insensitive duplicate technical tags", () => {
    for (const project of catalog.registry.projects) {
      const normalized = project.tags.map(tag => tag.trim().toLowerCase());
      expect(normalized, project.id).not.toContain("");
      expect(new Set(normalized).size, project.id).toBe(normalized.length);
    }
  });

  it("maps only the initial ZeWIF decision to Zexcavator without creating another award", () => {
    const component = catalog.registry.projects.find(item => item.id === "zexcavator")!;
    const family = catalog.registry.projects.find(item => item.id === "zewif")!;
    expect(isGrantFunded(component)).toBe(true);
    expect(component.funding.events).toHaveLength(1);
    expect(component.funding.events[0].sourceUrl).toBe(family.funding.events[0].sourceUrl);
    expect(component.funding.events[0].sourceUrl).toContain("range=A309");
    expect(component.funding.scopeNote).toContain("not a separate award");
    expect(catalog.registry.grantReview.classification).toHaveLength(179);
    expect(new Set([component, family].flatMap(item => item.funding.events)
      .filter(event => event.sourceUrl === component.funding.events[0].sourceUrl)
      .map(event => event.sourceUrl)).size).toBe(1);
  });

  it("continues to validate the reviewed catalog", () => {
    expect(() => validateCatalog(catalog)).not.toThrow();
  });

  it("matches individual reviews by stable ID, not a reusable repository name", () => {
    const original = repo("QED-it/zcash_tx_tool");
    const renamed = { ...original, owner: "new-owner", fullName: "new-owner/renamed", name: "renamed",
      aliases: [original.fullName] };
    const classified = classifyRepositories({ ...catalog, snapshot: { ...catalog.snapshot, repositories: [renamed] } })[0];
    expect(classified.classification).toBe("reviewed");
    expect(classified.category).toBe("Developer tools");
    const replacement = classifyRepositories({ ...catalog, snapshot: { ...catalog.snapshot,
      repositories: [{ ...original, id: "a-different-github-id" }] } })[0];
    expect(replacement.review).toBeNull();
    expect(replacement.classification).not.toBe("reviewed");
  });

  it("does not promote conflicting family categories into an individual review", () => {
    const original = repo("QED-it/zcash_tx_tool");
    const withoutReviews = { ...catalog, registry: { ...catalog.registry, repositoryClassifications: [] },
      snapshot: { ...catalog.snapshot, repositories: [original] } };
    const result = classifyRepositories(withoutReviews)[0];
    expect(result.classification).toBe("inferred");
    expect(result.review).toBeNull();
    expect(classifyRepositories({ ...withoutReviews, registry: { ...withoutReviews.registry,
      projects: [...withoutReviews.registry.projects].reverse() } })[0].category).toBe(result.category);
  });

  it("does not infer capabilities from fragments inside unrelated words", () => {
    for (const description of ["efficient", "Diffie-Hellman", "Litestream", "attestations", "handbook"]) {
      const fixture = { ...catalog.snapshot.repositories[0], id: "unknown", name: "unknown", fullName: "unknown/unknown",
        description, topics: [], aliases: [] };
      const result = classifyRepositories({ ...catalog, snapshot: { ...catalog.snapshot, repositories: [fixture] } })[0];
      expect(result.category, description).toBe("Other");
      expect(result.classification).toBe("inferred");
    }
    expect(normalizeTags(["Rust", "rust", " PCZT ", "", "pczt"])).toEqual(["Rust", "PCZT"]);
  });

  it("can select every canonical GitHub owner independently of project associations", () => {
    const owners = repositoryOwners(repositories);
    expect(owners.length).toBeGreaterThanOrEqual(54); // New public namespaces may be collected; do not freeze the inventory.
    for (const owner of owners) {
      const result = filterRepositories(repositories, { ...filters, owner: owner.toUpperCase() });
      expect(result.length).toBeGreaterThan(0);
      expect(result).toEqual(repositories.filter(item => item.owner.toLowerCase() === owner.toLowerCase()));
    }
    expect(filterRepositories(repositories, { ...filters, owner: "elemental-pay" })).toHaveLength(4);
    // The organization's historical allocation covers each of its repositories, including newly collected ones.
    const foundation = filterRepositories(repositories, { ...filters, owner: "ZcashFoundation" });
    expect(foundation.length).toBeGreaterThanOrEqual(72);
    expect(filterRepositories(repositories, { ...filters, owner: "ZcashFoundation", funding: "historical-dev-fund" }))
      .toEqual(foundation);
  });

  it("keeps support notices scoped to the named repository and separate from flags", () => {
    const wallet = repo("hhanh00/zwallet");
    expect(wallet.notices.map(notice => notice.label)).toEqual(["Zcash support deprecated"]);
    expect(wallet.archived).toBe(false);
    expect(repo("hhanh00/zkool2").notices).toHaveLength(0);
    expect(repositories.filter(item => item.notices.length)).toHaveLength(1);
  });

  it("explains all ten pre-existing shared-repository funding asymmetries without awarding them grants", () => {
    const ids = ["ecc-hackworks", "hosh", "zcash-stack", "qedit-zcash-tx-tool", "zcash-wallet-formats", "zcashex",
      "zecping", "zecwallet-light-cli", "zecwallet-lite", "ledger-zcash-bindings"];
    for (const id of ids) {
      const project = catalog.registry.projects.find(item => item.id === id)!;
      expect(isGrantFunded(project)).toBe(false);
      const linked = sharedRepositoryFunding(project, repositories);
      expect(linked.length, id).toBeGreaterThan(0);
      expect(new Set(linked.map(item => item.id)).size).toBe(linked.length);
    }
  });

  it("rejects duplicate, unscoped or unsourced review data", () => {
    const duplicate = structuredClone(catalog);
    duplicate.registry.repositoryClassifications!.push(duplicate.registry.repositoryClassifications![0]);
    expect(() => validateCatalog(duplicate)).toThrow("Duplicate repository classifications");
    const missingId = structuredClone(catalog);
    missingId.registry.repositoryClassifications![0].repositoryId = "missing";
    expect(() => validateCatalog(missingId)).toThrow("Unknown reviewed repository");
    const unsafe = structuredClone(catalog);
    unsafe.registry.repositoryClassifications![0].sourceUrl = "javascript:alert(1)";
    expect(() => validateCatalog(unsafe)).toThrow("Invalid repository classification");
    const duplicateTags = structuredClone(catalog);
    duplicateTags.registry.projects[0].tags.push(duplicateTags.registry.projects[0].tags[0].toUpperCase());
    expect(() => validateCatalog(duplicateTags)).toThrow("Duplicate or blank project tags");
    const notice = structuredClone(catalog);
    notice.registry.projects.find(item => item.id === "ywallet")!.notices![0].repositoryIds = ["unknown"];
    expect(() => validateCatalog(notice)).toThrow("Notice outside project repository scope");
    const wrongFork = structuredClone(catalog);
    wrongFork.registry.repositoryClassifications!.find(item => item.repository === "QED-it/zcash_tx_tool")!.tags.push("forks");
    expect(() => validateCatalog(wrongFork)).toThrow("Fork tag on an original repository");
  });
});
