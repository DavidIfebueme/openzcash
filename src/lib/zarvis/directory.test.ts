import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { communitiesContext, walletsContext } from "./directory";
import { charBudget, compactData, rowLimit } from "./data";
import { safeSourceUrl } from "./sources";
import { HARDWARE, SOFTWARE } from "@/app/wallets/catalog-data";
import { COMMUNITIES } from "@/lib/communities/data";
import {
  applyLedgerFunding,
  type CommunitiesFunding,
} from "@/lib/communities/ledger-funding";
import { applyDaoFunding } from "@/lib/communities/dao-funding";
import { ZECHUB_DAO_PROPOSALS } from "@/lib/communities/dao-proposals";

const cents = (usd: number) => BigInt(Math.round(usd * 100));
/** The request-time overlay /communities and Zarvis read: a ledger row for
 * every curated recipient (plus the two approved in September, Zcash India
 * and Zcash East Africa Community, as the ledger showed them on 2026-09-30)
 * and the treasury sheet row of every mapped DAO grant. Live rows carry
 * more fields than the dated fallback, so they cost more of the budget. */
function liveOverlay(): CommunitiesFunding {
  const totals = [
    ...COMMUNITIES.flatMap((c) =>
      c.zcg.recipient && c.zcg.budgetedUsd !== undefined
        ? [
            {
              recipientName: c.zcg.recipient,
              externalUsdCents: cents(c.zcg.budgetedUsd),
              externalPaidUsdCents: cents(c.zcg.budgetedUsd * 0.85),
              grantCount: c.zcg.grants ?? 1,
              externalPaymentCount: 12,
              externalLastPaid: "2026-09-28",
            },
          ]
        : [],
    ),
    { recipientName: "Zcash India", externalUsdCents: cents(20_300), externalPaidUsdCents: 0n, grantCount: 1, externalPaymentCount: 0, externalLastPaid: null },
    { recipientName: "Zcash East Africa Community", externalUsdCents: cents(11_040), externalPaidUsdCents: cents(9_800), grantCount: 1, externalPaymentCount: 1, externalLastPaid: "2026-09-28" },
  ];
  const ledger = applyLedgerFunding(COMMUNITIES, totals);
  const sheet = Object.values(ZECHUB_DAO_PROPOSALS).flatMap((p) =>
    p.sheet
      ? [
          {
            title: p.sheet.title,
            paidUsdCents: p.sheet.paidUsd === null ? null : cents(p.sheet.paidUsd),
            pendingUsdCents: p.sheet.outstandingUsd === null ? null : cents(p.sheet.outstandingUsd),
            m1: "Complete",
            m2: "Incomplete",
            m3: null,
            capturedOn: "2026-09-21",
          },
        ]
      : [],
  );
  const dao = applyDaoFunding(ledger.communities, sheet);
  return { communities: dao.communities, source: ledger.source, dao: dao.dao };
}
const DAO_FUNDED = COMMUNITIES.filter((c) => c.zcg.zechubDao?.proposals.length).map((c) => c.name);

