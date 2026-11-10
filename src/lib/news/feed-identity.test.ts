import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const records = vi.hoisted(() => ({
  sheet: [] as Array<Record<string, unknown>>,
  proposals: [] as Array<Record<string, unknown>>,
  recorded: [] as Array<Record<string, unknown>>,
  recordedFails: false,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({
  getDb: () => ({
    select: (selection: Record<string, unknown>) => {
      const source = "recipient" in selection ? "sheet" : "detail" in selection ? "recorded" : "proposals";
      const query = {
        from: () => query,
        where: () => query,
        orderBy: () => query,
        // Honor the selected columns: forgetting to select the primary key
        // must fail this regression instead of receiving it from the mock.
        limit: async (count: number) => {
          if (source === "recorded" && records.recordedFails) throw new Error("changelog unavailable");
          return records[source].slice(0, count).map(row =>
            Object.fromEntries(Object.keys(selection).map(key => [key, row[key]])),
          );
        },
      };
      return query;
    },
  }),
}));
vi.mock("@/lib/dao/zechub", () => ({ getZechubProposals: async () => [] }));
vi.mock("@/lib/zcg/github-applications", () => ({ getGrantApplications: async () => [] }));
vi.mock("./github", () => ({
  NEWS_GITHUB_REPOSITORIES: [], readGitHubNews: async () => [], githubNewsHealth: () => [],
}));

const at = Date.parse("2026-10-05T07:00:00Z");

beforeEach(() => {
  vi.resetModules();
  delete (globalThis as typeof globalThis & { __openZcashNewsFeed?: unknown }).__openZcashNewsFeed;
  vi.useFakeTimers();
  vi.setSystemTime(at);
  records.sheet = [];
  records.proposals = [];
  records.recorded = [];
  records.recordedFails = false;
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ topic_list: { topics: [] } })));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("News record identity", () => {
  it("preserves distinct payments with the same project, amount and date, including fallback links", async () => {
    records.sheet = ["payment-a", "payment-b", "payment-c", "payment-d"].map((id, index) => ({
      id, recipient: "ZcashMe, Inc.", usd: 400_000n, paid: "2026-10-01",
      project: index < 2 ? "Zcash Name Service" : null,
    }));
    const feed = await import("./feed");
    const items = await feed.getNews();

    expect(items).toHaveLength(4);
    expect(items.every(item => item.source === "sheet")).toBe(true);
    expect(new Set(items.map(item => item.title)).size).toBe(1);
    expect(items.map(item => item.url)).toEqual([
      "/zcg/grant?g=Zcash%20Name%20Service", "/zcg/grant?g=Zcash%20Name%20Service",
      "/zcg/disbursements", "/zcg/disbursements",
    ]);
    expect(items.map(item => item.id)).toEqual([
      "sheet:payment-a", "sheet:payment-b", "sheet:payment-c", "sheet:payment-d",
    ]);

    records.sheet.reverse();
    vi.setSystemTime(at + 3_600_000);
    await feed.getNews();
    await vi.waitFor(() => expect(feed.newsFetchedAt()).toBe(at + 3_600_000));
    expect((await feed.getNews()).map(item => item.id)).toEqual([
      "sheet:payment-d", "sheet:payment-c", "sheet:payment-b", "sheet:payment-a",
    ]);
  });

  it("lists a payment the ledger recorded this week even when it was paid weeks earlier", async () => {
    records.sheet = [{ id: "late", recipient: "Least Authority", usd: 434_112n, paid: "2026-09-10", project: "Zcash Ecosystem Security Lead", isTest: false }];
    records.recorded = [{ title: "Zcash Ecosystem Security Lead", detail: "1 payment · $4,341", at: new Date("2026-10-04T01:25:57Z") }];
    const feed = await import("./feed");
    expect(await feed.getNews()).toMatchObject([{
      id: "sheet:late", ts: "2026-10-04T01:25:57.000Z",
      title: "Least Authority — $4,341.12 · paid Sep 10",
    }]);
  });

  it("shows every payment of a busy week, not only the twelve most recent", async () => {
    records.sheet = Array.from({ length: 15 }, (_, index) => ({
      id: `payment-${index}`, recipient: "ZcashMe, Inc.", usd: 400_000n, paid: "2026-10-01", project: null, isTest: false,
    }));
    const feed = await import("./feed");
    expect(await feed.getNews()).toHaveLength(15);
  });

  it("falls back to paid-out dates when the record history cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    records.sheet = [{ id: "paid", recipient: "ZcashMe, Inc.", usd: 400_000n, paid: "2026-10-01", project: null, isTest: false }];
    records.recordedFails = true;
    const feed = await import("./feed");
    expect(await feed.getNews()).toMatchObject([{ id: "sheet:paid", ts: "2026-10-01T00:00:00.000Z" }]);
    expect(feed.newsUnavailableSources()).not.toContain("Spreadsheet");
  });

  it("keeps separate proposals distinct even with identical titles and shared or missing source links", async () => {
    records.proposals = ["proposal-a", "proposal-b", "proposal-c", "proposal-d"].map((id, index) => ({
      id, title: "Project renewal", program: "zcg", submitted: "2026-10-01",
      forum: index < 2 ? "https://forum.zcashcommunity.com/t/project/123" : null,
      platform: null,
    }));
    const feed = await import("./feed");
    const items = await feed.getNews();

    expect(items).toHaveLength(4);
    expect(items.every(item => item.source === "proposal")).toBe(true);
    expect(new Set(items.map(item => item.title)).size).toBe(1);
    expect(items.map(item => item.url)).toEqual([
      "https://forum.zcashcommunity.com/t/project/123", "https://forum.zcashcommunity.com/t/project/123",
      "/zcg/proposals", "/zcg/proposals",
    ]);
    expect(items.map(item => item.id)).toEqual([
      "proposal:proposal-a", "proposal:proposal-b", "proposal:proposal-c", "proposal:proposal-d",
    ]);

    records.proposals.reverse();
    vi.setSystemTime(at + 3_600_000);
    await feed.getNews();
    await vi.waitFor(() => expect(feed.newsFetchedAt()).toBe(at + 3_600_000));
    expect((await feed.getNews()).map(item => item.id)).toEqual([
      "proposal:proposal-d", "proposal:proposal-c", "proposal:proposal-b", "proposal:proposal-a",
    ]);
  });
});
