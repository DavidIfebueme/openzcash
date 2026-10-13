import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ getDb: () => { throw new Error("database disabled in source test"); } }));
vi.mock("@/lib/dao/zechub", () => ({ getZechubProposals: async () => [] }));
vi.mock("@/lib/zcg/github-applications", () => ({ getGrantApplications: async () => [] }));

const at = Date.parse("2026-10-05T05:00:00Z");
const release = { name: "Zebra 7.0.0-rc.0", tag_name: "v7.0.0-rc.0", published_at: "2026-10-02T00:02:03Z", html_url: "https://github.com/ZcashFoundation/zebra/releases/tag/v7.0.0-rc.0", draft: false };
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(at);
  delete (globalThis as typeof globalThis & { __openZcashNewsFeed?: unknown }).__openZcashNewsFeed;
  delete (globalThis as typeof globalThis & { __openZcashNewsGitHub?: unknown }).__openZcashNewsGitHub;
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function sourceFetch(options: { github: "live" | "failed" | "empty"; forum: boolean }) {
  return vi.fn<typeof fetch>().mockImplementation(async input => {
    const url = String(input);
    if (url.includes("forum.zcashcommunity.com/latest.json")) return Response.json({ topic_list: { topics: options.forum ? [{ id: 1, slug: "unrelated", title: "Community gathering", created_at: new Date(Date.now()).toISOString() }] : [] } });
    if (url.includes("api.github.com/repos/")) {
      if (options.github === "failed") return Response.json({ message: "rate limit exceeded" }, { status: 403 });
      return Response.json(options.github === "live" && url.includes("ZcashFoundation/zebra/") ? [release] : []);
    }
    throw new Error("Unexpected source");
  });
}

describe("News partial GitHub recovery", () => {
  it("keeps GitHub releases when another source succeeds and GitHub alone fails", async () => {
    const state = { github: "live" as "live" | "failed" | "empty", forum: true };
    vi.stubGlobal("fetch", sourceFetch(state));
    const feed = await import("./feed");
    expect((await feed.getNews()).filter(item => item.source === "github")).toHaveLength(1);
    state.github = "failed"; vi.setSystemTime(at + 3_600_000);
    await feed.getNews();
    await vi.waitFor(() => expect(feed.newsFetchedAt()).toBe(at + 3_600_000));
    const items = await feed.getNews();
    expect(items.some(item => item.source === "forum")).toBe(true);
    expect(items.filter(item => item.source === "github")).toHaveLength(1);
    expect(feed.githubNewsHealth()[0]).toMatchObject({ status: "cached", lastSuccessAt: "2026-10-05T05:00:00.000Z" });
  });

  it("does not resurrect old GitHub items when every source returns an empty list successfully", async () => {
    const state = { github: "live" as "live" | "failed" | "empty", forum: false };
    vi.stubGlobal("fetch", sourceFetch(state));
    const feed = await import("./feed");
    expect(await feed.getNews()).toHaveLength(1);
    state.github = "empty"; vi.setSystemTime(at + 3_600_000);
    await feed.getNews();
    await vi.waitFor(() => expect(feed.newsFetchedAt()).toBe(at + 3_600_000));
    expect(await feed.getNews()).toEqual([]);
    expect(feed.githubNewsHealth().every(source => source.status === "live")).toBe(true);
  });

  it("keeps the seven-day window on cached GitHub releases during a continuing outage", async () => {
    const state = { github: "live" as "live" | "failed" | "empty", forum: true };
    vi.stubGlobal("fetch", sourceFetch(state));
    const feed = await import("./feed");
    await feed.getNews();
    state.github = "failed"; vi.setSystemTime(at + 7 * 86_400_000);
    await feed.getNews();
    await vi.waitFor(() => expect(feed.newsFetchedAt()).toBe(at + 7 * 86_400_000));
    expect((await feed.getNews()).filter(item => item.source === "github")).toEqual([]);
    expect(feed.githubNewsHealth()[0].status).toBe("cached");
  });

  it.each(["empty", "failed"] as const)("prunes expired records when forum succeeds empty and previously %s GitHub sources fail", async initial => {
    const state = { github: initial as "live" | "failed" | "empty", forum: true };
    vi.stubGlobal("fetch", sourceFetch(state));
    const feed = await import("./feed");
    expect((await feed.getNews()).map(item => item.source)).toEqual(["forum"]);
    const afterWindow = at + 8 * 86_400_000;
    state.github = "failed"; state.forum = false; vi.setSystemTime(afterWindow);
    await feed.getNews();
    await vi.waitFor(async () => expect(await feed.getNews()).toEqual([]));
    expect(feed.newsFetchedAt()).toBe(afterWindow);
  });

  it("exposes a cold source failure without turning other successful news into an error", async () => {
    vi.stubGlobal("fetch", sourceFetch({ github: "failed", forum: true }));
    const feed = await import("./feed");
    expect((await feed.getNews()).map(item => item.source)).toEqual(["forum"]);
    expect(feed.githubNewsHealth().every(source => source.status === "unavailable")).toBe(true);
  });
});

