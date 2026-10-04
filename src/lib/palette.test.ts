import { describe, expect, it } from "vitest";
import { APPS, childAppsOf, type AppDef } from "./design-routes";
import { buildPalette, foldText, paletteRows, stepActive } from "./palette";

const single = (id: string, label: string, sub: string): AppDef => ({
  id,
  label,
  href: `/${id}`,
  sub,
  icon: "grid",
  pages: [],
});

const FIXTURE: AppDef[] = [
  single("news", "News", "What's new"),
  {
    id: "grants",
    label: "Coinholder Grants",
    href: "/coinholders",
    sub: "Retroactive grants program",
    icon: "grant",
    pages: [
      {
        href: "/coinholders/results",
        label: "Results",
        mark: "/glyphs/results.png",
      },
      {
        href: "/coinholders/verify",
        label: "Verify it yourself",
        mark: "/glyphs/verify.png",
      },
      { href: "/coinholders/secret", label: "Secret", hidden: true },
      {
        href: "/coinholders/found",
        label: "Findable",
        hidden: true,
        palette: true,
      },
    ],
  },
  single(
    "governance",
    "Zcash governance",
    "Upgrades, polls and open questions",
  ),
  {
    id: "zcg",
    label: "ZCG",
    href: "/zcg",
    sub: "Dev Fund",
    icon: "grant",
    pages: [
      { href: "/zcg/grants", label: "Grants", mark: "/glyphs/grants.png" },
      { href: "/zcg/office", label: "ZCG Office" },
    ],
  },
  single("cafe", "Café Zcash", "Comunidade"),
];

const labels = (apps: AppDef[], query: string, canAsk = false) =>
  buildPalette(apps, query, canAsk).groups.map((g) => [
    g.label,
    g.rows.map((r) => r.label),
  ]);

describe("foldText", () => {
  it("ignores case and accents", () => {
    expect(foldText("Café ZCASH")).toBe("cafe zcash");
    expect(foldText("  Vér ")).toBe("ver");
  });
});

describe("buildPalette with an empty query", () => {
  it("lists apps without inner pages first, then one group per app, in sidebar order", () => {
    expect(labels(FIXTURE, "")).toEqual([
      ["Apps", ["News", "Zcash governance", "Café Zcash"]],
      [
        "Coinholder Grants",
        ["Overview", "Results", "Verify it yourself", "Findable"],
      ],
      ["ZCG", ["Overview", "Grants", "ZCG Office"]],
    ]);
  });

  it("gives app rows their app and page rows their glyph", () => {
    const { groups } = buildPalette(FIXTURE, "", false);
    expect(groups[0].app).toBeUndefined();
    expect(groups[0].rows[0]).toMatchObject({
      href: "/news",
      label: "News",
      app: FIXTURE[0],
    });
    expect(groups[1].app).toBe(FIXTURE[1]);
    expect(groups[1].rows[0]).toMatchObject({
      href: "/coinholders",
      label: "Overview",
      mark: "/logos/glyphs/overview.png",
    });
    expect(groups[1].rows[1]).toMatchObject({
      href: "/coinholders/results",
      mark: "/glyphs/results.png",
    });
    expect(groups[2].rows[2].mark).toBeUndefined();
  });

  it("never offers Ask Zarvis and never reports a miss", () => {
    const palette = buildPalette(FIXTURE, "   ", true);
    expect(palette.noMatch).toBe(false);
    expect(palette.groups.some((g) => g.id === "ask")).toBe(false);
  });
});

