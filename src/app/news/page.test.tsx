import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { NewsItem } from "@/lib/news/feed";
import type { NewsGitHubHealth } from "@/lib/news/github";
import { NEWS_SOURCES, newsView, hasSource, type NewsSearchParams } from "@/lib/news/view";

const now = Date.parse("2026-10-05T07:00:00Z");
const items: NewsItem[] = [
  { id: "sheet:payment-1", source: "sheet", kind: "ZCG ledger", title: "ZcashMe — $4,000", url: "/zcg/grant?g=Zcash%20Name%20Service", ts: "2026-10-01T00:00:00Z" },
  { id: "sheet:payment-2", source: "sheet", kind: "ZCG ledger", title: "ZcashMe — $4,000", url: "/zcg/grant?g=Zcash%20Name%20Service", ts: "2026-10-01T00:00:00Z" },
  { id: "github:zebra", source: "github", kind: "zebra", title: "Zebra 7.0.0", url: "https://github.com/ZcashFoundation/zebra/releases/tag/v7", ts: "2026-10-02T00:00:00Z" },
  { id: "github:zaino", source: "github", kind: "zaino", title: "Zaino 0.10.1", url: "https://github.com/zingolabs/zaino/releases/tag/0.10.1", ts: "2026-10-04T00:00:00Z" },
  { id: "forum:1", source: "forum", kind: "Forum", title: "Zebra community discussion", author: "alice", url: "https://forum.zcashcommunity.com/t/1", ts: "2026-10-05T00:00:00Z" },
  { id: "proposal:1", source: "proposal", kind: "ZCG proposal", title: "Education proposal", url: "/zcg/proposals", ts: "2026-10-04T00:00:00Z" },
  { id: "proposal:2", source: "proposal", kind: "ZCG proposal", title: "Wallet proposal", url: "/zcg/proposals", ts: "2026-10-04T00:00:00Z" },
  { id: "application:1", source: "application", kind: "Grant application", title: "Wallet application", url: "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/1", ts: "2026-10-04T00:00:00Z" },
];

const github = vi.hoisted(() => ({ health: [] as NewsGitHubHealth[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/news/feed", async () => ({
  getNews: async () => items, nowMs: () => now, newsFetchedAt: () => now,
  githubNewsHealth: () => github.health, newsUnavailableSources: () => [],
  githubNewsBehind: (await vi.importActual<typeof import("@/lib/news/github")>("@/lib/news/github")).githubNewsBehind,
}));
vi.mock("@/components/source-refresh", () => ({ SourceRefresh: () => null }));
vi.mock("@/lib/calendar/source", () => ({
  getCalendarData: async () => ({
    events: [
      { id: "vote", category: "governance", title: "Dev Fund poll: vote", start: "2026-10-05", end: "2026-10-19", precision: "day", link: { label: "Forum", href: "https://forum.zcashcommunity.com/t/1" } },
      { id: "meeting", category: "zcg", title: "ZCG committee meeting", start: "2026-09-28", precision: "day", link: { label: "Minutes", href: "https://forum.zcashcommunity.com/t/2" } },
      { id: "halving", category: "network", title: "Next halving", start: "2028-11-24", precision: "month", estimated: true, link: { label: "Network", href: "/zcash-network" } },
    ],
    unavailable: ["Arborist Calls"],
  }),
}));
import NewsPage from "./page";

function rows(node: ReactNode): Array<{ key: string | null; title: string }> {
  if (Array.isArray(node)) return node.flatMap(rows);
  if (!isValidElement<{ children?: ReactNode; className?: string }>(node)) return [];
  if (node.props.className === "ws-news-row") return [{ key: node.key, title: renderToStaticMarkup(node) }];
  return rows(node.props.children);
}
async function page(params: NewsSearchParams = {}) { return NewsPage({ searchParams: Promise.resolve(params) }); }

describe("News filters and rendered record identity", () => {
  it("gives distinct payments and proposals unique stable keys even with identical links, titles and dates", async () => {
    const all = rows(await page());
    expect(all).toHaveLength(8);
    expect(new Set(all.map(row => row.key)).size).toBe(all.length);
    const sheet = rows(await page({ source: "sheet" }));
    expect(sheet.map(row => row.key)).toEqual(["sheet:payment-1", "sheet:payment-2"]);
    expect(rows(await page()).map(row => row.key)).toEqual(all.map(row => row.key));
  });

  it.each(NEWS_SOURCES)("keeps the %s tab, count and rendered list in agreement", async source => {
    const view = newsView(items, { source }, now);
    const tree = await page({ source });
    const html = renderToStaticMarkup(tree);
    expect(rows(tree).map(row => row.key)).toEqual(items.filter(item => hasSource(item, source)).map(item => item.id));
    expect(rows(tree)).toHaveLength(view.counts[source]);
    const sources = html.match(/<nav class="ws-news-sources"[\s\S]*?<\/nav>/)?.[0] ?? "";
    expect(sources.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0]).toContain(`href="/news?source=${source}"`);
    if (source === "dao") expect(html).toContain("No updates match this view");
  });

  it("combines case-insensitive trimmed search and source; all tab counts use that search", async () => {
    const view = newsView(items, { q: "  ZeBrA  ", source: "github" }, now);
    expect(view.shown.map(item => item.id)).toEqual(["github:zebra"]);
    expect(view.totalCount).toBe(2);
    expect(view.counts).toEqual({ forum: 1, github: 1, sheet: 0, proposal: 0, dao: 0 });
    const html = renderToStaticMarkup(await page({ q: "  ZeBrA  ", source: "github" }));
    expect(html).toContain('href="/news?source=forum&amp;q=ZeBrA"');
    expect(html).toContain('name="source" value="github"');
    expect(html).toContain('href="/news?source=github">Clear</a>');
    expect(rows(await page({ source: "github" }))).toHaveLength(2);
  });

  it("shows new counts only for the selected results", async () => {
    const html = renderToStaticMarkup(await page({ source: "github" }));
    expect(newsView(items, { source: "github" }, now).newCount).toBe(1);
    expect(html).toContain("1 new in 48 hours");
    expect(newsView(items, { source: "sheet" }, now).newCount).toBe(0);
  });

  it("searches author and kind and retains safe URL encoding when switching tabs", async () => {
    expect(newsView(items, { q: "alice" }, now).shown.map(item => item.id)).toEqual(["forum:1"]);
    expect(newsView(items, { q: "ZCG ledger" }, now).shown).toHaveLength(2);
    const html = renderToStaticMarkup(await page({ q: "a & b" }));
    expect(html).toContain('/news?source=github&amp;q=a%20%26%20b');
    expect(rows(await page({ q: "no results", source: "github" }))).toHaveLength(0);
  });

  it("says GitHub updates are incomplete only once a repository's retry has also failed", async () => {
    const zebra = (failures: number): NewsGitHubHealth => ({ repository: "ZcashFoundation/zebra", status: "cached", failures, fetchedAt: "2026-10-05T06:55:00.000Z", lastSuccessAt: "2026-10-05T05:55:00.000Z" });
    const zallet: NewsGitHubHealth = { repository: "zcash/zallet", status: "live", failures: 0, fetchedAt: "2026-10-05T06:55:00.000Z", lastSuccessAt: "2026-10-05T06:55:00.000Z" };
    try {
      github.health = [zebra(1), zallet];
      expect(renderToStaticMarkup(await page())).not.toContain("GitHub updates are incomplete");
      github.health = [zebra(2), zallet];
      expect(renderToStaticMarkup(await page())).toContain("GitHub updates are incomplete: 1 of 2 repositories");
      expect(renderToStaticMarkup(await page({ source: "sheet" }))).not.toContain("GitHub updates are incomplete");
    } finally { github.health = []; }
  });

  it("handles repeated URL parameters and resets unknown sources to All sources", async () => {
    expect(newsView(items, { source: ["github", "sheet"], q: ["zebra", "other"] }, now).shown.map(item => item.id)).toEqual(["github:zebra"]);
    const html = renderToStaticMarkup(await page({ source: "unknown", q: "   " }));
    const sources = html.match(/<nav class="ws-news-sources"[\s\S]*?<\/nav>/)?.[0] ?? "";
    expect(sources.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0]).toContain('href="/news"');
    expect(rows(await page({ source: "unknown" }))).toHaveLength(items.length);
  });
});

