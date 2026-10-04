"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { HistoryIndexItem } from "@/lib/project-history/insights";
import { BrandMark } from "@/components/ecosystem/identity";
import type { Brand } from "@/components/ecosystem/branding";
import { CATEGORIES, displayDate } from "@/lib/ecosystem/catalog";
import styles from "./directory.module.css";

export function HistoryDirectory({ items, brands, paymentsAvailable }: { items: HistoryIndexItem[]; brands: Record<string, Brand | null>; paymentsAvailable: boolean }) {
  const params = useSearchParams();
  const search = params.get("q") ?? "", category = params.get("category") ?? "";
  const scope = ["projects", "communities"].includes(params.get("scope") ?? "") ? params.get("scope")! : "all";
  const sort = ["recent", "name"].includes(params.get("sort") ?? "") ? params.get("sort")! : "ecosystem";
  const requestedView = params.get("view") ?? "all";
  const [limit, setLimit] = useState(24);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const terms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key); }
    window.history.replaceState(null, "", `?${next.toString()}`); setLimit(24);
  }
  const scopes = [
    { id: "all", label: "All", test: () => true },
    { id: "projects", label: "Projects", test: (item: HistoryIndexItem) => !item.communityId },
    { id: "communities", label: "Communities", test: (item: HistoryIndexItem) => !!item.communityId },
  ];
  const views = [
    { id: "all", label: "All evidence", test: () => true },
    { id: "funding", label: "Grants linked", test: (item: HistoryIndexItem) => item.insights.grants > 0 },
    { id: "public-work", label: "Public work linked", test: (item: HistoryIndexItem) => item.insights.publicWorkSources > 0 },
    { id: "work", label: "Release records", test: (item: HistoryIndexItem) => item.insights.publishedArtifacts > 0 },
    { id: "acceptance", label: paymentsAvailable ? "Acceptance to link" : "Acceptance · source unavailable", test: (item: HistoryIndexItem) => (item.insights.acceptanceGaps ?? 0) > 0 },
  ];
  const selectedView = views.find(view => view.id === requestedView && (view.id !== "acceptance" || paymentsAvailable)) ?? views[0];
  const selectedScope = scopes.find(item => item.id === scope)!;
  const categoryOrder = (name: string) => { const index = CATEGORIES.findIndex(category => category === name); return index < 0 ? CATEGORIES.length : index; };
  const categories = [...new Set(items.filter(selectedScope.test).map(item => item.category))].sort((a, b) => categoryOrder(a) - categoryOrder(b) || a.localeCompare(b));
  const selectedCategory = categories.includes(category) ? category : "";
  const matched = items.filter(item => selectedScope.test(item) && (!selectedCategory || item.category === selectedCategory) && selectedView.test(item) && terms.every(term => `${item.name} ${item.id} ${item.description}`.toLowerCase().includes(term)))
    .sort((a, b) => (sort === "recent" ? (b.latestEvent?.date ?? "").localeCompare(a.latestEvent?.date ?? "") : sort === "ecosystem" ? categoryOrder(a.category) - categoryOrder(b.category) || a.category.localeCompare(b.category) : 0) || a.name.localeCompare(b.name));
  const visible = matched.slice(0, limit);
  const groups = sort === "ecosystem" ? [...new Set(visible.map(item => item.category))].map(name => ({ name, items: visible.filter(item => item.category === name), total: matched.filter(item => item.category === name).length })) : [{ name: "", items: visible, total: matched.length }];
  const filtered = !!(search || selectedCategory || selectedView.id !== "all" || scope !== "all");
  const activeFilters = Number(!!selectedCategory) + Number(selectedView.id !== "all");
  const reset = () => update({ q: "", category: "", view: "", scope: "" });
  return <>
    <div className={styles.scopeBar}>
      <div className={styles.scopes} role="group" aria-label="Browse histories">{scopes.map(item => <button key={item.id} type="button" aria-pressed={scope === item.id} onClick={() => update({ scope: item.id === "all" ? "" : item.id, category: "" })}>{item.label}<span>{items.filter(item.test).length}</span></button>)}</div>
      <span className={styles.scopeHint}>Funding, work and the evidence behind it.</span>
    </div>
    <div className={styles.toolbar}>
      <label className={styles.search}>Search histories<div><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><input type="search" value={search} placeholder="Project, community or keyword…" onChange={event => update({ q: event.target.value })} /></div></label>
      <button type="button" className={styles.filterToggle} aria-expanded={filtersOpen} aria-controls="history-filter-fields" onClick={() => setFiltersOpen(!filtersOpen)}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 7h16M4 17h16M9 4v6M15 14v6"/></svg>Filters{activeFilters > 0 && <span>{activeFilters}</span>}</button>
      <div id="history-filter-fields" className={styles.filterFields} data-open={filtersOpen}>
      <label>Area<select value={selectedCategory} onChange={event => update({ category: event.target.value })}><option value="">All areas</option>{categories.map(name => <option value={name} key={name}>{name}</option>)}</select></label>
      <label>Evidence<select value={selectedView.id} onChange={event => update({ view: event.target.value === "all" ? "" : event.target.value })}>{views.map(view => <option key={view.id} value={view.id} disabled={view.id === "acceptance" && !paymentsAvailable}>{view.label}</option>)}</select></label>
      </div>
    </div>
    <div className={styles.resultsLine}><div><p aria-live="polite"><strong>{matched.length}</strong> {scope === "projects" ? matched.length === 1 ? "project" : "projects" : scope === "communities" ? matched.length === 1 ? "community" : "communities" : matched.length === 1 ? "history" : "histories"}{filtered && <button type="button" onClick={reset}>Clear filters <span aria-hidden="true">×</span></button>}</p><span>{selectedView.id === "acceptance" ? "Gaps in our evidence, not a finding of non-delivery." : sort === "ecosystem" ? "Grouped by ecosystem area · A–Z within each area" : "Source coverage varies by project."}</span>{scope !== "communities" && <span>Shared repositories may include non-Zcash work. Publication is not funded delivery.</span>}</div><label><span>Sort by</span><select aria-label="Sort by" value={sort} onChange={event => update({ sort: event.target.value === "ecosystem" ? "" : event.target.value })}><option value="ecosystem">Ecosystem area</option><option value="recent">Latest dated activity</option><option value="name">Name A–Z</option></select></label></div>
    {groups.map(group => <section className={styles.group} key={group.name} aria-label={group.name || "Matching histories"}>
      {group.name && <div className={styles.groupHeading}><h2>{group.name}</h2><span>{group.total}</span><div /></div>}
      <div className={styles.directory}>{group.items.map(item => <Link className={styles.entry} key={item.id} href={`/ecosystem/history/${item.id}`} prefetch={false}>
        <div className={styles.entryHeading}><BrandMark brand={brands[item.id] ?? null} category={item.category} /><div><span>{item.category}</span><h3>{item.name}</h3></div><span className={styles.entryArrow} aria-hidden="true">→</span></div><p>{item.description}</p>
        <dl className={styles.entryFacts}><div><dt>Grants linked</dt><dd>{item.insights.grants}</dd></div><div><dt>Paid entries</dt><dd>{item.insights.paidEntries ?? "—"}</dd></div><div><dt title="Distinct links to releases, reports and reviewed work.">Work sources</dt><dd>{item.insights.publicWorkSources}</dd></div></dl>
        <div className={styles.entryLatest}>{item.latestEvent ? <><div><small>Latest {item.latestEvent.releaseChannel === "prerelease" ? "prerelease" : item.latestEvent.kind === "context" ? "record" : item.latestEvent.kind}</small><time dateTime={item.latestEvent.date ?? undefined}>{displayDate(item.latestEvent.date ?? "")}</time></div><span>{item.latestEvent.title}</span></> : <span>No dated activity linked</span>}</div>
      </Link>)}</div>
    </section>)}
    {!matched.length && <div className={styles.empty}><h2>No matching histories</h2><p>Try a different name, area or evidence filter.</p><button type="button" onClick={reset}>Clear filters</button></div>}
    {matched.length > limit && <div className={styles.more}><button type="button" onClick={() => setLimit(limit + 24)}>Show more histories <span aria-hidden="true">↓</span></button><span>Showing {visible.length} of {matched.length}</span></div>}
  </>;
}
