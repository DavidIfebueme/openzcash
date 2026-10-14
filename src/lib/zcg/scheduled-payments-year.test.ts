import { describe, expect, it } from "vitest";
import { scheduledPayments, type ScheduleRow } from "./scheduled-payments";

const row = (
  id: string,
  estimatedPayoutDate: string | null,
  amountUsdCents: bigint | null,
  overrides: Partial<ScheduleRow> = {},
): ScheduleRow => ({
  id,
  project: id,
  sourceSheet: "coinholder_grants",
  grantStatus: "open",
  isPaid: false,
  isTest: false,
  isInternal: false,
  estimatedPayoutDate,
  amountUsdCents,
  category: "Infrastructure",
  ...overrides,
});

const ids = (rows: ScheduleRow[]) => rows.map((r) => r.id);

describe("schedule year and historical estimates", () => {
  it("separates prior years from current-year past estimates without restricting future years", () => {
    const s = scheduledPayments([
      row("2024", "2024-12-31", 101n),
      row("2025", "2025-12-31", 202n),
      row("year-start", "2026-01-01", 303n),
      row("year-end", "2026-12-31", 404n),
      row("2027", "2027-01-01", 505n),
    ], "2026-10-14");

    expect(s.scheduleYear).toBe("2026");
    expect(ids(s.currentYearPast.rows)).toEqual(["year-start"]);
    expect(s.currentYearPast.totalCents).toBe(303n);
    expect(s.currentYearPast.excludedAmounts).toBe(0);
    expect(ids(s.historicalPast.rows)).toEqual(["2025", "2024"]);
    expect(s.historicalPast.totalCents).toBe(303n);
    expect(s.historicalPast.excludedAmounts).toBe(0);
    expect(ids(s.rows)).toEqual(["year-end", "2027"]);
    expect(s.totalCents).toBe(909n);

    // The overview uses upcoming plus current-year past, not historical value.
    expect(s.totalCents + s.currentYearPast.totalCents).toBe(1212n);
    expect(s.rows.length + s.currentYearPast.rows.length - s.currentYearPast.excludedAmounts).toBe(3);
    expect(s.pastTotalCents).toBe(606n);
    expect(ids(s.pastRows)).toEqual(["year-start", "2025", "2024"]);
    expect(s.overdue).toBe(3);
    expect(s.currentYearPast.totalCents + s.historicalPast.totalCents).toBe(s.pastTotalCents);
  });

  it("moves the old calendar year to history on January 1 and preserves the new-year total when its estimate expires", () => {
    const rows = [
      row("old-past", "2026-01-01", 101n),
      row("last-day", "2026-12-31", 202n),
      row("first-day", "2027-01-01", 303n),
    ];
    const lastDay = scheduledPayments(rows, "2026-12-31");
    const newYear = scheduledPayments(rows, "2027-01-01");
    const nextDay = scheduledPayments(rows, "2027-01-02");

    expect(ids(lastDay.rows)).toEqual(["last-day", "first-day"]);
    expect(lastDay.totalCents + lastDay.currentYearPast.totalCents).toBe(606n);
    expect(newYear.scheduleYear).toBe("2027");
    expect(newYear.currentYearPast.rows).toEqual([]);
    expect(ids(newYear.historicalPast.rows)).toEqual(["last-day", "old-past"]);
    expect(newYear.historicalPast.totalCents).toBe(303n);
    expect(ids(newYear.rows)).toEqual(["first-day"]);
    expect(newYear.totalCents + newYear.currentYearPast.totalCents).toBe(303n);
    expect(nextDay.rows).toEqual([]);
    expect(ids(nextDay.currentYearPast.rows)).toEqual(["first-day"]);
    expect(nextDay.totalCents + nextDay.currentYearPast.totalCents).toBe(303n);
    expect(nextDay.historicalPast).toEqual(newYear.historicalPast);
  });

  it("applies category to both past groups while upcoming date filters leave both groups visible", () => {
    const s = scheduledPayments([
      row("current", "2026-01-01", 101n),
      row("historical", "2025-12-31", 202n),
      row("current-wallet", "2026-09-30", 404n, { category: "Wallets" }),
      row("historical-wallet", "2024-12-31", 505n, { category: "Wallets" }),
      row("historical-only-category", "2024-01-01", 606n, { category: "Security" }),
      row("included-future", "2026-11-15", 303n),
      row("outside-dates", "2026-12-01", 707n),
    ], "2026-10-14", { from: "2026-11-01", to: "2026-11-30", category: "Infrastructure" });

    expect(ids(s.rows)).toEqual(["included-future"]);
    expect(ids(s.currentYearPast.rows)).toEqual(["current"]);
    expect(ids(s.historicalPast.rows)).toEqual(["historical"]);
    expect(s.totalCents).toBe(303n);
    expect(s.currentYearPast.totalCents).toBe(101n);
    expect(s.historicalPast.totalCents).toBe(202n);
    expect(s.categories).toEqual(["Infrastructure", "Security", "Wallets"]);
    expect(s.currentYearPast.rows.length + s.historicalPast.rows.length).toBe(s.overdue);
  });

  it("keeps missing and nonpositive amounts reviewable while the overview count follows only positive current-year values", () => {
    const s = scheduledPayments([
      row("historical-positive", "2025-12-31", 9007199254740993n),
      row("historical-unknown", "2025-12-30", null),
      row("historical-zero", "2025-12-29", 0n),
      row("historical-negative", "2025-12-28", -100n),
      row("current-positive", "2026-10-13", 101n),
      row("current-unknown", "2026-10-12", null),
      row("current-zero", "2026-10-11", 0n),
      row("current-negative", "2026-10-10", -200n),
      row("future-positive", "2026-10-14", 202n),
    ], "2026-10-14");

    expect(s.historicalPast.rows).toHaveLength(4);
    expect(s.historicalPast.totalCents).toBe(9007199254740993n);
    expect(s.historicalPast.excludedAmounts).toBe(3);
    expect(s.currentYearPast.rows).toHaveLength(4);
    expect(s.currentYearPast.totalCents).toBe(101n);
    expect(s.currentYearPast.excludedAmounts).toBe(3);
    expect(s.totalCents + s.currentYearPast.totalCents).toBe(303n);
    expect(s.rows.length + s.currentYearPast.rows.length - s.currentYearPast.excludedAmounts).toBe(2);
    expect(s.pastExcludedAmounts).toBe(6);
    expect(s.currentYearPast.excludedAmounts + s.historicalPast.excludedAmounts).toBe(s.pastExcludedAmounts);
    expect(s.currentYearPast.totalCents + s.historicalPast.totalCents).toBe(s.pastTotalCents);
  });

  it.each(["cancelled", "keyholder_veto", "funds_returned", "rejected", "withdrawn"])(
    "excludes %s and recorded payments from both past groups without crossing funding programs",
    (grantStatus) => {
      const rows = [
        row("blocked-current", "2026-01-01", 101n, { project: "Blocked" }),
        row("blocked-history", "2025-12-31", 202n, { project: "Blocked" }),
        row("verdict", "2026-01-02", 303n, { project: "Blocked", grantStatus, isPaid: true }),
        row("other-program-current", "2026-01-01", 404n, { project: "Blocked", sourceSheet: "grants_disbursed" }),
        row("other-program-history", "2025-12-31", 505n, { project: "Blocked", sourceSheet: "grants_disbursed" }),
        row("paid-current", "2026-01-01", 606n, { isPaid: true }),
        row("paid-history", "2025-12-31", 707n, { isPaid: true }),
        row("test", "2025-12-31", 808n, { isTest: true }),
        row("internal", "2026-01-01", 909n, { isInternal: true }),
      ];
      const s = scheduledPayments(rows, "2026-10-14");

      expect(ids(s.currentYearPast.rows)).toEqual(["other-program-current"]);
      expect(s.currentYearPast.totalCents).toBe(404n);
      expect(ids(s.historicalPast.rows)).toEqual(["other-program-history"]);
      expect(s.historicalPast.totalCents).toBe(505n);
      expect(s.overdue).toBe(2);
    },
  );
});
