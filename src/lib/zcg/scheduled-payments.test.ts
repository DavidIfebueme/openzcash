import { describe, expect, it } from "vitest";
import {
  scheduledPayments,
  validDay,
  type ScheduleRow,
} from "./scheduled-payments";
const row = (overrides: Partial<ScheduleRow> = {}): ScheduleRow => ({
  id: "a",
  project: "Project",
  sourceSheet: "grants_disbursed",
  grantStatus: "open",
  isPaid: false,
  isTest: false,
  isInternal: false,
  estimatedPayoutDate: "2026-10-01",
  amountUsdCents: 101n,
  category: "Infrastructure",
  ...overrides,
});
const today = "2026-09-17";
describe("scheduled payment accounting", () => {
  it("reconciles exact cents across categories and months without rounding", () => {
    const s = scheduledPayments(
      [
        row(),
        row({
          id: "b",
          amountUsdCents: 9007199254740993n,
          category: "Wallets",
          estimatedPayoutDate: "2026-11-01",
        }),
        row({ id: "c", amountUsdCents: 99n }),
      ],
      today,
    );
    expect(s.totalCents).toBe(9007199254741193n);
    expect(s.byCategory.reduce((a, r) => a + r.cents, 0n)).toBe(s.totalCents);
    expect(s.byMonth.reduce((a, r) => a + r.cents, 0n)).toBe(s.totalCents);
  });
  it.each([
    "cancelled",
    "keyholder_veto",
    "funds_returned",
    "rejected",
    "withdrawn",
  ])("excludes grants ended by the verdict %s", (grantStatus) => {
    expect(scheduledPayments([row({ grantStatus })], today).rows).toHaveLength(
      0,
    );
  });
  it.each(["open", "completed", "approved", "in_progress", "", null])(
    "keeps milestones of live grants whatever the row status (%s)",
    (grantStatus) => {
      expect(
        scheduledPayments([row({ grantStatus })], today).rows,
      ).toHaveLength(1);
    },
  );
  it("blocks all milestones when another row records cancellation", () => {
    expect(
      scheduledPayments(
        [row(), row({ id: "b", grantStatus: "cancelled", isPaid: true })],
        today,
      ).totalCents,
    ).toBe(0n);
  });
  it("does not infer payments from tests, internal transfers or other sheets", () => {
    const s = scheduledPayments(
      [
        row({ isPaid: true }),
        row({ isTest: true }),
        row({ isInternal: true }),
        row({ sourceSheet: "monthly" }),
      ],
      today,
    );
    expect(s.rows).toHaveLength(0);
  });
  it("includes today, separates past estimates and preserves unknown amounts", () => {
    const s = scheduledPayments(
      [
        row({ id: "today", estimatedPayoutDate: today }),
        row({ id: "past", estimatedPayoutDate: "2026-09-16" }),
        row({ id: "none", estimatedPayoutDate: null }),
        row({ id: "unknown", amountUsdCents: null }),
        row({ id: "clawback", amountUsdCents: -10n }),
      ],
      today,
    );
    expect(s.rows.map((r) => r.id)).toEqual(["today"]);
    expect(s).toMatchObject({
      totalCents: 101n,
      overdue: 1,
      undated: 1,
      unknownAmount: 1,
      nonpositive: 1,
    });
  });
  it("filters the same population for the table, total and both breakdowns", () => {
    const s = scheduledPayments(
      [
        row(),
        row({ id: "b", category: "Wallets" }),
        row({ id: "c", estimatedPayoutDate: "2026-11-01" }),
      ],
      today,
      { from: "2026-10-01", to: "2026-10-31", category: "Infrastructure" },
    );
    expect(s.rows.map((r) => r.id)).toEqual(["a"]);
    expect(s.totalCents).toBe(101n);
    expect(s.byMonth).toHaveLength(1);
  });
  it("rejects invalid dates and never reclassifies past estimates as future", () => {
    expect(validDay("2026-02-30")).toBe(false);
    expect(validDay("soon")).toBe(false);
    const s = scheduledPayments(
      [
        row({ estimatedPayoutDate: "2026-02-30" }),
        row({ estimatedPayoutDate: "2026-09-16" }),
      ],
      today,
      { from: "2026-01-01" },
    );
    expect(s.totalCents).toBe(0n);
    expect(s.undated).toBe(1);
    expect(s.overdue).toBe(1);
  });
});

