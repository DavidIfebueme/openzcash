import { formatUsdCents } from "@/lib/zcg/format";
import type { NewsItem } from "./feed";

/**
 * Spreadsheet payments as news. The sheet's "Paid Out" column says when money
 * moved, not when the row was written: ZCG often records a payment days or
 * weeks later. Dating the item by the paid-out date alone made those rows
 * arrive already outside the seven-day feed, while the changelog (and its RSS
 * feed) announced them on the day they were recorded. Each payment is dated
 * here by that record when one exists, and never earlier than its paid-out
 * date; the title keeps the paid-out date visible.
 */

/** A paid ledger row, as the feed reads it from the disbursement mirror. */
export type PaidLedgerRow = {
  id: string;
  recipient: string | null;
  project: string | null;
  usd: bigint | null;
  /** ISO day from the sheet's "Paid Out" column. */
  paid: string | null;
  isTest: boolean;
};

/** A changelog "payment" entry: N new paid rows seen under one ledger name. */
export type RecordedPayment = {
  title: string;
  detail: string | null;
  at: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How long after its paid-out date a record may still surface a payment. Late
 * bookkeeping runs to a few weeks; anything older is an edit to a historical
 * row, which is not news.
 */
export const LATE_RECORD_MAX_MS = 60 * DAY_MS;

const paidDay = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const paidTime = (paid: string): number => Date.parse(`${paid}T00:00:00Z`);

/** The name recordChangelog files a payment under. */
const ledgerName = (row: PaidLedgerRow): string =>
  row.project || row.recipient || "Unlabelled";

/** "2 payments · $24,832" → 2. One when the count is not stated. */
function recordedCount(detail: string | null): number {
  const count = Number(/^(\d+) payment/.exec(detail ?? "")?.[1] ?? 1);
  return Number.isSafeInteger(count) && count > 0 ? count : 1;
}

/**
 * When each row was recorded, by row id. Records are applied oldest first and
 * each claims the most recently paid rows it can account for, so a monthly
 * grant's milestones pair with their own records and one record never lifts
 * more rows than it counted.
 *
 * The changelog names a project and a count, not the rows themselves, so this
 * is an attribution, not a lookup: if an earlier payment of the same project
 * was never recorded, a later record can claim it instead of the row it was
 * written for. Unclaimed rows keep their paid-out date.
 */
function recordedTimes(
  rows: readonly PaidLedgerRow[],
  recorded: readonly RecordedPayment[],
): Map<string, number> {
  const times = new Map<string, number>();
  const records = recorded
    .filter((entry) => Number.isFinite(entry.at?.getTime()))
    .toSorted((a, b) => a.at.getTime() - b.at.getTime());
  for (const entry of records) {
    const at = entry.at.getTime();
    const claimed = rows
      .filter(
        (row) =>
          !row.isTest && !times.has(row.id) && ledgerName(row) === entry.title,
      )
      .flatMap((row) =>
        row.paid ? [{ id: row.id, paid: paidTime(row.paid) }] : [],
      )
      .filter((row) => row.paid <= at && at - row.paid <= LATE_RECORD_MAX_MS)
      .toSorted((a, b) => b.paid - a.paid)
      .slice(0, recordedCount(entry.detail));
    for (const row of claimed) times.set(row.id, at);
  }
  return times;
}

/** One news item per paid row, in the order the rows were given. */
export function sheetNewsItems(
  rows: readonly PaidLedgerRow[],
  recorded: readonly RecordedPayment[],
): NewsItem[] {
  const times = recordedTimes(rows, recorded);
  return rows.flatMap((row) => {
    if (!row.paid) return [];
    const paid = paidTime(row.paid);
    if (!Number.isFinite(paid)) return [];
    const amount = formatUsdCents(row.usd ?? 0n);
    return [
      {
        id: `sheet:${row.id}`,
        source: "sheet" as const,
        kind: "ZCG ledger",
        title: `${row.recipient ?? "Grant"} — ${amount} · paid ${paidDay.format(paid)}`,
        url: row.project
          ? `/zcg/grant?g=${encodeURIComponent(row.project)}`
          : "/zcg/disbursements",
        ts: new Date(times.get(row.id) ?? paid).toISOString(),
      },
    ];
  });
}
