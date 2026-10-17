import { describe, expect, it } from "vitest";
import {
  APPS,
  backOf,
  childAppsOf,
  overviewEntry,
  paletteEntries,
  parentAppOf,
  placeOf,
  type AppDef,
} from "./design-routes";

const appOf = (id: string) => {
  const app = APPS.find((candidate) => candidate.id === id);
  if (!app) throw new Error(`no app ${id}`);
  return app;
};

describe("the navigation hierarchy", () => {
  it("replaces the standalone Decisions menu with Participate", () => {
    expect(appOf("zcg").pages).toContainEqual(expect.objectContaining({ href: "/zcg/participate", label: "Participate" }));
    expect(appOf("zcg").pages.some(page => page.href === "/zcg/decisions")).toBe(false);
  });
  it("lists voting activity and retains the Coinholder program and result routes", () => {
    const coinholders = appOf("coinholders");
    expect(overviewEntry(coinholders)).toBeNull();
    expect(coinholders.pages).toEqual(expect.arrayContaining([
      expect.objectContaining({ href: "/coinholders/activity", label: "Voting activity" }),
      expect.objectContaining({ href: "/coinholders", label: "Program overview" }),
      expect.objectContaining({ href: "/coinholders/results" }),
      expect.objectContaining({ href: "/coinholders/verify" }),
      expect.objectContaining({ href: "/coinholders/fund" }),
    ]));
    expect(backOf("/coinholders/activity")).toEqual({ href: "/coinholders", label: "Coinholder Grants" });
  });

  it("groups the organizations under Ecosystem while keeping their own routes and identities", () => {
    const ecosystem = appOf("ecosystem");
    const organizations = childAppsOf(ecosystem);
    expect(organizations.map((app) => app.id)).toEqual([
      "communities", "arborist", "fpf", "shielded-labs", "tachyon", "zf", "zakura", "zechub", "zodl",
    ]);
    for (const app of organizations) {
      expect(parentAppOf(app)).toBe(ecosystem);
      expect(app.hidden).not.toBe(true);
      expect(placeOf(app.href)).toEqual({ app });
    }
    expect(ecosystem.logo).toBeUndefined();
    expect(ecosystem.icon).toBe("ecosystem");
  });

  it("keeps Wallets immediately after the Ecosystem overview", () => {
    const ecosystem = appOf("ecosystem");
    expect([overviewEntry(ecosystem), ...ecosystem.pages].slice(0, 2)).toMatchObject([
      { href: "/ecosystem", label: "Overview" },
      { href: "/wallets/find", label: "Wallets" },
    ]);
  });

  it("groups Arborist Calls, Communities and FPF inside Ecosystem", () => {
    const rootIds = APPS.filter((app) => !app.parentId && !app.hidden).map((app) => app.id);
    expect(rootIds).not.toContain("arborist");
    expect(appOf("arborist").parentGroup).toBe("pages");
    expect(rootIds).not.toContain("communities");
    expect(rootIds).not.toContain("fpf");
    expect(parentAppOf(appOf("fpf"))).toBe(appOf("ecosystem"));
    expect(appOf("communities").parentGroup).toBe("pages");
  });

  it("has unique app IDs and routes, with no orphaned or repeated hierarchy entries", () => {
    expect(new Set(APPS.map((app) => app.id)).size).toBe(APPS.length);
    expect(new Set(APPS.map((app) => app.href)).size).toBe(APPS.length);
    for (const app of APPS.filter((candidate) => candidate.parentId)) {
      expect(parentAppOf(app), `${app.id} has a parent`).toBeDefined();
    }

    const visited = new Set<string>();
    const visit = (app: AppDef) => {
      expect(visited.has(app.id), `${app.id} appears only once`).toBe(false);
      visited.add(app.id);
      childAppsOf(app).forEach(visit);
    };
    APPS.filter((app) => !app.parentId).forEach(visit);
    expect([...visited].sort()).toEqual(APPS.map((app) => app.id).sort());
  });

  it("looks up hierarchy without modifying the model", () => {
    const before = JSON.stringify(APPS);
    for (const app of APPS) {
      parentAppOf(app);
      childAppsOf(app).reverse();
    }
    expect(JSON.stringify(APPS)).toBe(before);
  });
});

describe("backOf", () => {
  it("returns from every organization landing page to Ecosystem", () => {
    for (const app of childAppsOf(appOf("ecosystem"))) {
      expect(backOf(app.href)).toEqual({ href: "/ecosystem", label: "Ecosystem" });
    }
  });

  it("returns from an organization's inner page to that organization", () => {
    expect(placeOf("/zechub/copilot")).toMatchObject({
      app: { id: "zechub" },
      page: { label: "ZecHub Copilot" },
    });
    expect(backOf("/zechub/copilot")).toEqual({ href: "/zechub", label: "ZecHub DAO" });
  });

  it("preserves the list and app steps for Ecosystem pages and records", () => {
    expect(backOf("/wallets/find")).toEqual({ href: "/ecosystem", label: "Ecosystem" });
    expect(backOf("/ecosystem/history/zaino")).toEqual({
      href: "/ecosystem/history", label: "Project histories",
    });
    expect(backOf("/ecosystem/history")).toEqual({ href: "/ecosystem", label: "Ecosystem" });
  });

  it("keeps top-level apps and unknown routes returning to ZCG", () => {
    for (const pathname of ["/ecosystem", "/monthly", "/nowhere"]) {
      expect(backOf(pathname)).toEqual({ href: "/zcg", label: "ZCG" });
    }
  });
});


it("makes the finder the Wallets page directly under Ecosystem", () => {
  expect(backOf("/wallets/find")).toEqual({ href: "/ecosystem", label: "Ecosystem" });
  expect(placeOf("/wallets/find")?.page?.label).toBe("Wallets");
  expect(placeOf("/wallets/find")?.detail).toBeUndefined();
});

it("keeps Crosslink under a project-specific route without a duplicate category destination", () => {
  const category = appOf("ongoing-test");
  expect(placeOf("/ongoing-test/crosslink")).toMatchObject({
    app: { id: "ongoing-test" }, page: { label: "Crosslink" },
  });
  expect(overviewEntry(category)).toBeNull();
  expect(paletteEntries(category)).toEqual([
    expect.objectContaining({ href: "/ongoing-test/crosslink", label: "Crosslink" }),
  ]);
  expect(backOf("/ongoing-test/crosslink")).toEqual({ href: "/zcg", label: "ZCG" });
});