describe("News views", () => {
  const tabs = (html: string) => html.match(/<nav[^>]*aria-label="News views"[\s\S]*?<\/nav>/)?.[0] ?? "";

  it("opens on the feed, with a Calendar tab counting what is open or ahead", async () => {
    const html = renderToStaticMarkup(await page());
    expect(tabs(html).match(/<a[^>]*aria-current="page"[^>]*>/)?.[0]).toContain('href="/news"');
    expect(tabs(html)).toContain("<span>Feed</span><strong>8</strong>");
    expect(tabs(html)).toContain("<span>Calendar</span><strong>2</strong>");
    expect(tabs(html)).toContain("8 updates · 5 new in 48 hours");
    expect(html).not.toContain("Add the Zcash calendar to yours");
  });

  it("shows the calendar with subscription links, estimates and the past month", async () => {
    const html = renderToStaticMarkup(await page({ view: "calendar" }));
    expect(tabs(html).match(/<a[^>]*aria-current="page"[^>]*>/)?.[0]).toContain('href="/news?view=calendar"');
    expect(rows(await page({ view: "calendar" }))).toHaveLength(0);
    expect(html).toContain("Add the Zcash calendar to yours");
    expect(html).toContain('href="https://calendar.google.com/calendar/r?cid=webcal%3A%2F%2Fopenzcash.org%2Fapi%2Ffeeds%2Fcalendar.ics"');
    expect(html).toContain('href="webcal://openzcash.org/api/feeds/calendar.ics"');
    expect(html).toContain("Opens today");
    expect(html).toContain("≈ Nov 2028");
    expect(html).toContain("Past 30 days");
    expect(html).toContain("Temporarily unable to read Arborist Calls");
  });

  it("filters the calendar by category and keeps every count in the menu", async () => {
    const html = renderToStaticMarkup(await page({ view: "calendar", type: "network" }));
    const filters = html.match(/<nav[^>]*aria-label="Calendar categories"[\s\S]*?<\/nav>/)?.[0] ?? "";
    expect(filters.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0]).toContain('href="/news?view=calendar&amp;type=network"');
    expect(filters).toContain("<span>All</span><strong>2</strong>");
    expect(filters).toContain("<span>Governance</span><strong>1</strong>");
    expect(filters).toContain("<span>Network</span><strong>1</strong>");
    expect(html).toContain("Next halving");
    expect(html).not.toContain("Dev Fund poll: vote");
    expect(tabs(html)).toContain("<span>Calendar</span><strong>2</strong>");
    const unknown = renderToStaticMarkup(await page({ view: "calendar", type: "nope" }));
    expect(unknown).toContain("Dev Fund poll: vote");
  });
});