describe("past estimates stay visible", () => {
  it.each(["grants_disbursed", "coinholder_grants"])("moves a %s entry after the estimate passes without losing or double counting it", (sourceSheet) => {
    const rows = [row({ sourceSheet, estimatedPayoutDate: "2026-10-13", amountUsdCents: 195000000n })];
    const before = scheduledPayments(rows, "2026-10-13");
    const after = scheduledPayments(rows, "2026-10-14");
    expect(before.rows).toHaveLength(1);
    expect(before.pastRows).toHaveLength(0);
    expect(before.totalCents).toBe(195000000n);
    expect(after.rows).toHaveLength(0);
    expect(after.totalCents).toBe(0n);
    expect(after.byMonth).toEqual([]);
    expect(after.byCategory).toEqual([]);
    expect(after.pastRows).toEqual(rows);
    expect(after.pastTotalCents).toBe(195000000n);
    expect(after.overdue).toBe(1);
  });
  it("removes a past entry once payment is recorded", () => {
    const s = scheduledPayments([row({ isPaid: true })], "2026-10-14");
    expect(s.pastRows).toEqual([]);
    expect(s.pastTotalCents).toBe(0n);
  });
  it("preserves unknown and nonpositive values without counting them in the past total", () => {
    const s = scheduledPayments([
      row({ id: "known", amountUsdCents: 9007199254740993n }),
      row({ id: "unknown", amountUsdCents: null }),
      row({ id: "zero", amountUsdCents: 0n }),
      row({ id: "negative", amountUsdCents: -100n }),
    ], "2026-10-14");
    expect(s.pastRows).toHaveLength(4);
    expect(s.pastTotalCents).toBe(9007199254740993n);
    expect(s.pastExcludedAmounts).toBe(3);
    expect(s.overdue).toBe(s.pastRows.length);
  });
  it("applies category to both lists but date filters only to upcoming entries", () => {
    const s = scheduledPayments([
      row({ id: "past-only", category: "Security" }),
      row({ id: "other-past" }),
      row({ id: "future", estimatedPayoutDate: "2026-11-01" }),
    ], "2026-10-14", { category: "Security", from: "2026-12-01", to: "2026-12-31" });
    expect(s.categories).toEqual(["Infrastructure", "Security"]);
    expect(s.rows).toHaveLength(0);
    expect(s.pastRows.map(r => r.id)).toEqual(["past-only"]);
    expect(s.pastTotalCents).toBe(101n);
    expect(s.overdue).toBe(1);
  });
  it.each(["cancelled", "keyholder_veto", "funds_returned", "rejected", "withdrawn"])("excludes %s across the entire grant but not another funding program", (grantStatus) => {
    const s = scheduledPayments([
      row({ id: "blocked-milestone" }),
      row({ id: "verdict", isPaid: true, grantStatus }),
      row({ id: "coinholder", sourceSheet: "coinholder_grants" }),
      row({ id: "test", project: "Test", isTest: true }),
      row({ id: "internal", project: "Internal", isInternal: true }),
      row({ id: "wrong-sheet", sourceSheet: "monthly" }),
    ], "2026-10-14");
    expect(s.pastRows.map(r => r.id)).toEqual(["coinholder"]);
  });
  it("lists newest past estimates first, excluding invalid and undated entries", () => {
    const s = scheduledPayments([
      row({ id: "old", estimatedPayoutDate: "2026-09-01" }),
      row({ id: "recent-b", estimatedPayoutDate: "2026-10-13" }),
      row({ id: "none", estimatedPayoutDate: null }),
      row({ id: "bad", estimatedPayoutDate: "2026-02-30" }),
      row({ id: "recent-a", estimatedPayoutDate: "2026-10-13" }),
    ], "2026-10-14");
    expect(s.pastRows.map(r => r.id)).toEqual(["recent-a", "recent-b", "old"]);
    expect(s.undated).toBe(2);
  });
});
