"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { filterHistory, historyCsv, type HistoryRecord } from "@/lib/participate/workspace/domain/participate-history";

const outcomes = ["All", "Approved", "Rejected", "Filtered", "Vetoed"];
const pageSize = 15;
const date = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function ParticipateHistory({ data }: { data: { rows: HistoryRecord[]; origin: string } | null }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState("All");
  const [year, setYear] = useState("All");
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(0);
  const results = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => filterHistory(data?.rows ?? [], { outcome, year, query, order }), [data, outcome, year, query, order]);
  const years = [...new Set(data?.rows.map(row => row.date.slice(0, 4)))].sort().reverse();
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
  const start = currentPage * pageSize;

  function exportCsv() {
    const url = URL.createObjectURL(new Blob(["\ufeff", historyCsv(filtered)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "zcg-committee-decisions.csv"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function changePage(next: number) {
    setPage(next);
    results.current?.scrollIntoView({ block: "start" });
    results.current?.focus({ preventScroll: true });
  }

  if (!data) return <section className="participate-history" aria-label="Decision history"><div className="history-empty" role="status"><h1>History temporarily unavailable</h1><p>Your workspace is still available. Try loading the records again.</p><button type="button" className="dao-button" onClick={() => router.refresh()}>Try again</button></div></section>;

  return <section className="participate-history" aria-label="Decision history">
    <h1 className="history-sr-only">Decision history</h1>
    <div className="history-topline"><p>Committee decisions <span>· {data.rows.length.toLocaleString("en-US")} records</span></p><button type="button" className="history-export" onClick={exportCsv} disabled={!filtered.length}>Export CSV <span aria-hidden="true">↓</span></button></div>
    <div className="history-filters" aria-label="Filter decisions">{outcomes.filter(value => value !== "Vetoed" || data.rows.some(row => row.outcome === value)).map(value => <button key={value} type="button" aria-pressed={outcome === value} onClick={() => { setOutcome(value); setPage(0); }}>{value}</button>)}</div>
    <div className="history-tools">
      <label className="dao-search"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10" cy="10" r="6.5" /><path d="m15 15 6 6" /></svg><input type="search" aria-label="Search decisions" placeholder="Search decisions" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} /></label>
      <select aria-label="Decision year" value={year} onChange={event => { setYear(event.target.value); setPage(0); }}><option value="All">All years</option>{years.map(value => <option key={value}>{value}</option>)}</select>
      <select aria-label="Decision order" value={order} onChange={event => { setOrder(event.target.value as "newest" | "oldest"); setPage(0); }}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
    </div>
    <div ref={results} className="history-results" tabIndex={-1}>
      <p className="history-count" role="status">{filtered.length ? `${start + 1}–${Math.min(start + pageSize, filtered.length)} of ${filtered.length.toLocaleString("en-US")} decisions` : "No matching decisions"}</p>
      <ol className="history-records" aria-label="Committee decision records">{filtered.slice(start, start + pageSize).map(row => <li key={row.id}>
        <time dateTime={row.date}>{date(row.date)}</time>
        <div className="history-record-subject"><h2>{row.subject}</h2>{row.detail ? <p>{row.detail}</p> : null}<div className="history-sources">{row.sources.map(source => <a key={source.href} href={source.href} target="_blank" rel="noopener noreferrer">{source.label} <span aria-hidden="true">↗</span></a>)}{row.subjectHref ? <a href={`${data.origin}${row.subjectHref}`} target="_blank" rel="noopener noreferrer">Grant record <span aria-hidden="true">↗</span></a> : null}</div></div>
        <span className="history-outcome" data-outcome={row.outcome}>{row.outcome}</span>
      </li>)}</ol>
      {!filtered.length ? <div className="history-empty"><p>{data.rows.length ? "Try another search or clear your filters." : "No published decisions are available yet."}</p>{data.rows.length ? <button type="button" className="dao-button" onClick={() => { setOutcome("All"); setQuery(""); setYear("All"); setPage(0); }}>Clear filters</button> : null}</div> : null}
    </div>
    {filtered.length > pageSize ? <nav className="history-pagination" aria-label="Decision history pages"><button type="button" disabled={currentPage === 0} onClick={() => changePage(currentPage - 1)}>← Previous</button><span>Page {currentPage + 1} of {Math.ceil(filtered.length / pageSize)}</span><button type="button" disabled={start + pageSize >= filtered.length} onClick={() => changePage(currentPage + 1)}>Next →</button></nav> : null}
    <details className="history-provenance"><summary>About these records</summary><p>Spreadsheet status changes appear the day after import, starting at midnight in Brasília. Reviewed public meeting minutes can add a documented verdict while the sheet is still awaiting an update. Proposals also includes withdrawals and records without a decision date.</p><p>The October 12, 2026 minutes are matched by exact GitHub issue and forum topic, with links to the votes and feedback. Asynchronous votes keep their earlier decision dates. Other minutes are linked by meeting date; grant records use title matching. Published source decisions are separate from votes cast through Participate.</p></details>
  </section>;
}
