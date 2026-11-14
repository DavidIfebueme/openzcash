import { beforeEach, describe, expect, it, vi } from "vitest";

const { pollFindManyMock } = vi.hoisted(() => ({
  pollFindManyMock: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    poll: {
      findMany: pollFindManyMock
    }
  }
}));

import {
  buildAtomFeed,
  buildRssFeed,
  readPublicNotificationFeedItems
} from "@/lib/services/public-notification-feed";

beforeEach(() => {
  pollFindManyMock.mockReset();
  process.env.APP_BASE_URL = "https://vote.example.com";
});

describe("public notification feed", () => {
  it("links community events to the public proposal and never calls an elapsed vote open", async () => {
    pollFindManyMock.mockResolvedValue([{ id: "poll-a", communityId: "alpha", question: "Review a community decision", status: "CLOSED",
      opensAt: new Date("2020-01-01"), closesAt: new Date("2020-01-02"), updatedAt: new Date("2020-01-02"),
      tally: null, _count: { eligibility: 2, voterAccesses: 0 } }]);
    const items = await readPublicNotificationFeedItems();
    expect(items).toHaveLength(2);
    expect(items.every(item => item.url === "https://vote.example.com/communities/alpha/proposals/poll-a")).toBe(true);
    expect(items.find(item => item.id.startsWith("poll-closed:"))?.summary).toContain("No final result");
    expect(items.some(item => item.summary.includes("is open"))).toBe(false);
    expect(buildRssFeed(items)).toContain("Z Voice voting notifications");
  });
  it("handles an elapsed OPEN record without linking to an unavailable public detail", async () => {
    pollFindManyMock.mockResolvedValue([{ id: "poll-a", communityId: "alpha", question: "Review a community decision", status: "OPEN",
      opensAt: new Date("2020-01-01"), closesAt: new Date("2020-01-02"), updatedAt: new Date("2020-01-02"),
      tally: null, _count: { eligibility: 2, voterAccesses: 0 } }]);
    const items = await readPublicNotificationFeedItems();
    expect(items.every(item => item.url === "https://vote.example.com/polls")).toBe(true);
    expect(items.find(item => item.id.startsWith("poll-closed:"))?.summary).toContain("No final result");
    expect(items.some(item => item.summary.includes("is open"))).toBe(false);
  });
  it("publishes opened, closed, and aggregate result items without voter data", async () => {
    pollFindManyMock.mockResolvedValue([
      {
        id: "poll_1",
        question: "Should the treasury fund the next rollout?",
        status: "FINALIZED",
        opensAt: new Date("2026-05-01T10:00:00.000Z"),
        closesAt: new Date("2026-05-03T10:00:00.000Z"),
        updatedAt: new Date("2026-05-03T10:05:00.000Z"),
        voteModel: "SINGLE_CHOICE",
        quorumPercent: 40,
        passingThresholdPercent: 67,
        tally: {
          countA: 8,
          totalConfirmed: 15,
          updatedAt: new Date("2026-05-03T10:04:00.000Z")
        },
        _count: {
          eligibility: 0,
          voterAccesses: 18
        }
      }
    ]);

    const items = await readPublicNotificationFeedItems();
    const atom = buildAtomFeed(items);
    const rss = buildRssFeed(items);

    expect(items.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "poll-opened:poll_1",
        "poll-closed:poll_1",
        expect.stringMatching(/^result-published:poll_1:/)
      ])
    );
    expect(atom).toContain("Result published");
    expect(atom).toContain("Decision: Rejected.");
    expect(atom).toContain("Turnout 83% (15/18 voted).");
    expect(rss).toContain("https://vote.example.com/polls");
    expect(`${atom}\n${rss}`).not.toMatch(/voter@example|alice@example|signalUsername/i);
  });

  it.each(["CLOSED", "ARCHIVED"])("does not publish a final result solely because a poll is %s", async (status) => {
    pollFindManyMock.mockResolvedValue([{ id: "pending_poll", question: "Membership change", status,
      opensAt: new Date("2026-01-01"), closesAt: new Date("2026-01-02"), updatedAt: new Date("2026-01-02"),
      tally: { countA: 12, totalConfirmed: 12 }, _count: { eligibility: 12, voterAccesses: 0 } }]);
    const items = await readPublicNotificationFeedItems();
    expect(items.some(item => item.id.startsWith("result-published:"))).toBe(false);
    expect(items.find(item => item.id.startsWith("poll-closed:"))?.summary).toContain("No final result");
  });
});