describe("Wallet catalog lookup", () => {
  it("filters by shielded level and platform while keeping the whole inventory listed", () => {
    const ios = walletsContext("Which wallets support shielded ZEC on iOS?");
    expect(ios.filter).toMatchObject({
      platform: "iOS",
      shielded: "full",
      kind: null,
    });
    expect(
      ios.wallets.every(
        (w) => w.platforms.includes("iOS") && w.shielded === "full",
      ),
    ).toBe(true);
    expect(ios.wallets.map((w) => w.name)).toEqual(
      expect.arrayContaining(["Zodl", "Zingo!"]),
    );
    expect(ios.allWallets.split(", ")).toHaveLength(SOFTWARE.length + HARDWARE.length);
    expect(ios).toMatchObject({
      catalogRevisedOn: "2026-10-15",
      totalWallets: 19,
      hardwareWallets: 3,
    });
    const transparent = walletsContext("quais carteiras são só transparentes?");
    expect(transparent.wallets.map((w) => w.name).sort()).toEqual([
      "Gem Wallet",
      "Trezor",
    ]);
    expect(
      walletsContext("hardware wallets").wallets.map((w) => w.name),
    ).toEqual(["Keystone", "Ledger", "Trezor"]);
  });
  it("finds a wallet by name and reports an absent one as not catalogued rather than inventing it", () => {
    const zingo = walletsContext("Does Zingo have a desktop version?");
    expect(zingo.filter.names).toEqual(["Zingo!"]);
    expect(zingo.wallets).toHaveLength(1);
    expect(zingo.wallets[0]).toMatchObject({
      maker: "Zingo Labs",
      platforms: "iOS, Android",
      shielded: "unknown",
      availability: "unknown",
      site: "https://zingolabs.org/zingo/",
      sourceCode: "https://github.com/zingolabs",
    });
    const unknown = walletsContext("Is FooCoin Wallet safe?");
    expect(unknown.filter.names).toEqual([]);
    expect(unknown.matched).toBe(19);
    expect(unknown.note).toContain("not nonexistent");
    const zashi = walletsContext("Is Zashi available on Android?");
    expect(zashi.filter.names).toEqual(["Zodl"]);
    expect(zashi.wallets.map((w) => w.name)).toEqual(["Zodl"]);
    expect(walletsContext("open source wallet with audit").filter.names).toEqual([]);
  });
  it("finds Zucchini by name with its official site and no unverified source or audit claims", () => {
    const zucchini = walletsContext("Zucchini browser wallet");
    expect(zucchini.filter.names).toEqual(["Zucchini Wallet"]);
    expect(zucchini.wallets).toHaveLength(1);
    expect(zucchini.wallets[0]).toMatchObject({
      name: "Zucchini Wallet",
      maker: "Zucchini",
      platforms: "Browser extension",
      shielded: "full",
      availability: "match",
      site: "https://zucchinifi.xyz/",
    });
    expect(zucchini.wallets[0]).not.toHaveProperty("sourceCode");
    expect(zucchini.wallets[0]).not.toHaveProperty("auditReport");
    expect(safeSourceUrl(zucchini.wallets[0].site)).toBe("https://zucchinifi.xyz/");
  });
  it("does not offer Brave, unknown Snap or unreleased wallets for Android shielded requests", () => {
    const android = walletsContext("android shielded");
    const names = android.wallets.map((wallet) => wallet.name);
    expect(names).toContain("Zodl");
    expect(names).not.toContain("Brave Wallet");
    expect(android.allWallets).toContain("Brave Wallet:unavailable");
    expect(names).not.toContain("MetaMask Snap");
    expect(names).not.toContain("Zipher");
    expect(names).not.toContain("zSTASH");
    expect(walletsContext("Ledger wallet").wallets[0]).toMatchObject({ shielded: "full", note: expect.stringContaining("Ledger Wallet Desktop 4.21+") });
  });
  it("keeps the inventory, revision date and note ahead of the rows when many wallets match", () => {
    for (const q of ["", "Android"]) {
      const out = compactData(walletsContext(q), q, charBudget("wallets"), rowLimit("wallets"));
      const shown = out.data as { allWallets: string; catalogRevisedOn: string; note: string; wallets: { shown: unknown[] } };
      expect(shown.allWallets.split(", "), q).toHaveLength(19);
      expect(shown.catalogRevisedOn).toBe("2026-10-15");
      expect(shown.note).toContain("last edit");
      expect(shown.wallets.shown.length, q).toBeGreaterThanOrEqual(10);
    }
  });
  it("cites only links the allowlist renders, and fits the default serialized budget with a filter", () => {
    for (const w of [...SOFTWARE, ...HARDWARE])
      for (const link of [w.url, w.source, w.audit])
        if (link) expect(safeSourceUrl(link), link).toBe(new URL(link).href);
    const shown = compactData(
      walletsContext("android shielded"),
      "android shielded",
      5000,
      24,
    );
    expect(
      (shown.data as { wallets: { shown: unknown[] } }).wallets.shown.length,
    ).toBeGreaterThanOrEqual(6);
  });
});

