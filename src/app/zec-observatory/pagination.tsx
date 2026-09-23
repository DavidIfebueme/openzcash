"use client";

import { useState } from "react";
import styles from "./markets.module.css";

const PAGE_SIZE = 9;

export function usePagination<T>(rows: T[]) {
  const [requestedPage, setPage] = useState(0);
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.max(0, Math.min(requestedPage, pageCount - 1));
  // Keep a refresh that removes rows from leaving the reader on an empty page.
  if (page !== requestedPage) setPage(page);
  const start = page * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, total);
  return { items: rows.slice(start, end), page, pageCount, start, end, total, setPage };
}

type PaginationState = Omit<ReturnType<typeof usePagination>, "items">;

export function Pagination({
  pagination: { page, pageCount, start, end, total, setPage },
  label,
  itemLabel,
}: {
  pagination: PaginationState;
  label: string;
  itemLabel: string;
}) {
  if (!total) return null;
  return (
    <nav className={styles.pagination} aria-label={`${label} pagination`}>
      <span className={styles.pageRange} aria-live="polite" aria-atomic="true">
        <strong>{start + 1}–{end}</strong> of {total} {itemLabel}
      </span>
      {pageCount > 1 && (
        <div className={styles.pageButtons}>
          {([
            { name: "First", page: 0, direction: -1, edge: true },
            { name: "Previous", page: page - 1, direction: -1, edge: false },
          ] as const).map((button) => (
            <button
              key={button.name}
              type="button"
              aria-label={`${button.name} ${label.toLowerCase()} page`}
              title={`${button.name} page`}
              disabled={page === 0}
              onClick={() => setPage(button.page)}
            >
              <PageArrow direction={button.direction} edge={button.edge} />
            </button>
          ))}
          <span className={styles.pageNumber}>
            <strong>{page + 1}</strong> / {pageCount}
          </span>
          {([
            { name: "Next", page: page + 1, direction: 1, edge: false },
            { name: "Last", page: pageCount - 1, direction: 1, edge: true },
          ] as const).map((button) => (
            <button
              key={button.name}
              type="button"
              aria-label={`${button.name} ${label.toLowerCase()} page`}
              title={`${button.name} page`}
              disabled={page === pageCount - 1}
              onClick={() => setPage(button.page)}
            >
              <PageArrow direction={button.direction} edge={button.edge} />
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}

function PageArrow({ direction, edge }: { direction: -1 | 1; edge: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === -1 ? "m14 7-5 5 5 5" : "m10 7 5 5-5 5"} />
      {edge && <path d={direction === -1 ? "M5 6v12" : "M19 6v12"} />}
    </svg>
  );
}
