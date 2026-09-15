import { describe, expect, it } from "vitest";
import { initialProposalVerdict, observePublication, publicationDay, proposalPublicationKey, publishedValue } from "./publication-policy";

const before = new Date("2026-09-15T02:59:59Z"); // Sep 14 in Brasilia
const after = new Date("2026-09-15T03:00:00Z");
const review = { status: "under_review" };
const rejected = { status: "rejected" };

describe("D-1 publication", () => {
  it("uses the Brasilia calendar boundary, including month and year changes", () => {
    expect(publicationDay(before)).toBe("2026-09-14");
    expect(publicationDay(after)).toBe("2026-09-15");
    expect(publicationDay(new Date("2027-01-01T02:59:59Z"))).toBe("2026-12-31");
  });

  it("retains the previous status until the next day without requiring another import", () => {
    const state = observePublication(undefined, rejected, review, before);
    expect(publishedValue(state, before)).toEqual(review);
    expect(publishedValue(state, after)).toEqual(rejected);
  });

  it("does not restart the observation clock after reimports or JSONB key reordering", () => {
    const state = observePublication(undefined, { status: "rejected", date: null }, null, before);
    const repeat = observePublication(state, { date: null, status: "rejected" }, null, after);
    expect(repeat).toBe(state);
    expect(publishedValue(repeat, after)?.status).toBe("rejected");
  });

  it("publishes only the latest same-day correction", () => {
    const pending = observePublication(undefined, rejected, review, before);
    const corrected = observePublication(pending, review, null, before);
    expect(publishedValue(corrected, before)).toEqual(review);
    expect(publishedValue(corrected, after)).toEqual(review);
  });

  it("carries yesterday's published verdict into a new pending transition", () => {
    const pending = observePublication(undefined, rejected, review, before);
    const corrected = observePublication(pending, review, null, after);
    expect(publishedValue(corrected, after)).toEqual(rejected);
    expect(publishedValue(corrected, new Date("2026-09-16T03:00:00Z"))).toEqual(review);
  });

  it("defers a closed/deleted application, including after serializing a restart", () => {
    const state = observePublication(undefined, null, review, before);
    const restored = { ...JSON.parse(JSON.stringify(state)), observedAt: new Date(state.observedAt) };
    expect(publishedValue(restored, before)).toEqual(review);
    expect(publishedValue(restored, after)).toBeNull();
  });

  it("does not expose decision dates for a newly observed decided proposal", () => {
    expect(initialProposalVerdict({ status: "rejected", decisionDate: "2026-09-14" }))
      .toEqual({ status: "pending", statusRaw: "Pending", decisionDate: null, decisionTurnaroundDays: null });
  });

  it("keeps issue identity across sheet row moves, title edits, and comment fragments", () => {
    const p = { id: "old", program: "zcg", titleKey: "old-title",
      platformLink: "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/408#issuecomment-1" };
    expect(proposalPublicationKey(p)).toBe(proposalPublicationKey({ ...p, id: "new", titleKey: "new-title",
      platformLink: p.platformLink.split("#")[0] }));
    expect(proposalPublicationKey(p)).not.toBe(proposalPublicationKey({ ...p, program: "coinholder" }));
  });
});
