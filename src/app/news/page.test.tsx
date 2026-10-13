import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { NewsItem } from "@/lib/news/feed";
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

vi.mock("@/lib/news/feed", () => ({
  getNews: async () => items, nowMs: () => now, newsFetchedAt: () => now,
  githubNewsHealth: () => [], newsUnavailableSources: () => [],
}));
vi.mock("@/components/source-refresh", () => ({ SourceRefresh: () => null }));
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
    expect(html.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0]).toContain(`href="/news?source=${source}"`);
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

  it("handles repeated URL parameters and resets unknown sources to All sources", async () => {
    expect(newsView(items, { source: ["github", "sheet"], q: ["zebra", "other"] }, now).shown.map(item => item.id)).toEqual(["github:zebra"]);
    const html = renderToStaticMarkup(await page({ source: "unknown", q: "   " }));
    expect(html.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0]).toContain('href="/news"');
    expect(rows(await page({ source: "unknown" }))).toHaveLength(items.length);
  });
});
