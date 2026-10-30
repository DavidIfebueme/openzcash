"use client";

import Link from "next/link";
import { useState } from "react";
import { Q4, q4Usd, type Q4ProposalSummary } from "@/lib/coinholder/q4";
import styles from "./proposals.module.css";

export function Proposals({ proposals }: { proposals: Q4ProposalSummary[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const categories = [...new Set(proposals.map((p) => p.category ?? "Unspecified"))].sort();
  const needle = query.trim().toLowerCase();
  const shown = proposals.filter((p) => (!category || (p.category ?? "Unspecified") === category) &&
    `${p.number} ${p.title} ${p.organization ?? ""} ${p.applicant} ${p.summary ?? ""}`.toLowerCase().includes(needle))
    .sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "highest" || sort === "lowest") {
        if (a.requestedUsdCents === null) return b.requestedUsdCents === null ? 0 : 1;
        if (b.requestedUsdCents === null) return -1;
        return (a.requestedUsdCents - b.requestedUsdCents) * (sort === "highest" ? -1 : 1);
      }
      return b.createdAt.localeCompare(a.createdAt) || b.number - a.number;
    });
  function clear() { setQuery(""); setCategory(""); }

  if (!proposals.length) return <div className={styles.empty}><h2>No proposals yet</h2><p>Official submissions will appear here.</p></div>;
  return <>
    <div className={styles.filters}>
      <label className={styles.search}><span className="sr-only">Search proposals</span><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg><input type="search" placeholder="Search proposals" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      <label><span className="sr-only">Category</span><select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label><span className="sr-only">Sort</span><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Newest first</option><option value="highest">Highest request</option><option value="lowest">Lowest request</option><option value="title">Project A–Z</option></select></label>
    </div>
    <div className={styles.resultCount} role="status">{query || category ? <><span>{shown.length} of {proposals.length} proposals</span><button type="button" onClick={clear}>Clear filters</button></> : null}</div>
    <ol className={styles.list} aria-label="Official proposals">
      {shown.map((p) => <li key={p.number}>
        <article className={styles.proposal}>
          <div className={styles.proposalContent}>
            <div className={styles.meta}><span>#{p.number}</span><span>{p.category ?? "Uncategorized"}</span></div>
            <h2><Link href={`${Q4.href}/${p.number}`}>{p.title}</Link></h2>
            <p className={styles.applicant}>{p.organization ?? (p.applicant ? `@${p.applicant}` : "Applicant not specified")}</p>
            {p.summary ? <p className={styles.summary}>{p.summary}</p> : null}
          </div>
          <div className={styles.request}>
            <span>Requested · USD</span><strong>{p.requestedUsdCents === null ? "Not specified" : q4Usd(p.requestedUsdCents)}</strong>
            <Link href={`${Q4.href}/${p.number}`}>View proposal <span aria-hidden>→</span><span className="sr-only">: {p.title}</span></Link>
          </div>
        </article>
      </li>)}
    </ol>
    {!shown.length ? <div className={styles.empty}><h2>No matching proposals</h2><p>Try another name or category.</p></div> : null}
  </>;
}
