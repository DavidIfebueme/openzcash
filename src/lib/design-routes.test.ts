import { afterEach, describe, expect, it, vi } from "vitest";
import {
  APPS,
  backOf,
  childAppsOf,
  overviewEntry,
  parentAppOf,
  placeOf,
  type AppDef,
} from "./design-routes";

const appOf = (id: string) => {
  const app = APPS.find((candidate) => candidate.id === id);
  if (!app) throw new Error(`no app ${id}`);
  return app;
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("private chat preview navigation", () => {
  it.each([
    { environment: "production", flag: "true", hidden: true },
    { environment: "development", flag: undefined, hidden: true },
    { environment: "development", flag: "true", hidden: false },
  ])("keeps preview destinations gated in $environment with flag $flag", async ({ environment, flag, hidden }) => {
    vi.stubEnv("NODE_ENV", environment);
    vi.stubEnv("NEXT_PUBLIC_PRIVATE_CHAT_PREVIEW", flag);
    vi.resetModules();
    const { APPS: apps, DESIGN_GROUPS, paletteEntries } = await import("./design-routes");
    const chat = apps.find((app) => app.id === "private-chat")!;

    expect(chat.hidden).toBe(hidden);
    expect(apps[apps.indexOf(chat) - 1]?.id).toBe("monthly");
    expect(paletteEntries(chat).some((entry) => entry.href === "/private-chat")).toBe(!hidden);
    expect(DESIGN_GROUPS.some((group) => group.routes.some(([href]) => href === "/private-chat"))).toBe(!hidden);
    // Existing hidden apps remain available to the design directory.
    expect(DESIGN_GROUPS.some((group) => group.name === "Lockbox")).toBe(true);
  });
});

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
      { href: "/wallets", label: "Wallets" },
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
    expect(backOf("/wallets")).toEqual({ href: "/ecosystem", label: "Ecosystem" });
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