describe("buildPalette filtering", () => {
  it("matches the page label", () => {
    expect(labels(FIXTURE, "results")).toEqual([
      ["Coinholder Grants", ["Results"]],
    ]);
  });

  it("matches the app label, keeping every entry of that app", () => {
    expect(labels(FIXTURE, "coinholder")).toEqual([
      [
        "Coinholder Grants",
        ["Overview", "Results", "Verify it yourself", "Findable"],
      ],
    ]);
  });

  it("matches the app description", () => {
    expect(labels(FIXTURE, "polls")).toEqual([["Apps", ["Zcash governance"]]]);
  });

  it("lists only the app's landing row when the query is found in its description alone", () => {
    expect(labels(FIXTURE, "fund")).toEqual([["ZCG", ["Overview"]]]);
    expect(labels(FIXTURE, "retroactive program")).toEqual([
      ["Coinholder Grants", ["Overview"]],
    ]);
    expect(labels(FIXTURE, "dev grants")).toEqual([["ZCG", ["Grants"]]]);
  });

  it("ignores case, accents and surrounding spaces", () => {
    expect(labels(FIXTURE, "  CAFE ")).toEqual([["Apps", ["Café Zcash"]]]);
    expect(labels(FIXTURE, "vérify")).toEqual([
      ["Coinholder Grants", ["Verify it yourself"]],
    ]);
  });

  it("opens on the page whose name starts with the query: ver finds Verify it yourself, alone", () => {
    expect(labels(FIXTURE, "ver")).toEqual([
      ["Coinholder Grants", ["Verify it yourself"]],
    ]);
  });

  it("matches at the start of a word, so letters inside Overview or governance do not answer ver", () => {
    const found = paletteRows(buildPalette(FIXTURE, "ver", false).groups).map(
      (r) => r.label,
    );
    expect(found).not.toContain("Overview");
    expect(found).not.toContain("Zcash governance");
  });

  it("puts the group that holds the best match first, sidebar order breaking ties", () => {
    expect(labels(FIXTURE, "grant")).toEqual([
      ["ZCG", ["Grants"]],
      [
        "Coinholder Grants",
        ["Overview", "Results", "Verify it yourself", "Findable"],
      ],
    ]);
    expect(labels(FIXTURE, "over")).toEqual([
      ["Coinholder Grants", ["Overview"]],
      ["ZCG", ["Overview"]],
    ]);
  });

  it("puts a page named exactly by the query first", () => {
    expect(
      paletteRows(buildPalette(FIXTURE, "grants", false).groups)[0],
    ).toMatchObject({
      href: "/zcg/grants",
      label: "Grants",
    });
  });

  it("lets the app's name open its overview before its other pages", () => {
    expect(labels(FIXTURE, "zcg")).toEqual([
      ["ZCG", ["Overview", "ZCG Office", "Grants"]],
    ]);
  });

  it("puts rows named by the query before rows found through their app's description", () => {
    const apps = [
      single("block-zero", "Since block zero", "Upgrade notes since genesis"),
      single("governance", "Zcash governance", "Upgrades and polls"),
      single("upgrades", "Upgrades", "Network changes"),
    ];
    expect(labels(apps, "upgrade")).toEqual([
      ["Apps", ["Upgrades", "Since block zero", "Zcash governance"]],
    ]);
  });

  it("answers a query that names the app and then the page", () => {
    expect(labels(FIXTURE, "zcg grants")).toEqual([["ZCG", ["Grants"]]]);
    expect(labels(FIXTURE, "coinholder   results")).toEqual([
      ["Coinholder Grants", ["Results"]],
    ]);
    expect(labels(FIXTURE, "results coinholder")).toEqual([
      ["Coinholder Grants", ["Results"]],
    ]);
    expect(buildPalette(FIXTURE, "zcg results", false).noMatch).toBe(true);
  });

  it("falls back to letters inside a word only when no word starts with the query", () => {
    expect(labels(FIXTURE, "holder")).toEqual([
      [
        "Coinholder Grants",
        ["Overview", "Results", "Verify it yourself", "Findable"],
      ],
    ]);
    expect(labels(FIXTURE, "nance")).toEqual([["Apps", ["Zcash governance"]]]);
  });

  it("leaves hidden pages out unless they opt in", () => {
    expect(labels(FIXTURE, "secret")).toEqual([]);
    expect(labels(FIXTURE, "findable")).toEqual([
      ["Coinholder Grants", ["Findable"]],
    ]);
  });
});

