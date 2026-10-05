import { describe, expect, it } from "vitest";
import registry from "@/data/ecosystem/registry.json";
import snapshot from "@/data/ecosystem/snapshot.json";
import { COMMUNITIES } from "@/lib/communities/data";
import { historyIdentities } from "@/lib/project-history/identities";
import type { Catalog } from "./types";
import { countWorkAreas, matchesWorkArea, workArea, workAreaHref } from "./work-areas";

const identities = historyIdentities({ registry, snapshot } as unknown as Catalog);
const sharedZecHub = registry.projects.some(project => project.id === "zechub") && COMMUNITIES.some(community => community.id === "zechub");
const expectedIdentities = registry.projects.length + COMMUNITIES.length - Number(sharedZecHub);

describe("primary work areas", () => {
  it("accounts for every curated identity once, including all community groups and the shared ZecHub identity", () => {
    expect(identities).toHaveLength(expectedIdentities);
    expect(countWorkAreas(identities).reduce((total, group) => total + group.count, 0)).toBe(expectedIdentities);
    expect(identities.filter(item => item.communityId)).toHaveLength(COMMUNITIES.length);
    expect(identities.filter(item => item.communityId === "zechub" || item.id === "zechub")).toHaveLength(1);
    for (const community of COMMUNITIES) {
      const identity = identities.find(item => item.communityId === community.id)!;
      expect(identity).toBeDefined();
      expect(matchesWorkArea(identity.category, "Community & education")).toBe(true);
    }
  });
  it("combines education with community work without changing raw categories or community membership", () => {
    const educationProject = identities.find(item => item.id === "eduzec")!;
    expect(educationProject.category).toBe("Education");
    expect(educationProject.communityId).toBeNull();
    expect(matchesWorkArea(educationProject.category, "Community & education")).toBe(true);
    const group = countWorkAreas(identities).find(item => item.area === "Community & education")!;
    const rawMembers = identities.filter(item => ["Community", "Education"].includes(item.category));
    expect(group.count).toBe(rawMembers.length);
    expect(group.count).toBeGreaterThan(COMMUNITIES.length);
    expect(matchesWorkArea("Governance", group.area)).toBe(false);
    expect(workArea("Protocol")).toBe("Protocol");
  });
  it("makes each area link select exactly the identities counted, with no overlap between areas", () => {
    const linkedIds: string[] = [];
    for (const group of countWorkAreas(identities)) {
      const url = new URL(workAreaHref(group.area), "https://openzcash.org");
      expect(url.pathname).toBe("/ecosystem/history");
      expect(url.searchParams.has("category")).toBe(false);
      const members = identities.filter(item => matchesWorkArea(item.category, url.searchParams.get("area")!));
      expect(members).toHaveLength(group.count);
      linkedIds.push(...members.map(item => item.id));
    }
    expect(linkedIds).toHaveLength(expectedIdentities);
    expect(new Set(linkedIds).size).toBe(expectedIdentities);
    expect([...linkedIds].sort()).toEqual(identities.map(item => item.id).sort());
  });
  it("counts a repeated identity once and keeps distinct projects that share a primary purpose", () => {
    const zechub = { id: "zechub", category: "Education" };
    expect(countWorkAreas([zechub, zechub, { id: "eduzec", category: "Education" }])).toEqual([
      { area: "Community & education", category: "Community", count: 2 },
    ]);
  });
});
