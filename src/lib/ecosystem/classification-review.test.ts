import { describe, expect, it } from "vitest";
import registry from "@/data/ecosystem/registry.json";
import snapshot from "@/data/ecosystem/snapshot.json";
import { classifyRepositories, filterProjects, validateCatalog } from "./catalog";
import type { Catalog } from "./types";

const catalog = { registry, snapshot } as unknown as Catalog;
const filters = { query: "", category: "", organization: "", funding: "" };

describe("purpose-based project classification", () => {
  it("places headless wallets with wallets, retaining their distinct capabilities", () => {
    const wallets = filterProjects(catalog.registry.projects, { ...filters, category: "Wallets" });
    expect(wallets.map(project => project.id)).toEqual(expect.arrayContaining(["zallet", "zcash-walletd", "zecd"]));
    expect(wallets.find(project => project.id === "zcash-walletd")!.tags).toContain("view-only");
    expect(wallets.find(project => project.id === "zallet")!.tags).toContain("RPC wallet");
  });
  it("separates voting systems from community work and contribution tools from DeFi", () => {
    const voting = filterProjects(catalog.registry.projects, { ...filters, category: "Governance" });
    expect(voting.map(project => project.id).sort()).toEqual(expect.arrayContaining(["valar-private-voting", "zcash-coin-voting"]));
    const bounty = catalog.registry.projects.find(project => project.id === "zec-bounties")!;
    expect(bounty.category).toBe("Community");
    expect(bounty.tags).toContain("ZEC-payments");
  });
  it("does not present an exposition as machine verification, a survey as an adopted standard, or Ika as shielded signing", () => {
    const get = (id: string) => catalog.registry.projects.find(project => project.id === id)!;
    expect(get("ironwood-human-readable-proof").tags).not.toContain("formal-verification");
    expect(get("ironwood-human-readable-proof").tags).toContain("mathematical-exposition");
    expect(get("zcash-wallet-formats").tags).not.toContain("Standards");
    expect(get("zcash-wallet-formats").tags).toContain("wallet-format-survey");
    expect(get("zcash-ika").tags).toContain("transparent-transactions");
    expect(get("zecpages").tags).not.toContain("subscriptions");
  });
  it("classifies voting implementation repositories by their own purpose", () => {
    const repositories = classifyRepositories(catalog);
    const get = (name: string) => repositories.find(repository => repository.fullName === name)!;
    expect(get("valargroup/vote-sdk").category).toBe("Infrastructure");
    expect(get("valargroup/voting-circuits").category).toBe("Cryptography");
    expect(get("hhanh00/zcash-sync").category).toBe("Libraries & SDKs");
    expect(get("equilibriumco/namada").category).toBe("Nodes");
    expect(get("equilibriumco/namada").tags).toContain("Namada");
  });
  it("requires safe dated evidence for a classification review", () => {
    const invalid = structuredClone(catalog);
    const reviewed = invalid.registry.projects.find(project => project.classificationReview)!;
    reviewed.classificationReview!.sourceUrls = ["javascript:alert(1)"];
    expect(() => validateCatalog(invalid)).toThrow("Invalid project classification review");
    reviewed.classificationReview!.sourceUrls = [];
    expect(() => validateCatalog(invalid)).toThrow("Invalid project classification review");
  });
});