describe("Community directory lookup", () => {
  it("routes country, region and Portuguese names to the right groups", () => {
    expect(communitiesContext("Zcash Brasil").communities[0]).toMatchObject({
      name: "Zcash Brazil",
      country: "Brazil",
      language: "Portuguese",
      zcgFunded: true,
      zcgLedgerRecipient: "Zcash Brazil",
      site: "https://zcashbrasil.com.br",
    });
    expect(
      communitiesContext(
        "Is there a Zcash community in Nigeria?",
      ).communities.map((c) => c.name),
    ).toEqual(["Zcash Nigeria"]);
    expect(
      communitiesContext("comunidades na África").communities.map(
        (c) => c.region,
      ),
    ).toEqual(expect.arrayContaining(["Africa"]));
    expect(
      communitiesContext("comunidades na África").communities.every(
        (c) => c.region === "Africa" || /africa/i.test(c.country),
      ),
    ).toBe(true);
    expect(
      communitiesContext("Spanish-speaking communities").communities.every(
        (c) => /Spanish/.test(c.language),
      ),
    ).toBe(true);
  });
  it("lists every community by region even when filtered, with the verification date and funding semantics", () => {
    const all = communitiesContext("");
    expect(all).toMatchObject({
      verifiedOn: "2026-09-20",
      totalCommunities: COMMUNITIES.length,
      matched: COMMUNITIES.length,
    });
    expect(Object.values(all.allCommunitiesByRegion).flatMap((s) => s.split(", "))).toHaveLength(COMMUNITIES.length);
    const funded = communitiesContext("which communities are funded by ZCG?");
    expect(funded.filter.fundedOnly).toBe(true);
    expect(funded.communities.every((c) => c.zcgFunded)).toBe(true);
    expect(all.note).toContain("budgeted USD");
    // Forum topics ride on a focused answer only; a broad list spends the budget on rows.
    const brazil = communitiesContext("Zcash Brasil").communities[0];
    expect(brazil.forumTopics?.[0]).toMatch(
      /^report: .+ https:\/\/forum\.zcashcommunity\.com\/t\/\d+$/,
    );
    expect(brazil.forumTopics?.length).toBeLessThanOrEqual(2);
    expect(all.communities.some((c) => "forumTopics" in c)).toBe(false);
    expect(all.communities.find((c) => !c.zcgFunded)).not.toHaveProperty("zcgBudgetedUsd");
    expect(communitiesContext("Zcash Atlantis").matched).toBe(0);
  });
  it("answers with the live ledger's funding, the same figures /communities shows", () => {
    const live = applyLedgerFunding(COMMUNITIES, [
      {
        recipientName: "Zcash Brazil",
        externalUsdCents: 65_595_543n,
        externalPaidUsdCents: 55_662_043n,
        grantCount: 7,
        externalPaymentCount: 62,
        externalLastPaid: "2026-09-01",
      },
    ]);
    const ctx = communitiesContext("Zcash Brasil", live);
    expect(ctx.fundingSource).toBe("ledger");
    expect(ctx).not.toHaveProperty("fallbackLedgerAsOf");
    expect(ctx.zcgFundedCommunities).toBe(
      live.communities.filter((c) => c.zcg.funded).length,
    );
    expect(ctx.communities[0]).toMatchObject({
      name: "Zcash Brazil",
      zcgBudgetedUsd: 655955.43,
      zcgPaidUsd: 556620.43,
      zcgGrants: 7,
      lastPaidDate: "2026-09-01",
    });
  });
  it("labels the dated fallback, and never reports a ledger recipient funded without figures", () => {
    const fallback = communitiesContext("Zcash Brasil");
    expect(fallback).toMatchObject({
      fundingSource: "fallback",
      fallbackLedgerAsOf: "2026-08-23",
    });
    expect(fallback.note).toContain("fallbackLedgerAsOf");
    expect(fallback.communities[0]).toMatchObject({ lastPaidDate: "2026-08-03" });
    expect(fallback.communities[0]).not.toHaveProperty("zcgPaidUsd");
    for (const c of communitiesContext("").communities)
      if (c.zcgFunded && c.zcgLedgerRecipient)
        expect(c.zcgBudgetedUsd, c.name).not.toBeNull();
  });
  it("reports ZecHub DAO grants next to ZCG funding, from the sheet overlay or its dated fallback", () => {
    const mexico = communitiesContext("Club Zcash Querétaro").communities[0];
    expect(mexico).toMatchObject({ name: "Zcash México", zechubDaoFunded: true });
    expect(mexico.zechubDaoGrants).toBe(
      "A178 Oct–Nov 2026: $5,800; $1,500 paid, $4,300 outstanding",
    );
    const brazil = communitiesContext("Zcash Brasil").communities[0];
    expect(brazil).toMatchObject({ zcgFunded: true, zechubDaoFunded: true });
    expect(brazil.zechubDaoGrants).toBe("A45 Sep–Oct 2024: $1,200");
    const korea = communitiesContext("Zcash Korea").communities[0];
    expect(korea.zechubDaoGrants).toMatch(/^A154 Jun–Aug 2026: .+ \| A176 Sep–Dec 2026: \$4,000; \$4,000 outstanding$/);
    expect(korea.zechubDaoEarlierGrants).toBe("A60, A84, A106");
    const ukraine = communitiesContext("Zcash Ukraine").communities[0];
    expect(ukraine.zechubDaoNote).toMatch(/A131 and A133 were rejected/);
    const all = communitiesContext("");
    expect(all.daoPayouts).toBe("ZecHub treasury sheet of 2026-09-21, dated copy");
    expect(all.note).toContain("zechubDao*: ZecHub DAO grants, paid per daoPayouts");
    expect(all.communities.find((c) => !c.zechubDaoFunded)).not.toHaveProperty("zechubDaoGrants");
    // A broad list keeps the flag only, so more rows fit the budget.
    const listed = all.communities.find((c) => c.name === "Zcash Korea");
    expect(listed).toMatchObject({ zechubDaoFunded: true });
    expect(listed).not.toHaveProperty("zechubDaoGrants");
    expect(listed).not.toHaveProperty("zechubDaoLatest");
  });
  it("marks a dated copy that stands in for a row the live sheet no longer lists", () => {
    const live = applyDaoFunding(COMMUNITIES, [
      { title: "Zcash Korea September – December 2026 - $4000", paidUsdCents: 200_000n, pendingUsdCents: 200_000n, m1: "Complete", m2: null, m3: null, capturedOn: "2026-10-05" },
    ]);
    const ctx = communitiesContext("Querétaro", { communities: live.communities, source: "fallback", dao: live.dao });
    expect(ctx.daoPayouts).toBe("ZecHub treasury sheet of 2026-10-05");
    expect(ctx.communities[0].zechubDaoGrants).toBe(
      "A178 Oct–Nov 2026: $5,800; $1,500 paid, $4,300 outstanding (sheet as of 2026-09-21)",
    );
    const korea = communitiesContext("Zcash Korea", { communities: live.communities, source: "fallback", dao: live.dao });
    expect(korea.communities[0].zechubDaoGrants).toMatch(/A176 Sep–Dec 2026: \$4,000; \$2,000 paid, \$2,000 outstanding$/);
  });
  it("finds the ZecHub DAO's communities when asked about the DAO, in English, Portuguese or Spanish", () => {
    for (const q of [
      "Which communities does the ZecHub DAO fund?",
      "Quais comunidades a ZecHub DAO financia?",
      "Quais comunidades são financiadas pela ZecHub DAO?",
      "¿Qué comunidades financia la DAO de ZecHub?",
    ]) {
      const dao = communitiesContext(q);
      expect(dao.matched, q).toBe(DAO_FUNDED.length);
      expect(dao.communities.every((c) => c.zechubDaoFunded), q).toBe(true);
      expect(dao.communities.map((c) => c.name), q).not.toContain("ZecHub");
      expect(dao.communities.find((c) => c.name === "Zcash México")?.zechubDaoLatest, q).toBe(
        "A178 Oct–Nov 2026: $5,800; $1,500 paid, $4,300 outstanding",
      );
    }
    // A word that names a community still narrows the answer to it.
    expect(communitiesContext("Does the ZecHub DAO fund Zcash Ghana?").communities[0].name).toBe("Zcash Ghana");
  });
  it("names every community on each channel ahead of the rows, so a cut list still answers who is funded", () => {
    const all = communitiesContext("");
    expect(all.allZechubDaoFunded.split(", ")).toEqual(DAO_FUNDED);
    expect(all.zechubDaoFundedCommunities).toBe(DAO_FUNDED.length);
    expect(all.allZcgFunded.split(", ")).toEqual(COMMUNITIES.filter((c) => c.zcg.funded).map((c) => c.name));
    const live = liveOverlay();
    const liveCtx = communitiesContext("", live);
    expect(liveCtx.allZcgFunded.split(", ")).toEqual(expect.arrayContaining(["Zcash India", "Zcash East Africa"]));
    expect(liveCtx.zcgFundedCommunities).toBe(liveCtx.allZcgFunded.split(", ").length);
    for (const [label, funding] of [["fallback", undefined], ["live", live]] as const) {
      const q = "Which communities does the ZecHub DAO fund?";
      const out = compactData(communitiesContext(q, funding), q, charBudget("communities"), rowLimit("communities"));
      const shown = out.data as { allZechubDaoFunded: string; communities: { totalRows: number; shown: { name: string }[] } };
      expect(shown.allZechubDaoFunded.split(", "), label).toEqual(DAO_FUNDED);
      expect(shown.allZechubDaoFunded, label).toContain("Zcash México");
      expect(shown.communities.totalRows, label).toBe(DAO_FUNDED.length);
      expect(shown.communities.shown.length, label).toBeGreaterThanOrEqual(5);
    }
  });
  it("keeps the region inventory and the matched row within the serialized budget", () => {
    const shown = compactData(
      communitiesContext("Zcash Brasil"),
      "zcash brasil",
      5000,
      10,
    ).data as {
      allCommunitiesByRegion: Record<string, string>;
      communities: { shown: { name: string }[] };
    };
    expect(shown.communities.shown[0].name).toBe("Zcash Brazil");
    expect(shown.allCommunitiesByRegion["Latin America"]).toContain(
      "Zcash Brazil",
    );
  });
  it("keeps the region inventory, verification date and note ahead of the rows when several communities match, on the dated fallback and the live overlay", () => {
    const live = liveOverlay();
    for (const [label, funding] of [["fallback", undefined], ["live", live]] as const)
      for (const [q, min] of [["", 5], ["Latin America", 5], ["which communities are funded by ZCG?", 5], ["comunidades na África", 5]] as const) {
        const out = compactData(communitiesContext(q, funding), q, charBudget("communities"), rowLimit("communities"));
        const shown = out.data as { verifiedOn: string; note: string; allCommunitiesByRegion: Record<string, string>; allZcgFunded: string; communities: { shown: { name: string }[] } };
        expect(Object.values(shown.allCommunitiesByRegion).flatMap((s) => s.split(", ")), `${label} ${q}`).toHaveLength(COMMUNITIES.length);
        expect(shown.allZcgFunded, `${label} ${q}`).toBeTruthy();
        expect(shown.verifiedOn).toBe("2026-09-20");
        expect(shown.note).toContain("zcgFunded false");
        expect(shown.communities.shown.length, `${label} ${q}`).toBeGreaterThanOrEqual(min);
      }
  });
});
