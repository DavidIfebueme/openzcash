import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/calendar/source", () => ({
  getCalendarData: async () => ({
    events: [
      { id: "old", category: "zcg", title: "Old meeting", start: "2024-01-08", precision: "day", link: { label: "Minutes", href: "https://forum.zcashcommunity.com/t/1" } },
      { id: "recent", category: "zcg", title: "ZCG committee meeting", start: "2026-11-09", precision: "day", link: { label: "Minutes", href: "https://forum.zcashcommunity.com/t/2" } },
      { id: "vote", category: "coinholder", title: "Coinholder Grants Q4 2026: vote", start: "2026-12-17", end: "2026-12-29", precision: "day", link: { label: "Round", href: "/coinholders" } },
    ],
    unavailable: [],
  }),
}));
import { GET } from "./route";

describe("GET /api/feeds/calendar.ics", () => {
  afterEach(() => vi.useRealTimers());

  it("serves a year of history and everything ahead as a subscribable calendar", async () => {
    vi.useFakeTimers({ now: Date.parse("2026-11-16T12:00:00Z") });
    const response = await GET();
    expect(response.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    const ics = await response.text();
    expect(ics).toContain("UID:recent@openzcash.org");
    expect(ics).toContain("UID:vote@openzcash.org");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261217\r\nDTEND;VALUE=DATE:20261230");
    expect(ics).toContain("URL:https://openzcash.org/coinholders");
    expect(ics).not.toContain("Old meeting");
  });
});
