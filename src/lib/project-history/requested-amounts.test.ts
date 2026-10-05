import { describe, expect, it } from "vitest";
import reviewedData from "@/data/project-history/requested-amounts.json";
import { findReviewedRequestedAmount, requestedAmountsSchema, type ReviewedRequestedAmount } from "./requested-amounts";

const entry: ReviewedRequestedAmount = {
  id: "alpha-browser-request", projectId: "alpha-browser", program: "zcg", grantTitle: "Alpha Browser Maintenance",
  amountUsdCents: "1250000", basis: "fixed", summary: "The application requests USD 12,500 for the named scope.",
  sourceUrl: "https://example.org/applications/alpha", reviewedAt: "2026-10-04",
  reviewNote: "Read the original application and checked the requested total against its stated scope.",
};
const grant = { projectId: entry.projectId, program: entry.program, title: entry.grantTitle };
const parse = (entries: unknown[]) => requestedAmountsSchema.safeParse({ schemaVersion: 1, entries });

describe("reviewed requested-amount admission", () => {
  it("keeps fixed requests and caps distinct without rounding large cent strings", () => {
    const data = parse([entry, { ...entry, id: "alpha-cap", grantTitle: "Alpha Browser Renewal", basis: "cap", amountUsdCents: "900719925474099301" }]);
    expect(data.success).toBe(true);
    if (!data.success) return;
    expect(data.data.entries[1]).toMatchObject({ basis: "cap", amountUsdCents: "900719925474099301" });
  });
  it("rejects nonpositive, decimal and exponent values instead of coercing financial units", () => {
    for (const amountUsdCents of ["0", "-1", "1.25", "1e6", " 100", "00100", 100])
      expect(parse([{ ...entry, amountUsdCents }]).success).toBe(false);
  });
  it("requires a valid review date, review record and HTTPS source without credentials", () => {
    for (const patch of [{ reviewedAt: "2026-02-30" }, { reviewedAt: "2026-10-04T12:00:00Z" }, { reviewNote: "checked" },
      { sourceUrl: "http://example.org/grant" }, { sourceUrl: "https://alice:secret@example.org/grant" }, { sourceUrl: "javascript:alert(1)" }])
      expect(parse([{ ...entry, ...patch }]).success).toBe(false);
  });
  it("rejects duplicate IDs and duplicate scoped keys after case/whitespace normalization", () => {
    expect(parse([entry, { ...entry, grantTitle: "A different grant" }]).success).toBe(false);
    expect(parse([entry, { ...entry, id: "different-id", projectId: "ALPHA-BROWSER", grantTitle: "  ALPHA   Browser Maintenance  " }]).success).toBe(false);
    expect(parse([entry, { ...entry, id: "other-program", program: "coinholder" }]).success).toBe(true);
  });
});

describe("reviewed requested-amount matching", () => {
  it("accepts only case/whitespace changes to the complete scoped identity", () => {
    expect(findReviewedRequestedAmount({ ...grant, title: "  ALPHA   Browser\nMaintenance " }, "2026-10-04", [entry])).toEqual(entry);
    for (const different of [{ ...grant, projectId: "alpha-wallet" }, { ...grant, program: "coinholder" as const },
      { ...grant, title: "Alpha Browser Maintenance II" }, { ...grant, title: "Alpha Browser — Maintenance" }])
      expect(findReviewedRequestedAmount(different, "2026-10-04", [entry])).toBeNull();
  });
  it("does not use a future review, or invent an amount when no exact source exists", () => {
    expect(findReviewedRequestedAmount(grant, "2026-10-03", [entry])).toBeNull();
    expect(findReviewedRequestedAmount(grant, "2026-10-04", [])).toBeNull();
    expect(() => findReviewedRequestedAmount(grant, "2026-02-30", [entry])).toThrow();
  });
  it("fails closed for duplicate matches even if an unchecked caller bypasses the schema", () => {
    expect(findReviewedRequestedAmount(grant, "2026-10-04", [entry, { ...entry, id: "conflict", amountUsdCents: "999" }])).toBeNull();
  });
  it("returns the source and cap basis unchanged instead of treating a ceiling as a fixed request", () => {
    const cap = { ...entry, basis: "cap" as const };
    expect(findReviewedRequestedAmount(grant, "2026-10-04", [cap])).toEqual(cap);
  });
});


describe("checked-in WebZjs request evidence", () => {
  it("admits only sourced scoped requests and preserves both maintenance caps", () => {
    const data = requestedAmountsSchema.parse(reviewedData);
    expect(data.entries).toHaveLength(3);
    expect(data.entries.every(item => item.projectId === "webzjs" && item.program === "zcg")).toBe(true);
    expect(data.entries.filter(item => item.basis === "cap").map(item => item.amountUsdCents)).toEqual(["16800000", "16800000"]);
    expect(findReviewedRequestedAmount({ projectId: "webzjs", program: "zcg", title: "WebZjs - ZCash Browser Wallet Library" }, "2026-10-04", data.entries))
      .toMatchObject({ basis: "fixed", amountUsdCents: "15000000" });
  });
});
