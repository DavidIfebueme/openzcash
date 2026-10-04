import { describe, expect, it } from "vitest";
import registry from "@/data/ecosystem/registry.json";
import snapshot from "@/data/ecosystem/snapshot.json";
import { isGrantFunded } from "@/lib/ecosystem/catalog";
import { COMMUNITIES } from "@/lib/communities/data";
import type { Catalog } from "@/lib/ecosystem/types";
import { historyIdentities, searchHistoryIdentities } from "./identities";

const identities = historyIdentities({ registry, snapshot } as unknown as Catalog);
describe("history identity coverage", () => {
  it("includes every curated project and community with unique IDs", () => {
    expect(new Set(identities.map(item => item.id)).size).toBe(identities.length);
    for (const project of registry.projects) expect(identities.some(item => item.id === project.id)).toBe(true);
    for (const community of COMMUNITIES) expect(identities.some(item => item.communityId === community.id)).toBe(true);
  });
  it("selects an exact ID while leaving broad names ambiguous", () => {
    expect(searchHistoryIdentities(identities, "zaino").map(item => item.id)).toEqual(["zaino"]);
    expect(searchHistoryIdentities(identities, "zingo").length).toBeGreaterThan(1);
    expect(searchHistoryIdentities(identities, "does-not-exist")).toEqual([]);
  });
  it("maps Vizor to its canonical maintainer without confusing its fork or application with funding", () => {
    const vizor = identities.find(item => item.id === "vizor-wallet")!;
    expect(vizor.name).toBe("Vizor");
    expect(vizor.project?.organizationId).toBe("chainapsis");
    expect(vizor.project?.repositories).toEqual(["chainapsis/vizor-wallet"]);
    expect(vizor.repositories.some(repo => repo.fullName.toLowerCase() === "valargroup/vizor-wallet")).toBe(false);
    expect(vizor.project?.logo).toBe("/wallet-logos/vizor.png");
    expect(vizor.project?.funding.events).toEqual([expect.objectContaining({
      title: "Retroactive Grant Application - Vizor Wallet", program: "coinholder", status: "submitted-past-deadline", date: "2026-08-15",
      sourceUrl: "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/66",
    })]);
    expect(isGrantFunded(vizor.project!)).toBe(false);
  });
  it("does not inherit every organization repository or recipient into a project", () => {
    const zaino = identities.find(item => item.id === "zaino")!;
    expect(zaino.repositories.map(repo => repo.fullName.toLowerCase())).toEqual(["zingolabs/zaino"]);
    expect(zaino.recipientKeys).toEqual([]);
  });
});