describe("buildPalette and Zarvis", () => {
  it("adds a last Zarvis group that carries the trimmed question", () => {
    const { groups, noMatch } = buildPalette(FIXTURE, "  grant ", true);
    expect(noMatch).toBe(false);
    const last = groups[groups.length - 1];
    expect(last).toMatchObject({ id: "ask", label: "Zarvis" });
    expect(last.rows).toEqual([
      { href: "/zarvis", label: "Ask Zarvis: “grant”", ask: "grant" },
    ]);
  });

  it("leaves the group out when the chat is not available", () => {
    expect(
      buildPalette(FIXTURE, "grant", false).groups.some((g) => g.id === "ask"),
    ).toBe(false);
  });

  it("reports a miss and still offers Zarvis", () => {
    const palette = buildPalette(FIXTURE, "zzzz", true);
    expect(palette.noMatch).toBe(true);
    expect(palette.groups.map((g) => g.id)).toEqual(["ask"]);
    expect(buildPalette(FIXTURE, "zzzz", false)).toEqual({
      groups: [],
      noMatch: true,
    });
  });
});

describe("paletteRows", () => {
  it("flattens the groups in reading order", () => {
    const { groups } = buildPalette(FIXTURE, "ver", true);
    expect(paletteRows(groups).map((r) => r.label)).toEqual([
      "Verify it yourself",
      "Ask Zarvis: “ver”",
    ]);
  });
});

describe("stepActive", () => {
  it("moves one row and wraps at both ends", () => {
    expect(stepActive(0, 3, "ArrowDown")).toBe(1);
    expect(stepActive(2, 3, "ArrowDown")).toBe(0);
    expect(stepActive(1, 3, "ArrowUp")).toBe(0);
    expect(stepActive(0, 3, "ArrowUp")).toBe(2);
  });

  it("jumps to the first and the last row", () => {
    expect(stepActive(1, 3, "Home")).toBe(0);
    expect(stepActive(1, 3, "End")).toBe(2);
  });

  it("stays at zero when there is nothing to move through", () => {
    expect(stepActive(0, 0, "ArrowDown")).toBe(0);
    expect(stepActive(0, 0, "End")).toBe(0);
  });
});

describe("the real navigation model", () => {
  const apps = APPS.filter((a) => !a.admin && !a.hidden);

  const first = (query: string) =>
    paletteRows(buildPalette(apps, query, true).groups)[0];

  it("opens Verify it yourself when typing ver and pressing Enter", () => {
    expect(first("ver")).toMatchObject({
      href: "/coinholders/verify",
      label: "Verify it yourself",
    });
    const found = paletteRows(buildPalette(apps, "ver", false).groups);
    expect(found.map((r) => r.label)).toEqual(["Verify it yourself"]);
  });

  it("opens the ZCG grants list when typing grant or grants", () => {
    expect(first("grant").href).toBe("/zcg/grants");
    expect(first("grants").href).toBe("/zcg/grants");
  });

  it("opens an app's landing page when typing its name", () => {
    expect(first("zcg").href).toBe("/zcg");
    expect(first("coinholder").href).toBe("/coinholders");
    expect(first("hub").href).toBe("/zechub");
  });

  it("finds a page by app and page name together", () => {
    expect(first("zcg grants").href).toBe("/zcg/grants");
    expect(first("coinholder results").href).toBe("/coinholders/results");
  });

  it("keeps consolidated destinations discoverable by their former names", () => {
    expect(first("Z3").href).toBe("/ecosystem/history/z3");
    expect(first("DeFi").href).toBe("/zec-observatory");
    expect(first("liquidity").href).toBe("/zec-observatory");
  });

  it("gives every row a unique address within the list", () => {
    const hrefs = paletteRows(buildPalette(apps, "", false).groups).map(
      (r) => r.href,
    );
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("lists and finds each nested organization exactly once", () => {
    const ecosystem = apps.find((app) => app.id === "ecosystem")!;
    const allRows = paletteRows(buildPalette(apps, "", false).groups);
    for (const app of childAppsOf(ecosystem)) {
      expect(allRows.filter((row) => row.href === app.href), app.id).toHaveLength(1);
      const matches = paletteRows(buildPalette(apps, app.label, false).groups);
      expect(matches.filter((row) => row.href === app.href), app.label).toHaveLength(1);
      expect(matches[0].href).toBe(app.href);
    }
    expect(first("ZecHub Copilot").href).toBe("/zechub/copilot");
  });
});
