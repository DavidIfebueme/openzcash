"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { LEGAL_REGIONS, LEGAL_TOPICS, type LegalFeed, type LegalItem, type ReadingLanguage } from "@/lib/legal/types";
import { filterLegalItems, legalDate, legalItemDate, isReadingLanguage, languagesOf, readingLanguages } from "@/lib/legal/presentation";
import { ReadingLink } from "./reading-link";
import styles from "./legal.module.css";

function readerUrl(item: LegalItem, language: ReadingLanguage | undefined, query: string) {
  if (!item.reader) return item.url;
  const params = new URLSearchParams(query);
  params.delete("lang");
  if (language === "en" && item.languages?.includes("pt")) params.set("lang", "en");
  return item.reader + (params.size ? "?" + params : "");
}

function UpdateActions({ item, query }: { item: LegalItem; query: string }) {
  const languages = languagesOf(item);
  if (!item.reader) return <ReadingLink href={item.url} language={languages[0]} external/>;
  return <>{languages.map(lang => <ReadingLink key={lang} href={readerUrl(item, lang, query)} language={lang}/>)}</>;
}

export function LegalNewsroom({ feed }: { feed: LegalFeed }) {
  const params = useSearchParams();
  const [limit, setLimit] = useState(12);
  const region = LEGAL_REGIONS.some(item => item.id === params.get("region")) ? params.get("region")! : "all";
  const topic = LEGAL_TOPICS.some(item => item === params.get("topic")) ? params.get("topic")! : "";
  const languageParam = params.get("language");
  const language = isReadingLanguage(languageParam) ? languageParam : undefined;
  const q = params.get("q") ?? "";
  const sourceId = feed.sources.some(source => source.id === params.get("source")) ? params.get("source")! : "";
  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(changes)) {
      if (value && value !== "all") next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    window.history.replaceState(null, "", `/legal${query ? `?${query}` : ""}#updates`);
    setLimit(12);
  };
  const clear = () => update({ q: "", region: "", topic: "", source: "", language: "" });
  const shown = filterLegalItems(feed.items, { region, topic, q, sourceId, language });
  const filtered = region !== "all" || !!topic || !!q || !!sourceId || !!language;
  const sources = new Map(feed.sources.map(source => [source.id, source]));
  return <div className={styles.newsroom}>
    <div className={styles.feedMain}>
      <div className={styles.toolbar} id="update-filters" tabIndex={-1}>
        <div className={styles.toolbarHead}><h3>Filters</h3><button type="button" disabled={!filtered} onClick={clear}>Clear filters</button></div>
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
            <span id="policy-filter-source" className={styles.filterLabel}>Source</span>
            <span className={styles.selectControl}>
              <select aria-labelledby="policy-filter-source" value={sourceId} onChange={event => update({ source: event.target.value })}><option value="">All sources</option>{feed.sources.map(source => <option key={source.id} value={source.id}>{source.name}</option>)}</select>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
            </span>
          </label>
          <label className={styles.filterField}>
            <span id="policy-filter-topic" className={styles.filterLabel}>Topic</span>
            <span className={styles.selectControl}>
              <select aria-labelledby="policy-filter-topic" value={topic} onChange={event => update({ topic: event.target.value })}><option value="">All topics</option>{LEGAL_TOPICS.map(item => <option key={item} value={item}>{item}</option>)}</select>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
            </span>
          </label>
          <label className={styles.filterField}>
            <span id="policy-filter-language" className={styles.filterLabel}>Language</span>
            <span className={styles.selectControl}>
              <select aria-labelledby="policy-filter-language" value={language ?? ""} onChange={event => update({ language: event.target.value })}>
                <option value="">All languages</option>
                {Object.entries(readingLanguages).map(([code, edition]) => <option key={code} value={code}>{edition.name} {edition.flag}</option>)}
              </select>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
            </span>
          </label>
        </div>
      </div>
      <div className={styles.results}><p role="status">{shown.length} {shown.length === 1 ? "update" : "updates"}<span> · newest first</span></p></div>
      <div className={styles.articles}>
        {shown.slice(0, limit).map(item => <article key={item.id} className={styles.article}>
          <div className={styles.articleMeta}><time dateTime={item.publishedAt}>{legalItemDate(item)}</time><span>{item.jurisdictions.join(" · ")}</span></div>
          <div className={styles.articleBody}>
            <div className={styles.sourceLine}><span>{sources.get(item.sourceId)?.name ?? item.sourceId}</span><span aria-hidden="true">·</span><span>{item.kind}</span>{item.contributor && !sources.get(item.sourceId)?.name.includes(item.contributor) && <><span aria-hidden="true">·</span><span>{item.contributor}</span></>}<span className={styles.status} data-status={item.status}>{item.status}</span></div>
            <h3>{item.reader ? <a href={readerUrl(item, language ?? languagesOf(item)[0], params.toString())}>{language === "pt" ? item.portugueseTitle ?? item.title : item.title}</a> : <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}<span className={styles.srOnly}> (opens in a new tab)</span></a>}</h3>
            <p className={styles.summary}>{item.summary}</p>
            {(item.effectiveAt || item.reportingPeriod) && <div className={styles.articleFoot}>{item.effectiveAt && <span>Applies from {legalDate(item.effectiveAt)}</span>}{item.reportingPeriod && <span>{item.reportingPeriod}</span>}</div>}
            {item.sourceUpdatedAt && item.dateBasis !== "updated" && <p className={styles.context}>Publisher updated this source on {legalDate(item.sourceUpdatedAt)}.</p>}
            {item.sourceChangedAt && item.reviewedAt && <p className={styles.context}>Source content changed since it was archived. Check the source against our review dated {legalDate(item.reviewedAt)}.</p>}
            {item.statusDetail && <p className={styles.context}>{item.statusDetail}</p>}
          </div>
          <div className={styles.rowLinks}><UpdateActions item={item} query={params.toString()}/></div>
        </article>)}
      </div>
      {!shown.length && <div className={styles.empty}><h2>No matching updates</h2><p>Try another region or topic. Our coverage is selective; no entry does not mean no legal developments.</p><button type="button" onClick={clear}>Show all updates</button></div>}
      {!!shown.length && <div className={styles.listEnd}>
        {shown.length > limit && <button className={styles.more} type="button" onClick={() => setLimit(limit + 12)}>Show more updates</button>}
        <a href="#update-filters">Back to filters ↑</a>
      </div>}
    </div>
    <p className={styles.readingNote}><strong>Reading the status:</strong> analysis is commentary; proposals are under consideration. For adopted rules, check the scope and application date.</p>
  </div>;
}
