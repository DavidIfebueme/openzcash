import { describe, expect, it } from "vitest";
import { publishedChangelog } from "./published-changelog";

const change = (id: string, fromVal: string, toVal: string, at: string, entityKey = "zcg|408") => ({
  id, kind: "proposal_status", fromVal, toVal, at: new Date(at), entityKey,
});
const now = new Date("2026-09-15T03:00:00Z");

describe("published ZCG changelog", () => {
  it("holds today's proposals and payments while leaving the ZecHub stream independent", () => {
    const base = change("today", "under_review", "rejected", now.toISOString());
    expect(publishedChangelog([
      base, { ...base, id: "new", kind: "proposal_new" },
      { ...base, id: "paid", kind: "payment" },
      { ...base, id: "zechub", kind: "zechub_payment" },
    ], now).map((e) => e.id)).toEqual(["zechub"]);
  });

  it("releases yesterday's entry at midnight Brasilia with its stable GUID", () => {
    const e = change("id", "under_review", "rejected", "2026-09-15T02:59:59Z");
    expect(publishedChangelog([e], e.at)).toEqual([]);
    expect(publishedChangelog([e], now)).toEqual([e]);
  });

  it("collapses corrections to the final verdict and omits a reverted decision", () => {
    const a = change("first", "under_review", "rejected", "2026-09-14T12:00:00Z");
    const b = change("second", "rejected", "approved", "2026-09-14T13:00:00Z");
    expect(publishedChangelog([b, a], now)).toEqual([{ ...a, toVal: "approved", at: b.at }]);
    expect(publishedChangelog([a, { ...b, toVal: "under_review" }], now)).toEqual([]);
  });

  it("does not merge resubmissions, different programs, or separate days", () => {
    const a = change("a", "under_review", "approved", "2026-09-13T12:00:00Z");
    const b = change("b", "approved", "rejected", "2026-09-14T13:00:00Z");
    const c = { ...b, id: "c", entityKey: "coinholder|408" };
    expect(publishedChangelog([a, b, c], now)).toHaveLength(3);
  });
});
