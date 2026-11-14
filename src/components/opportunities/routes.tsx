"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { BASE, filterCatalog, formatDate, platforms, platformFor, type Catalog, type CatalogItem } from "./catalog";
import { useCatalog } from "./frame";
import { Empty, Field, Heading, Hero, LocaleSummary, PlatformMark } from "./components";
import { Editor } from "./editor";
import { Icon, Illustration } from "./visuals";
import { countries, languages } from "./locales";
import { coverTopics, filterCovers, stockCoverUrl, stockCovers } from "./covers";

export function Destination({ item, className = "op-button primary" }: { item: CatalogItem; className?: string }) {
  return item.actionUrl.startsWith("/") ? <Link href={item.actionUrl} className={className}>{item.actionLabel}<Icon name="arrow" size={16} /></Link> : <a href={item.actionUrl} className={className} target="_blank" rel="noopener noreferrer">{item.actionLabel}<Icon name="external" size={16} /></a>;
}
function Card({ item, returnQuery }: { item: CatalogItem; returnQuery: string }) {
  const href = `${BASE}/tasks/${item.id}${returnQuery ? "?" + returnQuery : ""}`;
  return <article className="op-card directory-card">
    <Link href={href} className="op-card-art" aria-label={"View " + item.title}><Illustration kind={item.art} /><span className="directory-kind">{item.kind === "Job" ? "Job / careers" : item.kind}</span></Link>
    <div className="op-card-body"><PlatformMark id={item.provider} /><h2><Link href={href}>{item.title}</Link></h2><p className="directory-card-summary">{item.summary}</p><div className="directory-card-facts"><span>{item.rewardLabel}</span><span>{item.deadline ? formatDate(item.deadline) : item.status === "Listed" ? "Check availability" : item.status}</span></div><LocaleSummary language={item.language} country={item.country} location={item.location} /><div className="directory-card-bottom"><span title={item.organizer}>{item.organizer}</span><Link href={href} aria-label={"Details for " + item.title}>Details <Icon name="arrow" size={15} /></Link></div></div>
  </article>;
}
function Listing({ catalog }: { catalog: Catalog }) {
  const params = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const current = new URLSearchParams(params.toString());
  const items = filterCatalog(catalog.items, current);
  const sort = params.get("sort") || "mixed";
  if (sort === "deadline") items.sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999"));
  if (sort === "reward") items.sort((a, b) => (b.rewardZec ?? -1) - (a.rewardZec ?? -1));
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete(key); else next.set(key, value);
    window.history.replaceState(null, "", BASE + (next.size ? "?" + next : ""));
  }
  const source = catalog.sources.find((s) => s.id === "zec-bounties");
  return <><Hero /><section className="op-listing-controls" aria-label="Find opportunities">
    <div className="listing-tools"><label className="op-search"><Icon name="search" size={17} /><input aria-label="Search opportunities" placeholder="Search opportunities" value={params.get("q") || ""} onChange={(e) => filter("q", e.target.value)} />{params.get("q") && <button type="button" onClick={() => filter("q", "")} aria-label="Clear search"><Icon name="close" size={15} /></button>}</label><button className="op-button" aria-expanded={showFilters} aria-controls="directory-filters" onClick={() => setShowFilters(!showFilters)}><Icon name="filter" size={16} />Filters</button><select className="op-sort-select" aria-label="Sort opportunities" value={sort} onChange={(e) => filter("sort", e.target.value)}><option value="mixed">Mixed order</option><option value="deadline">Closing soon</option><option value="reward">Highest ZEC reward</option></select></div>
    <div className="listing-meta"><div className="op-segment directory-types" aria-label="Opportunity type">{[["all", "All"], ["Bounty", "Bounties"], ["Quest", "Quests"], ["Job", "Jobs"], ["Test", "Testing"], ["Challenge", "Challenges"]].map(([value, label]) => <button key={value} aria-pressed={(params.get("type") || "all") === value} className={(params.get("type") || "all") === value ? "active" : ""} onClick={() => filter("type", value)}>{label}</button>)}</div><span className="directory-count" aria-live="polite">{items.length} {items.length === 1 ? "listing" : "listings"}</span></div>
    {showFilters && <div className="op-filters" id="directory-filters"><Field label="Platform"><select value={params.get("provider") || "all"} onChange={(e) => filter("provider", e.target.value)}><option value="all">All platforms</option>{platforms.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></Field><Field label="Language"><select value={params.get("language") || "all"} onChange={(e) => filter("language", e.target.value)}><option value="all">All languages</option>{languages.map((l) => <option value={l.code} key={l.code}>{l.name}</option>)}</select></Field><Field label="Country"><select value={params.get("country") || "all"} onChange={(e) => filter("country", e.target.value)}><option value="all">All countries</option>{countries.map((c) => <option value={c.code} key={c.code}>{c.name}</option>)}</select></Field><p className="directory-filter-note">Language and country appear only when supplied by the source.</p><button className="op-text" onClick={() => window.history.replaceState(null, "", BASE)}>Clear filters</button></div>}
  </section>
    {source?.status !== "available" && <p className="directory-source-status" role="status">{source?.status === "partial" ? "Some ZEC Bounties listings could not be refreshed." : "ZEC Bounties listings are temporarily unavailable."} <a href="https://bounties.zechub.wiki/" target="_blank" rel="noopener noreferrer">Browse the original board <Icon name="external" size={13} /></a></p>}
    {items.length ? <div className="op-grid">{items.map((item) => <Card key={item.id} item={item} returnQuery={params.toString()} />)}</div> : <Empty title="No matching opportunities"><p>Try another filter or explore the source platforms.</p><button className="op-button" onClick={() => window.history.replaceState(null, "", BASE)}>Clear filters</button></Empty>}
    <p className="directory-curation">Curated programs and careers, alongside public ZEC Bounties listings. Availability and requirements are confirmed on the source platform.</p>
  </>;
}
export function Detail({ item }: { item: CatalogItem }) {
  const params = useSearchParams();
  const platform = platformFor(item.provider);
  const guideUrl = item.kind === "Job" ? item.sourceUrl : platform.docs;
  return <article className="directory-detail-page" aria-labelledby="opportunity-title">
    <Link className="op-back" href={BASE + (params.size ? "?" + params : "")}><Icon name="left" size={16} />Back to opportunities</Link>
    <div className="directory-detail">
      <header className="directory-detail-heading directory-detail-tile">
        <div className="directory-detail-meta"><PlatformMark id={item.provider} /><span>{item.kind} · {item.category}</span></div>
        <h1 id="opportunity-title">{item.title}</h1>
        <p>{item.summary}</p>
      </header>
      <div className="directory-detail-cover"><Illustration kind={item.art} /></div>
      <aside className="directory-action-panel" aria-label="Participation">
        <span className="directory-eyebrow">{item.kind === "Job" ? "CAREERS" : "PARTICIPATE"}</span>
        <h2>{item.rewardLabel}</h2>
        <dl>
          <div><dt>Organizer</dt><dd>{item.organizer}</dd></div>
          {item.organizer !== platform.name && <div><dt>Platform</dt><dd>{platform.name}</dd></div>}
          {item.deadline && <div><dt>Deadline</dt><dd>{formatDate(item.deadline)}</dd></div>}
        </dl>
        <LocaleSummary language={item.language} country={item.country} location={item.location} />
        <Destination item={item} className="op-button primary full" />
        <p>{item.kind === "Job" ? "Apply directly through the employer’s instructions." : "Participation and rewards follow the source’s rules."}</p>
      </aside>
      <section className="directory-detail-body directory-detail-tile" aria-labelledby="opportunity-details">
        <h2 id="opportunity-details">Details</h2>
        <div className="directory-description"><ReactMarkdown components={{
          img: () => null,
          h1: ({ children }) => <h3>{children}</h3>,
          h2: ({ children }) => <h3>{children}</h3>,
          h3: ({ children }) => <h4>{children}</h4>,
          a: ({ href, children }) => href?.startsWith("https://") ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
        }}>{item.description}</ReactMarkdown></div>
      </section>
      <section className="directory-next-steps directory-detail-tile" aria-labelledby="opportunity-next-steps">
        <div className="directory-section-heading"><h2 id="opportunity-next-steps">Next steps</h2><a className="op-text" href={guideUrl} target={guideUrl.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer">Read the guide <Icon name="arrow" size={14} /></a></div>
        <ol className="directory-steps" role="list">{item.steps.map((step, index) => <li key={step}><span className="directory-step-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>)}</ol>
      </section>
      <footer className="directory-provenance"><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Original source <Icon name="external" size={14} /></a><span>Checked {formatDate(item.checkedAt)}</span>{item.sourceUpdatedAt && <span>Source updated {formatDate(item.sourceUpdatedAt)}</span>}</footer>
    </div>
  </article>;
}
function Platforms() {
  return <><Heading title="Meet the platforms" description="Find the right place to contribute or publish an activity." /><div className="directory-how"><span><b>01</b> Discover on OpenZcash</span><Icon name="arrow" size={18} /><span><b>02</b> Read the requirements</span><Icon name="arrow" size={18} /><span><b>03</b> Continue at the source</span></div><div className="directory-platform-grid">{platforms.map((p) => <article className="directory-platform-card" key={p.id}><div className="directory-platform-art"><Illustration kind={p.art} /></div><div><PlatformMark id={p.id} /><h2>{p.label}</h2><p>{p.description}</p><ol className="directory-steps">{p.steps.map((step) => <li key={step}>{step}</li>)}</ol><div className="directory-platform-actions"><a className="op-button" href={p.url} target="_blank" rel="noopener noreferrer">Visit {p.name}<Icon name="external" size={15} /></a>{(p.id === "gleyo" || p.id === "zec-bounties") && <Link className="op-text" href={BASE + "/prepare?provider=" + p.id}>Prepare a brief<Icon name="arrow" size={14} /></Link>}</div></div></article>)}</div></>;
}
function ArtLibrary() {
  const [query, setQuery] = useState(""), [topic, setTopic] = useState("All");
  const covers = filterCovers(query, topic);
  return <><Heading title="A cover for your next idea." description={`${stockCovers.length} matte paper illustrations. Download a cover to bring to your platform.`} /><div className="cover-filters"><label className="cover-search"><Icon name="search" size={17} /><input aria-label="Search artwork" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Wallets, testing, community…" /></label><select aria-label="Artwork topic" value={topic} onChange={(e) => setTopic(e.target.value)}><option value="All">All topics</option>{coverTopics.map((t) => <option key={t}>{t}</option>)}</select></div><p className="directory-art-count" aria-live="polite">{covers.length} {covers.length === 1 ? "cover" : "covers"}</p><div className="directory-art-grid">{covers.map((cover) => <article key={cover.id}><Illustration kind={cover.id} /><div><h2>{cover.name}</h2><p>{cover.topic}</p><a href={stockCoverUrl(cover.id)} download className="op-text" aria-label={"Download " + cover.name}>Download PNG<Icon name="arrowdown" size={15} /></a></div></article>)}</div>{!covers.length && <Empty title="No matching artwork"><button className="op-button" onClick={() => { setQuery(""); setTopic("All"); }}>Show all covers</button></Empty>}<p className="directory-curation">Artwork is illustrative. Use project branding only for activities that relate to that project.</p></>;
}
export function OpportunitiesRoutes({ catalog: incoming }: { catalog?: Catalog } = {}) {
  const path = usePathname(), params = useSearchParams(), catalog = useCatalog(incoming);
  if (path === BASE + "/prepare") return <Editor initialProvider={params.get("provider") === "gleyo" ? "gleyo" : params.get("provider") === "zec-bounties" ? "zec-bounties" : undefined} />;
  if (path === BASE + "/platforms") return <Platforms />;
  if (path === BASE + "/art") return <ArtLibrary />;
  if (path.startsWith(BASE + "/tasks/")) {
    const item = catalog.items.find((o) => o.id === path.split("/").pop());
    return item ? <Detail item={item} /> : <Empty title="This opportunity is no longer listed"><p>It may be assigned, closed or temporarily unavailable.</p><Link href={BASE} className="op-button">Explore opportunities</Link></Empty>;
  }
  return <Listing catalog={catalog} />;
}
