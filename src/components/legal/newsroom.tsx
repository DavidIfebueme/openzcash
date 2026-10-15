"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { LEGAL_REGIONS, LEGAL_TOPICS, type LegalFeed } from "@/lib/legal/types";
import { filterLegalItems, legalDate, legalItemDate } from "@/lib/legal/presentation";
import styles from "./legal.module.css";

export function LegalNewsroom({ feed }: { feed: LegalFeed }) {
  const params = useSearchParams();
  const [limit, setLimit] = useState(12);
  const region = LEGAL_REGIONS.some(item => item.id === params.get("region")) ? params.get("region")! : "all";
  const topic = LEGAL_TOPICS.some(item => item === params.get("topic")) ? params.get("topic")! : "";
  const q = params.get("q") ?? "";
  const sourceId = feed.sources.some(source => source.id === params.get("source")) ? params.get("source")! : "";
  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value && value !== "all") next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    window.history.replaceState(null, "", `/legal${query ? `?${query}` : ""}#updates`);
    setLimit(12);
  };
  const shown = filterLegalItems(feed.items, { region, topic, q, sourceId });
  const filtered = region !== "all" || !!topic || !!q || !!sourceId;
  const sources = new Map(feed.sources.map(source => [source.id, source]));
  return <div className={styles.newsroom}>
    <div className={styles.feedMain}>
      <nav className={styles.regions} aria-label="Policy update regions">
        {LEGAL_REGIONS.map(item => <button key={item.id} type="button" aria-pressed={region === item.id} onClick={() => update({ region: item.id })}>{item.label}</button>)}
      </nav>
      <div className={styles.filters}>
        <label className={`${styles.filterField} ${styles.searchField}`}>
          <span className={styles.filterLabel}>Search</span>
          <span className={styles.searchControl}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>
            <input type="search" aria-label="Search policy updates" value={q} placeholder="Country, topic or update…" onChange={event => update({ q: event.target.value })}/>
          </span>
        </label>
        <label className={styles.filterField}>
          <span className={styles.filterLabel}>Source</span>
          <span className={styles.selectControl}>
            <select value={sourceId} onChange={event => update({ source: event.target.value })}><option value="">All sources</option>{feed.sources.map(source => <option key={source.id} value={source.id}>{source.name}</option>)}</select>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
          </span>
        </label>
        <label className={styles.filterField}>
          <span className={styles.filterLabel}>Topic</span>
          <span className={styles.selectControl}>
            <select value={topic} onChange={event => update({ topic: event.target.value })}><option value="">All topics</option>{LEGAL_TOPICS.map(item => <option key={item} value={item}>{item}</option>)}</select>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
          </span>
        </label>
      </div>
      <div className={styles.results}><p role="status">{shown.length} {shown.length === 1 ? "update" : "updates"}<span> · newest first</span></p>{filtered && <button type="button" onClick={() => update({ q: "", region: "", topic: "", source: "" })}>Clear filters ×</button>}</div>
      <div className={styles.articles}>
        {shown.slice(0, limit).map(item => <article key={item.id} className={styles.article}>
          <div className={styles.articleMeta}><time dateTime={item.publishedAt}>{legalItemDate(item)}</time><span>{item.jurisdictions.join(" · ")}</span></div>
          <div className={styles.articleBody}>
            <div className={styles.sourceLine}><span>{sources.get(item.sourceId)?.name ?? item.sourceId}</span><span aria-hidden="true">·</span><span>{item.kind}</span></div>
            <h2><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}<span aria-hidden="true">↗</span><span className={styles.srOnly}> (opens source in a new tab)</span></a></h2>
            <p className={styles.summary}>{item.summary}</p>
            <div className={styles.articleFoot}><span className={styles.status} data-status={item.status}>{item.status}</span>{item.effectiveAt && <span>Applies from {legalDate(item.effectiveAt)}</span>}{item.reportingPeriod && <span>{item.reportingPeriod}</span>}</div>
            {item.sourceUpdatedAt && item.dateBasis !== "updated" && <p className={styles.context}>Publisher updated this source on {legalDate(item.sourceUpdatedAt)}.</p>}
            {item.sourceChangedAt && item.reviewedAt && <p className={styles.context}>Source content changed since it was archived. Check the source against our review dated {legalDate(item.reviewedAt)}.</p>}
            {item.statusDetail && <p className={styles.context}>{item.statusDetail}</p>}
          </div>
        </article>)}
      </div>
      {!shown.length && <div className={styles.empty}><h2>No matching updates</h2><p>Try another region or topic. Our coverage is selective; no entry does not mean no legal developments.</p><button type="button" onClick={() => update({ q: "", region: "", topic: "", source: "" })}>Show all updates</button></div>}
      {shown.length > limit && <button className={styles.more} type="button" onClick={() => setLimit(limit + 12)}>Show more updates</button>}
    </div>
    <p className={styles.readingNote}><strong>Reading the status:</strong> analysis is commentary; proposals are under consideration. For adopted rules, check the scope and application date.</p>
  </div>;
}
