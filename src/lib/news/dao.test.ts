import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ getDb: () => { throw new Error("database disabled in source test"); } }));
vi.mock("@/lib/zcg/github-applications", () => ({ getGrantApplications: async () => [] }));
vi.mock("./github", () => ({
  NEWS_GITHUB_REPOSITORIES: [], readGitHubNews: async () => [], githubNewsHealth: () => [],
}));

// Observed on Juno on 2026-11-17. The contract has start_height, not createdAt.
const proposals = [
  { id: 194, title: "Development and Maintenance of Anti-Scam and Anti-Spam Bots for Discord and Telegram (12 Months)", height: 43_776_268, time: "2026-11-15T18:39:29.957403480Z" },
  { id: 193, title: "Penumbra Validator: Approve Operation Cost And Begin", height: 43_681_274, time: "2026-11-12T22:30:23.135406837Z" },
  { id: 100, title: "Older test proposal", height: 100, time: "2026-11-01T00:00:00Z" },
];
const raw = proposals.map(p => ({
  id: p.id,
  proposal: {
    title: p.title, status: "open", proposer: "juno1proposer", start_height: p.height,
    votes: { yes: "2", no: "0", abstain: "0" },
    expiration: { at_time: "1795199969957403480" },
  },
}));
const at = Date.parse("2026-11-17T04:35:00Z");
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(at);
  delete (globalThis as typeof globalThis & { __openZcashNewsFeed?: unknown }).__openZcashNewsFeed;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function sourceFetch(blocksAvailable = true) {
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("forum.zcashcommunity.com")) return Response.json({ topic_list: { topics: [] } });
    if (url.includes("indexer.daodao.zone")) return new Response("error code: 1016", { status: 530 });
    if (url.includes("/smart/")) return Response.json({ data: { proposals: raw } });
    if (url.includes("/blocks/")) {
      if (!blocksAvailable) return new Response("block unavailable", { status: 404 });
      const p = proposals.find(item => String(item.height) === url.split("/").at(-1))!;
      return Response.json({ sdk_block: { header: { chain_id: "juno-1", height: String(p.height), time: p.time } } });
    }
    throw new Error(`Unexpected source: ${url}`);
  });
}

describe("DAO news during an indexer outage", () => {
  it("shows recent chain proposals in the DAO filter with their creation dates", async () => {
    sourceFetch();
    const { getNews } = await import("./feed");
    const { newsView } = await import("./view");
    const items = await getNews();
    const view = newsView(items, { source: "dao" }, at);
    expect(view.counts.dao).toBe(2);
    expect(view.newCount).toBe(1);
    expect(view.shown.map(item => ({ title: item.title, ts: item.ts }))).toEqual([
      { title: `A194 · ${proposals[0].title}`, ts: "2026-11-15T18:39:29.957Z" },
      { title: `A193 · ${proposals[1].title}`, ts: "2026-11-12T22:30:23.135Z" },
    ]);
    expect(view.shown[0].url).toMatch(/\/proposals\/A194$/);
    expect(items.some(item => item.title.includes("Older test proposal"))).toBe(false);
  });

  it("only looks up the requested proposal window and reuses dates on the next refresh", async () => {
    sourceFetch();
    const { getZechubProposals } = await import("@/lib/dao/zechub");
    expect(await getZechubProposals(1)).toMatchObject([{ id: 194, createdAt: "2026-11-15T18:39:29.957Z" }]);
    const blockCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes("/blocks/"));
    expect(blockCalls()).toHaveLength(1);
    vi.setSystemTime(at + 600_001);
    expect(await getZechubProposals(1)).toMatchObject([{ id: 194, createdAt: "2026-11-15T18:39:29.957Z" }]);
    expect(blockCalls()).toHaveLength(1);
  });

  it("keeps unavailable dates unknown instead of treating fetch time or expiry as publication", async () => {
    sourceFetch(false);
    const { getNews } = await import("./feed");
    expect(await getNews()).toEqual([]);
    const { getZechubProposals } = await import("@/lib/dao/zechub");
    expect((await getZechubProposals()).every(p => p.createdAt === "")).toBe(true);
  });
});
