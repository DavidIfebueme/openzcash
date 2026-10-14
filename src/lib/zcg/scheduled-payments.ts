/** Pure accounting model. Amounts remain integer cents throughout. */
export type ScheduleRow = {
  id: string;
  project: string | null;
  sourceSheet: string;
  grantStatus: string | null;
  isPaid: boolean;
  isTest: boolean;
  isInternal: boolean;
  estimatedPayoutDate: string | null;
  amountUsdCents: bigint | null;
  category: string | null;
};
export function validDay(value: string | undefined | null): value is string {
  return (
    !!value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
/**
 * Verdicts that end a grant. The spreadsheet's grant status is free-form
 * (today: open, completed, cancelled, keyholder_veto), so eligibility is
 * decided by exclusion, exactly like the grants summary ("committed" is every
 * non-cancelled milestone): a milestone counts unless its own row, or any row
 * of the same grant, carries one of these statuses. An empty or unfamiliar
 * status never silently removes a payment from the schedule.
 */
const BLOCKED = new Set([
  "cancelled",
  "keyholder_veto",
  "funds_returned",
  "rejected",
  "withdrawn",
]);
export function scheduledPayments<T extends ScheduleRow>(
  rows: T[],
  today: string,
  filters: { from?: string; to?: string; category?: string } = {},
) {
  if (!validDay(today)) throw new Error("A valid comparison date is required");
  const blocked = new Set(
    rows
      .filter((r) => BLOCKED.has(r.grantStatus ?? ""))
      .map((r) => `${r.sourceSheet}:${r.project}`),
  );
  const eligible = rows.filter(
    (r) =>
      ["grants_disbursed", "coinholder_grants"].includes(r.sourceSheet) &&
      r.project &&
      !r.isPaid &&
      !r.isTest &&
      !r.isInternal &&
      !blocked.has(`${r.sourceSheet}:${r.project}`),
  );
  const dated = eligible.filter((r) => validDay(r.estimatedPayoutDate));
  const future = dated.filter((r) => r.estimatedPayoutDate! >= today);
  // Past estimates remain reviewable until payment is recorded. Date filters
  // belong to the future schedule; the category filter applies to both lists.
  const pastRows = dated
    .filter((r) => r.estimatedPayoutDate! < today &&
      (!filters.category || r.category === filters.category))
    .sort((a, b) =>
      b.estimatedPayoutDate!.localeCompare(a.estimatedPayoutDate!) ||
      a.id.localeCompare(b.id));
  const pastValuedRows = pastRows.filter(
    (r) => r.amountUsdCents != null && r.amountUsdCents > 0n,
  );
  const from =
    validDay(filters.from) && filters.from > today ? filters.from : today;
  const to = validDay(filters.to) ? filters.to : undefined;
  const selected = future.filter(
    (r) =>
      r.estimatedPayoutDate! >= from &&
      (!to || r.estimatedPayoutDate! <= to) &&
      (!filters.category || r.category === filters.category),
  );
  const included = selected
    .filter((r) => r.amountUsdCents != null && r.amountUsdCents > 0n)
    .sort(
      (a, b) =>
        a.estimatedPayoutDate!.localeCompare(b.estimatedPayoutDate!) ||
        a.id.localeCompare(b.id),
    );
  function groupBy(key: (r: T) => string) {
    const result = new Map<
      string,
      { label: string; cents: bigint; count: number }
    >();
    for (const r of included) {
      const label = key(r);
      const group = result.get(label) ?? { label, cents: 0n, count: 0 };
      group.cents += r.amountUsdCents!;
      group.count++;
      result.set(label, group);
    }
    return [...result.values()].sort((a, b) => a.label.localeCompare(b.label));
  }
  return {
    rows: included,
    totalCents: included.reduce((sum, r) => sum + r.amountUsdCents!, 0n),
    byCategory: groupBy((r) => r.category || "Uncategorized"),
    byMonth: groupBy((r) => r.estimatedPayoutDate!.slice(0, 7)),
    overdue: pastRows.length,
    pastRows,
    pastTotalCents: pastValuedRows.reduce((sum, r) => sum + r.amountUsdCents!, 0n),
    pastExcludedAmounts: pastRows.length - pastValuedRows.length,
    undated: eligible.length - dated.length,
    unknownAmount: selected.filter((r) => r.amountUsdCents == null).length,
    nonpositive: selected.filter(
      (r) => r.amountUsdCents != null && r.amountUsdCents <= 0n,
    ).length,
    from,
    to,
    categories: [
      ...new Set(dated.map((r) => r.category).filter((c): c is string => !!c)),
    ].sort(),
  };
}
