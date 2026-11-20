import { describe, expect, it } from "vitest";
import { backOf } from "@/lib/design-routes";
import { filterLegalItems, legalItemDate } from "./presentation";
import { brazilReports, forumReadings, readingPath, withLegalReadings } from "./readings";

const feed = withLegalReadings({ items: [], sources: [], fetchedAt: null, pgpStatus: "unavailable", pgpLastSuccessAt: null });

describe("legal reading copies", () => {
  it("lists a single report across editions with a received date and intersecting filters", () => {
    const [report] = filterLegalItems(feed.items, { sourceId: "brazil-reports", region: "latam", topic: "Regulation", q: "Brasil" });
    expect(report.reader).toBe(readingPath(brazilReports[0].item));
    expect(legalItemDate(report)).toMatch(/^Received /);
    expect(backOf(report.reader!)).toEqual({ href: "/legal", label: "Updates" });
    expect(filterLegalItems(feed.items, { sourceId: "brazil-reports", region: "europe" })).toHaveLength(0);
  });
  it("keeps a separately addressable source post for each forum reading", () => {
    const urls = forumReadings.map(({ item, source }) => {
      expect(source.username).toBe("divijpandya");
      expect(item.publishedAt).toBe(source.posted.slice(0, 10));
      expect(item.url).toMatch(/^https:\/\/forum\.zcashcommunity\.com\/t\/.+\/\d+\/\d+$/);
      expect(source.markdown.trim().length).toBeGreaterThan(0);
      return item.url;
    });
    expect(new Set(urls).size).toBe(urls.length);
  });
});
