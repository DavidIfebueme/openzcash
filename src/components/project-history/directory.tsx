"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { HistoryIndexItem } from "@/lib/project-history/insights";
import { BrandMark } from "@/components/ecosystem/identity";
import type { Brand } from "@/components/ecosystem/branding";
import { displayDate } from "@/lib/ecosystem/catalog";
import styles from "./history.module.css";

export function HistoryDirectory({ items, brands, paymentsAvailable }: { items: HistoryIndexItem[]; brands: Record<string, Brand | null>; paymentsAvailable: boolean }) {
  const params = useSearchParams();
  const search = params.get("q") ?? "", category = params.get("category") ?? "", lens = params.get("view") ?? "all", sort = params.get("sort") ?? "recent";
  const [limit, setLimit] = useState(24);
  const terms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key); }
    window.history.replaceState(null, "", `?${next.toString()}`); setLimit(24);
  }
  const lenses = [
    { id: "all", label: "All histories", description: "Projects and communities", test: () => true },
    { id: "funding", label: "Funding linked", description: "With associated grant records", test: (item: HistoryIndexItem) => item.insights.grants > 0 },
    { id: "work", label: "Published releases", description: "With linked release artifacts", test: (item: HistoryIndexItem) => item.insights.publishedArtifacts > 0 },
    { id: "acceptance", label: "Acceptance to link", description: "With acceptance evidence to link", test: (item: HistoryIndexItem) => (item.insights.acceptanceGaps ?? 0) > 0 },
  ];
  const selectedLens = lenses.find(item => item.id === lens && (item.id !== "acceptance" || paymentsAvailable)) ?? lenses[0];
  const matched = items.filter(item => (!category || item.category === category) && selectedLens.test(item) && terms.every(term => `${item.name} ${item.id} ${item.description}`.toLowerCase().includes(term)))
    .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : (b.latestEvent?.date ?? "").localeCompare(a.latestEvent?.date ?? "") || a.name.localeCompare(b.name));
  return <>
    <div className={styles.lenses} role="group" aria-label="History views">{lenses.map(item => {
      const unavailable = item.id === "acceptance" && !paymentsAvailable;
      return <button key={item.id} onClick={() => update({ view: item.id === "all" ? "" : item.id })} aria-pressed={selectedLens.id === item.id} disabled={unavailable}>
        <span className={styles.lensLabel}>{item.label}<span aria-hidden="true">→</span></span>
        <strong>{unavailable ? "—" : items.filter(item.test).length}</strong>
        <small>{unavailable ? "Payment source unavailable" : item.description}</small>
      </button>;
    })}</div>
    <div className={styles.filters}>
      <label className={styles.search}>Find a project or community<input type="search" value={search} placeholder="Name, community or area of work…" onChange={event => update({ q: event.target.value })} /></label>
      <label>Category<select value={category} onChange={event => update({ category: event.target.value })}><option value="">All categories</option>{[...new Set(items.map(item => item.category))].sort().map(name => <option key={name}>{name}</option>)}</select></label>
      <label>Order<select value={sort} onChange={event => update({ sort: event.target.value })}><option value="recent">Latest dated activity</option><option value="name">Name A–Z</option></select></label>
    </div>
    <div className={styles.resultsLine}><p className={styles.muted} aria-live="polite">{matched.length} {matched.length === 1 ? "history" : "histories"}{selectedLens.id === "acceptance" ? " · gaps in our evidence, not a finding of non-delivery" : " · source coverage varies by project"}</p>{(search || category || selectedLens.id !== "all") && <button onClick={() => update({ q: "", category: "", view: "" })}>Reset filters</button>}</div>
    <div className={styles.directory}>{matched.slice(0, limit).map(item => <Link className={styles.entry} key={item.id} href={`/ecosystem/history/${item.id}`} prefetch={false}>
      <div className={styles.entryHeading}><BrandMark brand={brands[item.id] ?? null} category={item.category} /><div><span>{item.category}</span><h2>{item.name}</h2></div><span className={styles.entryArrow} aria-hidden="true">→</span></div><p>{item.description}</p>
      <dl className={styles.entryFacts}><div><dt>Grants linked</dt><dd>{item.insights.grants}</dd></div><div><dt>Paid entries</dt><dd>{item.insights.paidEntries ?? "—"}</dd></div><div><dt>Work sources</dt><dd>{item.insights.publicWorkSources}</dd></div></dl>
      <div className={styles.entryLatest}>{item.latestEvent ? <><div><small>Latest {item.latestEvent.kind === "context" ? "record" : item.latestEvent.kind}</small><time dateTime={item.latestEvent.date ?? undefined}>{displayDate(item.latestEvent.date ?? "")}</time></div><span>{item.latestEvent.title}</span></> : <span>No dated activity linked</span>}</div>
    </Link>)}</div>
    {!matched.length && <div className={styles.empty}><h2>No matching histories</h2><p>Try a different name, category or evidence view.</p><button className={styles.more} onClick={() => update({ q: "", category: "", view: "" })}>Clear all filters</button></div>}
    {matched.length > limit && <button className={styles.more} onClick={() => setLimit(limit + 24)}>Show more histories ({matched.length - limit} remaining)</button>}
  </>;
}
