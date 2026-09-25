"use client";

import Link from "next/link";
import { Badge } from "@/components/ui";
import { DataTable, type Column } from "@/components/data-table";
import { PROCESS_LABEL, type DecisionRow } from "@/lib/governance/decisions";

const date = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

const columns: Column<DecisionRow>[] = [
  {
    key: "date",
    header: "Date",
    sortable: true,
    sortValue: (r) => r.date,
    render: (r) => (
      <span className="whitespace-nowrap tnum">{date(r.date)}</span>
    ),
  },
  {
    key: "process",
    header: "Type",
    sortable: true,
    filterable: true,
    filterType: "select",
    filterValue: (r) => PROCESS_LABEL[r.process],
    render: (r) => PROCESS_LABEL[r.process],
  },
  {
    key: "outcome",
    header: "Outcome",
    sortable: true,
    filterable: true,
    filterType: "select",
    filterValue: (r) => r.outcome,
    render: (r) => <Badge tone={r.tone}>{r.outcome}</Badge>,
  },
  {
    key: "subject",
    header: "Subject",
    sortable: true,
    filterable: true,
    filterValue: (r) => `${r.subject} ${r.detail ?? ""}`,
    render: (r) => (
      <div>
        {r.subjectHref ? (
          <Link
            href={r.subjectHref}
            className="font-medium text-stone-900 hover:text-amber-700"
          >
            {r.subject} →
          </Link>
        ) : (
          <span className="font-medium text-stone-900">{r.subject}</span>
        )}
        {r.detail ? (
          <span className="mt-0.5 block text-xs text-stone-600">
            {r.detail}
          </span>
        ) : null}
      </div>
    ),
  },
  {
    key: "decidedBy",
    header: "Decider",
    mobileHidden: true,
    sortable: true,
    filterable: true,
    filterType: "select",
    filterValue: (r) => r.decidedBy,
    render: (r) => <span className="text-stone-700">{r.decidedBy}</span>,
  },
  {
    key: "sources",
    header: "Sources",
    mobileHidden: true,
    render: (r) => (
      <span className="flex flex-wrap gap-x-3 gap-y-1">
        {r.sources.map((s) => (
          <a
            key={s.href}
            href={s.href}
            target="_blank"
            rel="noreferrer"
            className="whitespace-nowrap text-amber-700 hover:underline"
          >
            {s.label} ↗
          </a>
        ))}
      </span>
    ),
  },
];

type OptionalColumn = "process" | "decidedBy";

/**
 * Dated decisions with filters and CSV export. A page that holds a single
 * kind of decision hides the columns that would repeat on every row.
 */
export function DecisionsTable({
  rows,
  csvName,
  hide = [],
}: {
  rows: DecisionRow[];
  csvName: string;
  hide?: OptionalColumn[];
}) {
  return (
    <DataTable
      columns={columns.filter(
        (c) => !hide.includes(c.key as OptionalColumn),
      )}
      rows={rows}
      rowKey={(r) => r.id}
      initialSort={{ key: "date", dir: "desc" }}
      csvName={csvName}
    />
  );
}