it("checks fresh forum data every five minutes without shortening the release schedule", async () => {
  const fetcher = sourceFetch({ github: "live", forum: true });
  vi.stubGlobal("fetch", fetcher);
  const feed = await import("./feed");
  await feed.getNews();
  const count = (needle: string) => fetcher.mock.calls.filter(([url]) => String(url).includes(needle)).length;
  expect(count("latest.json")).toBe(1);
  await feed.getNews();
  expect(count("latest.json")).toBe(1);
  vi.setSystemTime(at + 5 * 60_000);
  await feed.getNews();
  await vi.waitFor(() => expect(feed.newsFetchedAt()).toBe(at + 5 * 60_000));
  expect(count("latest.json")).toBe(2);
  expect(count("/releases?")).toBe(5);
});

it("retains a failed forum independently and removes it on a successful empty response", async () => {
  const fetcher = sourceFetch({ github: "empty", forum: true });
  vi.stubGlobal("fetch", fetcher);
  const feed = await import("./feed");
  const first = await feed.getNews();
  fetcher.mockImplementation(async input => String(input).includes("latest.json") ? Response.json({}, { status: 503 }) : Response.json([]));
  vi.setSystemTime(at + 5 * 60_000);
  await feed.getNews();
  await vi.waitFor(() => expect(feed.newsUnavailableSources()).toContain("Forum"));
  expect(await feed.getNews()).toEqual(first);
  fetcher.mockImplementation(async input => String(input).includes("latest.json") ? Response.json({ topic_list: { topics: [] } }) : Response.json([]));
  vi.setSystemTime(at + 10 * 60_000);
  await feed.getNews();
  await vi.waitFor(() => expect(feed.newsUnavailableSources()).not.toContain("Forum"));
  expect(await feed.getNews()).toEqual([]);
});

it("runs one scheduled collector without page visits and shares it across server bundles", async () => {
  const fetcher = sourceFetch({ github: "empty", forum: true });
  vi.stubGlobal("fetch", fetcher);
  const feed = await import("./feed");
  feed.startNewsSchedule(); feed.startNewsSchedule();
  await vi.advanceTimersByTimeAsync(5_000);
  expect(fetcher.mock.calls.filter(([url]) => String(url).includes("latest.json"))).toHaveLength(1);
  vi.resetModules();
  const otherBundle = await import("./feed");
  expect(await otherBundle.getNews()).toEqual(await feed.getNews());
  otherBundle.startNewsSchedule();
  await vi.advanceTimersByTimeAsync(5 * 60_000 + 15_000);
  expect(fetcher.mock.calls.filter(([url]) => String(url).includes("latest.json"))).toHaveLength(2);
});
