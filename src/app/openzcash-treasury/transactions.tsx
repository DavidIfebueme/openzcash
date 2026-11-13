"use client";

import { useState } from "react";
import { treasuryCopy } from "@/lib/openzcash-treasury/content";
import type { TreasuryTransaction } from "@/lib/openzcash-treasury/ledger";
import { displayMemo, memoPreview } from "@/lib/openzcash-treasury/memo";
import { TransactionLink } from "./transaction-link";
import { ActivityIcon, IncomingIcon, OutgoingIcon } from "./treasury-icons";
import styles from "./treasury.module.css";

export type { TreasuryTransaction } from "@/lib/openzcash-treasury/ledger";

/** The panel stays one screen tall however long the history grows. */
const PAGE_SIZE = 5;

function formatAmount(zatoshis: string) {
  const amount = BigInt(zatoshis);
  const fraction = (amount % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "");
  return `${amount / 100_000_000n}${fraction ? `.${fraction}` : ""}`;
}

/** null means no verified feed; [] means a verified feed with no transactions. */
export function TreasuryTransactions({ transactions }: { transactions: readonly TreasuryTransaction[] | null }) {
  const t = treasuryCopy;
  const [filter, setFilter] = useState<"all" | "incoming" | "outgoing">("all");
  const [page, setPage] = useState(0);
  const rows = transactions?.filter((tx) => filter === "all" || tx.direction === filter);
  const pages = Math.max(1, Math.ceil((rows?.length ?? 0) / PAGE_SIZE));
  // The feed refreshes under the reader: a history that shrank must not leave them on a page that no longer exists.
  const current = Math.min(page, pages - 1);
  const visible = rows?.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const filters = [{ value: "all", label: t.allTransactions }, { value: "incoming", label: t.incoming }, { value: "outgoing", label: t.outgoing }] as const;
  const emptyText = filter === "incoming" ? t.noIncoming : filter === "outgoing" ? t.noOutgoing : t.noTransactions;

  return <section className={styles.transactions} aria-labelledby="treasury-transactions">
    <div className={styles.transactionsHead}>
      <h2 id="treasury-transactions"><ActivityIcon />{t.transactions}</h2>
      <div className={styles.transactionFilters} role="group" aria-label={t.filterTransactions}>
        {filters.map(({ value, label }) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(0); }}>{label}</button>)}
      </div>
    </div>
    <table className={styles.transactionTable}>
      <caption className="sr-only">{filters.find(({ value }) => value === filter)?.label} · {t.transactions}</caption>
      <thead><tr><th scope="col">{t.transaction}</th><th scope="col">{t.amount}</th></tr></thead>
      <tbody>
        {visible?.map((tx) => <tr key={`${tx.txid}:${tx.direction}`}>
          <td>
            <div className={styles.transactionIdentity}>
              <span className={styles.directionIcon} data-direction={tx.direction}>{tx.direction === "incoming" ? <IncomingIcon /> : tx.direction === "outgoing" ? <OutgoingIcon /> : <ActivityIcon />}</span>
              <div>
                <span className={styles.transactionDirection}>{tx.direction === "incoming" ? t.incoming : tx.direction === "outgoing" ? t.outgoing : t.internal}</span>
                <TransactionLink txid={tx.txid} />
                {tx.memos.length > 0 && <details className={styles.transactionMemo}>
                  <summary>
                    <span className={styles.memoLabel}>{t.memo}{tx.memos.length > 1 ? ` (${tx.memos.length})` : ""}<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></span>
                    <span className={styles.memoPreview}>{memoPreview(tx.memos)}</span>
                  </summary>
                  {tx.memos.map((memo, index) => <p key={index}>{displayMemo(memo)}</p>)}
                </details>}
              </div>
            </div>
          </td>
          <td className={styles.transactionValue}>
            <div className={styles.transactionAmount} data-direction={tx.direction} title={tx.direction === "outgoing" ? t.includesFees : undefined}><span>{tx.direction === "incoming" ? "+" : tx.direction === "outgoing" ? "−" : ""}{formatAmount(tx.amountZatoshis)}</span><span>ZEC</span></div>
            <time dateTime={tx.confirmedAt} title={`${t.date}: ${new Date(tx.confirmedAt).toISOString()}`}>{new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(tx.confirmedAt))}</time>
          </td>
        </tr>)}
        {(!rows || rows.length === 0) && <tr><td colSpan={2} className={styles.transactionEmpty}>
          <span className={styles.emptyActivityIcon}><ActivityIcon /></span>
          <p role="status">{transactions === null ? t.historyPending : emptyText}</p>
          <span>{transactions === null ? t.historyPendingNote : t.verifiedHistory}</span>
        </td></tr>}
      </tbody>
    </table>
    {pages > 1 && <nav className={styles.pager} aria-label={t.pages}>
      <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>{t.previousPage}</button>
      <span aria-live="polite">{t.page} {current + 1} {t.pageOf} {pages}</span>
      <button type="button" disabled={current === pages - 1} onClick={() => setPage(current + 1)}>{t.nextPage}</button>
    </nav>}
  </section>;
}
