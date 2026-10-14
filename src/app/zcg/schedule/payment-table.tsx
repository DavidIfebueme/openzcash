import Link from "next/link";
import { SourceRecordLink } from "@/components/source-record-link";
import { formatUsdCents } from "@/lib/zcg/format";
import type { ScheduleRow } from "@/lib/zcg/scheduled-payments";
import styles from "./schedule.module.css";

type PaymentRow = ScheduleRow & {
  recipientNameRaw: string | null;
  milestoneLabel: string | null;
  deliverable: string | null;
  sourceSheetGid: string | null;
  sourceRowIndex: number | null;
  importedAt: Date;
};

export function PaymentTable({ rows, label, empty }: { rows: PaymentRow[]; label: string; empty: string }) {
  if (!rows.length) return <p className={styles.empty}>{empty}</p>;
  return (
    <div className={styles.tableWrap}>
      <table role="table" className={styles.table} aria-label={label}>
        <thead role="rowgroup"><tr role="row">{["Estimated date", "Grant / milestone", "Budgeted USD", "Payment status", "Source"].map((h) => <th role="columnheader" key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody role="rowgroup">{rows.map((r) => (
          <tr role="row" key={r.id}>
            <td role="cell" data-label="Estimated date" className={styles.date}>{r.estimatedPayoutDate}</td>
            <td role="cell" className={styles.project}>
              <span className={styles.program}>{r.sourceSheet === "coinholder_grants" ? "Coinholder" : "ZCG"}{r.category ? ` · ${r.category}` : ""}</span>
              <Link href={`/zcg/grant?g=${encodeURIComponent(r.project!)}`}>{r.project}</Link>
              {(r.milestoneLabel || r.deliverable) && <span className={styles.detail}>{r.milestoneLabel ? `Milestone ${r.milestoneLabel}` : r.deliverable}</span>}
              {r.recipientNameRaw && <Link className={styles.recipient} href={`/zcg/recipient?r=${encodeURIComponent(r.recipientNameRaw)}`}>{r.recipientNameRaw}</Link>}
            </td>
            <td role="cell" data-label="Budgeted USD" className={styles.amount}>{r.amountUsdCents == null ? "Not recorded" : formatUsdCents(r.amountUsdCents)}</td>
            <td role="cell" data-label="Payment status"><span className={styles.status}>Payment not recorded</span></td>
            <td role="cell" data-label="Source"><SourceRecordLink gid={r.sourceSheetGid} rowIndex={r.sourceRowIndex} importedAt={r.importedAt} /></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
