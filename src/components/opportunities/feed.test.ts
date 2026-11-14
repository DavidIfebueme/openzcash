import { describe, expect, it, vi } from "vitest";
import { loadBounties, normalizeBounty } from "./feed";
const now = Date.parse("2026-11-03T12:00:00Z"), checked = new Date(now).toISOString();
const bounty = { id: "public-id", title: "Build a privacy guide", description: "Write a practical guide with examples.", chain: "MAIN", status: "TO_DO", isPrivate: false, isApproved: true, bountyAmount: 0.025, timeToComplete: "2026-11-15T00:00:00Z", assignee: null, assignees: [], suggestionReviewStatus: null };
describe("public opportunity import", () => {
  it("projects only discovery fields and never sends identities or payment details to the browser", () => {
    const result = normalizeBounty({ ...bounty, team: { name: "Team" }, createdByUser: { email: "private@example.com", address: "u1private" }, paymentBatchId: "private", secret: "private" }, checked, now)!;
    expect(result.title).toBe(bounty.title);
    expect(result.rewardZec).toBe(0.025);
    expect(result.organizer).toBe("Team");
    expect(result.actionUrl).toBe("https://bounties.zechub.wiki/bounty/public-id");
    expect(JSON.stringify(result)).not.toMatch(/private|createdByUser|paymentBatchId/);
    expect(result.language).toBeUndefined(); expect(result.country).toBeUndefined();
  });
  it.each([{ isPrivate: true }, { isPrivate: undefined }, { isApproved: false }, { chain: "TEST" }, { status: "DONE" }, { status: "CANCELLED" }, { status: "IN_REVIEW" }, { assignee: "someone" }, { assignees: [{ userId: "someone" }] }, { suggestionReviewStatus: "APPROVED" }, { timeToComplete: "2026-11-03T12:00:00Z" }, { timeToComplete: "invalid" }, { bountyAmount: -1 }, { bountyAmount: "" }, { bountyAmount: Infinity }, { id: "../admin" }])("excludes non-public, unavailable or malformed records: %j", (change) => {
    expect(normalizeBounty({ ...bounty, ...change }, checked, now)).toBeNull();
  });
  it("preserves explicit locale fields without assigning a country from language", () => {
    const p = normalizeBounty({ ...bounty, language: "pt" }, checked, now)!;
    expect(p.language).toBe("pt"); expect(p.country).toBeUndefined();
  });
  it("paginates, deduplicates and keeps valid records when a later page fails", async () => {
    const fetch = vi.fn(async (url: string) => {
      const page = Number(new URL(url).searchParams.get("page"));
      if (page === 3) throw new Error("offline");
      return { data: [{ ...bounty, id: page === 1 ? "first" : "second" }, { ...bounty, id: "shared" }], total: 110, limit: 50, page };
    });
    const result = await loadBounties(fetch, now);
    expect(result.source.status).toBe("partial");
    expect(result.items.map((x) => x.id).sort()).toEqual(["zec-first", "zec-second", "zec-shared"]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("treats login HTML / invalid payload / failed reads as unavailable, never an empty successful sync", async () => {
    for (const body of ["<html>login</html>", {}, { data: [], total: "bad" }]) {
      const result = await loadBounties(async () => body, now);
      expect(result.source.status).toBe("unavailable"); expect(result.items).toEqual([]);
    }
    expect((await loadBounties(async () => { throw new Error("down"); }, now)).source.status).toBe("unavailable");
  });
});
