import { SectionHeading } from "@/components/workspace";
import Link from "next/link";
import { PageHeader, Stat } from "@/components/ui";
import { PaymentTable } from "./payment-table";
import styles from "./schedule.module.css";
import { getPaymentSchedule } from "@/lib/zcg/schedule-repo";
import { formatUsdCents } from "@/lib/zcg/format";
import { Synced } from "@/components/synced";
import { pageMetadata } from "@/lib/seo/page-metadata";
export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Scheduled payments · OpenZcash",
  description:
    "Upcoming and past estimates, with payment status from the imported ledger.",
  path: "/zcg/schedule",
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-10" → "Oct 2026". */
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}
/** "2026-10" → "2026-10-31", the month's last day. */
function monthEnd(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ym}-${String(last).padStart(2, "0")}`;
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; category?: string }>;
}) {
  const params = await searchParams;
  const s = await getPaymentSchedule(params);
  const past = s.currentYearPast;
  const history = s.historicalPast;
  return (
    <>
      <PageHeader
        title="Scheduled payments"
        subtitle="Upcoming and past estimates, with payment status from the imported ledger."
      />
      <Synced className="mb-6" />
      <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Upcoming value"
          value={
            <span className="ws-exact-amount">
              {formatUsdCents(s.totalCents)}
            </span>
          }
          sub="future estimates only"
        />
        <Stat
          label="Upcoming entries"
          value={String(s.rows.length)}
          sub="payment not recorded"
        />
        <Stat
          label="Without a date"
          value={String(s.undated)}
          sub="all categories · no estimated date"
        />
        <Stat
          label={`Past estimates · ${s.scheduleYear}`}
          value={<span className="ws-exact-amount">{formatUsdCents(past.totalCents)}</span>}
          sub={<a href="#past-estimates" className="underline underline-offset-4">{past.rows.length} {past.rows.length === 1 ? "entry" : "entries"} · View records ↓</a>}
        />
      </section>
      <nav className={styles.jumpLinks} aria-label="Payment schedule sections">
        <a href="#upcoming-payments">Upcoming <span>{s.rows.length}</span></a>
        <a href="#past-estimates">Past estimates · {s.scheduleYear} <span>{past.rows.length}</span></a>
        <a href="#historical-estimates">History <span>{history.rows.length}</span></a>
      </nav>
      <p className="mb-3 text-xs text-stone-600" id="schedule-filter-help">
        Dates filter upcoming payments. Category applies to all lists.
      </p>
      <form
        aria-describedby="schedule-filter-help"
        key={JSON.stringify([s.from, s.to, params.category ?? ""])}
        className="ws-filter-panel"
        method="get"
      >
        <label className="text-xs text-stone-600">
          Upcoming from
          <input
            className="mt-2 block rounded-lg border bg-white px-3 py-2"
            type="date"
            name="from"
            defaultValue={s.from}
          />
        </label>
        <label className="text-xs text-stone-600">
          Upcoming to
          <input
            className="mt-2 block rounded-lg border bg-white px-3 py-2"
            type="date"
            name="to"
            defaultValue={s.to ?? ""}
          />
        </label>
        <label className="text-xs text-stone-600">
          Category
          <select
            className="mt-2 block rounded-lg border bg-white px-3 py-2"
            name="category"
            defaultValue={params.category ?? ""}
          >
            <option value="">All categories</option>
            {s.categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <button className="rounded-lg bg-amber-700 px-5 py-2.5 text-xs font-medium text-white">
          Apply filters
        </button>
        <Link href="/zcg/schedule" className="py-3 text-xs text-stone-600">
          Reset
        </Link>
      </form>
      {s.byMonth.length ? (
        <nav className="ws-month-strip" aria-label="Scheduled value by month">
          {s.byMonth.map((g) => {
            const from = `${g.label}-01`;
            const to = monthEnd(g.label);
            const category = params.category
              ? `&category=${encodeURIComponent(params.category)}`
              : "";
            return (
              <Link
                key={g.label}
                href={`/zcg/schedule?from=${from}&to=${to}${category}`}
                aria-current={s.from === from && s.to === to ? "page" : undefined}
              >
                <span>{monthLabel(g.label)}</span>
                <strong className="tnum">
                  {formatUsdCents(g.cents, { compact: true })}
                </strong>
                <small>
                  {g.count} {g.count === 1 ? "payment" : "payments"}
                </small>
              </Link>
            );
          })}
        </nav>
      ) : null}
      <section id="upcoming-payments" className={styles.section} aria-label="Upcoming payments">
        <SectionHeading
          title="Upcoming payments"
          count={s.rows.length}
          description="Estimated dates and budgeted USD for each milestone."
        />
        <PaymentTable rows={s.rows} label="Upcoming payments" empty="No upcoming payments match these filters." />
      </section>
      <section id="past-estimates" className={styles.section} aria-label="Past estimates">
        <SectionHeading
          title={`Past estimates · ${s.scheduleYear}`}
          count={past.rows.length}
          description={`Estimates from ${s.scheduleYear} whose date has passed; payment is not recorded in the imported ledger.`}
          action={<div className={styles.pastTotal}><span>Budgeted USD</span><strong>{formatUsdCents(past.totalCents)}</strong></div>}
        />
        <p className={styles.explanation}>These records stay visible for follow-up. An estimate is not a payment deadline or confirmation of nonpayment.</p>
        <PaymentTable rows={past.rows} label="Past estimates" empty={`No past estimates from ${s.scheduleYear} match this category.`} />
        {past.excludedAmounts > 0 && <p className="mt-3 text-xs text-stone-600">{past.excludedAmounts} entries with missing or non-positive amounts are shown but excluded from this total.</p>}
      </section>
      <section id="historical-estimates" className={styles.section} aria-label="Historical estimates">
        <SectionHeading
          title={`History · Before ${s.scheduleYear}`}
          count={history.rows.length}
          description="Earlier estimates with no payment recorded. Excluded from the overview total."
          action={<div className={styles.pastTotal}><span>Historical budgeted USD</span><strong>{formatUsdCents(history.totalCents)}</strong></div>}
        />
        <PaymentTable rows={history.rows} label="Historical estimates" empty="No earlier estimates match this category." />
        {history.excludedAmounts > 0 && <p className="mt-3 text-xs text-stone-600">{history.excludedAmounts} entries with missing or non-positive amounts are shown but excluded from this historical total.</p>}
      </section>
      <p className="mt-5 text-xs leading-relaxed text-stone-600">
        Dates are estimates, not payment confirmations. Cancelled, vetoed,
        returned, test and internal entries are excluded. {s.unknownAmount}{" "}
        dated entries have an unknown amount; {s.nonpositive} have a
        non-positive amount. Neither is counted as a future payment. Undated estimates remain available in each grant’s original milestone
        table. The overview combines upcoming estimates with current-year past estimates ({s.scheduleYear}); earlier years remain in history. Year and day boundaries: Brasília time. Amount rules:{" "}
        <Link
          href="/zcg/methodology"
          className="text-amber-700 hover:underline"
        >
          methodology
        </Link>
        .
      </p>
    </>
  );
}
