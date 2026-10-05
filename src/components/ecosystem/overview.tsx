import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Catalog } from "@/lib/ecosystem/types";
import { buildEcosystemOverview } from "@/lib/ecosystem/overview";
import { countWorkAreas, workAreaHref } from "@/lib/ecosystem/work-areas";
import { historyIdentities } from "@/lib/project-history/identities";
import { classifyRepositories, displayDate, safeExternalUrl } from "@/lib/ecosystem/catalog";
import { COMMUNITIES, COMMUNITIES_VERIFIED_ON } from "@/lib/communities/data";
import { readHistoryIndex } from "@/lib/project-history/data";
import { APPS, childAppsOf } from "@/lib/design-routes";
import { BrandMark, CategoryIcon } from "./identity";
import { repositoryBrand } from "./branding";
import { OverviewPulse } from "./overview-pulse";
import { RepositoryFreshness } from "@/components/project-history/freshness";
import styles from "./overview.module.css";

const catalogHref = (values: Record<string, string> = {}) => `/ecosystem?${new URLSearchParams({ view: "catalog", ...values })}`;

async function EvidenceOverview() {
  const index = await readHistoryIndex();
  const total = index.items.length;
  const rows = [
    { label: "With grant records", detail: "Open the funding trail", view: "funding", value: index.coverage.proposalsAvailable ? index.items.filter(item => item.insights.grants > 0).length : null },
    { label: "With public work", detail: "Releases, reports and other work", view: "public-work", value: index.items.filter(item => item.insights.publicWorkSources > 0).length },
    { label: "With acceptance gaps", detail: "Paid entries needing acceptance evidence", view: "acceptance", value: index.coverage.paymentsAvailable ? index.items.filter(item => (item.insights.acceptanceGaps ?? 0) > 0).length : null },
  ];
  return <section className={styles.evidence} aria-labelledby="evidence-title">
    <div className={styles.sectionHeading}><div><span className={styles.kicker}>Before forming a view</span><h2 id="evidence-title">Follow the evidence</h2><p>Coverage across {total} project and community histories.</p></div><Link href="/ecosystem/history">All histories <span aria-hidden="true">↗</span></Link></div>
    <div className={styles.evidenceGrid}>{rows.map(row => <Link key={row.view} className={styles.evidenceItem} href={row.value === null ? "/ecosystem/history" : `/ecosystem/history?view=${row.view}`} prefetch={false}>
      <div><strong>{row.value ?? "—"}<small>histories</small></strong><span aria-hidden="true">↗</span></div><h3>{row.label}</h3><p>{row.value === null ? "Financial source unavailable" : row.detail}</p>
      <div className={styles.miniTrack} aria-hidden="true"><span style={{width:`${row.value !== null && total ? row.value / total * 100 : 0}%`}}/></div>
    </Link>)}</div>
    <div className={styles.evidenceFoot}><p>These groups overlap. Missing evidence is a research gap, not a finding of non-delivery.</p><span>Ledger import: {index.ledgerImportedAt ? displayDate(index.ledgerImportedAt) : "unavailable"}</span></div>
  </section>;
}

export function EcosystemOverview({ catalog }: { catalog: Catalog }) {
  const overview = buildEcosystemOverview(catalog);
  const repositories = classifyRepositories(catalog);
  const organizations = childAppsOf(APPS.find(app => app.id === "ecosystem")!).filter(app => app.parentGroup !== "pages");
  const histories = historyIdentities(catalog);
  const areas = countWorkAreas(histories).sort((a, b) => b.count - a.count || a.area.localeCompare(b.area));
  const maxCategory = Math.max(1, ...areas.map(item => item.count));
  return <div className={styles.page}>
    <header className={styles.hero}><div><h1>Ecosystem insights</h1><p>Activity, releases and evidence across the projects we track.</p></div><Link className={styles.primary} href={catalogHref()}>Browse projects <span aria-hidden="true">↗</span></Link></header>
    <div className={styles.freshness}><span>Code snapshot <b>{displayDate(overview.snapshotAt)}</b></span><span>Registry baseline <b>{displayDate(overview.registryCheckedAt)}</b></span><a href="#overview-sources">Coverage & sources ↓</a></div>
    <RepositoryFreshness snapshotAt={overview.snapshotAt} asOf={new Date().toISOString()}/>
    <div className={styles.topGrid}>
      <OverviewPulse windows={overview.windows}/>
      <section className={styles.scope} aria-labelledby="tracked-title"><h2 id="tracked-title">What we track</h2>
        <Link href={catalogHref()}><strong>{overview.counts.projects}</strong><span>projects & components</span><i aria-hidden="true">↗</i></Link>
        <Link href={catalogHref()+"#organizations"}><strong>{overview.counts.organizations}</strong><span>teams & accounts</span><i aria-hidden="true">↗</i></Link>
        <Link href="/communities"><strong>{COMMUNITIES.length}</strong><span>community groups</span><i aria-hidden="true">↗</i></Link>
        <p>Mapped records, with room for more.</p>
      </section>
    </div>
    <div className={styles.releaseSummary}><span><b>{overview.projectsWithReleases30d}</b> projects with release records in 30 days</span><span><b>{overview.stableReleaseCount30d}</b> releases <i>·</i> <b>{overview.prereleaseCount30d}</b> previews</span><a href="#latest-releases">Inspect releases ↓</a></div>
    <div className={styles.detailsGrid}>
      <section className={styles.releases} aria-labelledby="latest-releases"><div className={styles.sectionHeading}><div><h2 id="latest-releases">Latest releases</h2><p>Most recent per repository · past 30 days</p></div><Link href="/development">Development ↗</Link></div>
        <div className={styles.releaseList}>{overview.recentReleases.map(release => {
          const repo = repositories.find(item => item.id === release.repositoryId);
          const projects = catalog.registry.projects.filter(project => release.projectIds.includes(project.id));
          const single = projects.length === 1 ? projects[0] : null;
          const href = single ? `/ecosystem/history/${single.id}?section=timeline` : catalogHref({q:release.repository});
          return <article className={styles.release} key={release.url}>
            <Link className={styles.releaseIdentity} href={href}><BrandMark brand={repo ? repositoryBrand(repo) : null} category={repo?.category ?? "Other"} compact/><div><h3>{single?.name ?? release.repository}</h3><span>{release.repository}</span></div></Link>
            <div className={styles.releaseMeta}><a href={safeExternalUrl(release.url) ?? href} target="_blank" rel="noopener noreferrer" title={`Open ${release.tagName} release source`}><b>{release.tagName}</b><span aria-hidden="true">↗</span></a><div><span className={styles.releaseBadge} data-preview={release.isPrerelease}>{release.isPrerelease ? "Preview" : "Release"}</span><time dateTime={release.publishedAt}>{displayDate(release.publishedAt)}</time></div></div>
          </article>;
        })}</div>
        {!overview.recentReleases.length && <p className={styles.empty}>No release records found for linked project repositories in this window.</p>}
        <p className={styles.caption}>Published artifacts are evidence of a release, not proof of adoption or milestone acceptance.</p>
      </section>
      <section className={styles.areas} aria-labelledby="areas-title"><div className={styles.sectionHeading}><div><h2 id="areas-title">Areas of work</h2><p>{histories.length} projects & communities</p></div></div>
        <div className={styles.areaList}>{areas.map(item => <Link className={styles.area} key={item.area} href={workAreaHref(item.area)}>
          <div><span><CategoryIcon category={item.category}/>{item.area}</span><b>{item.count}</b></div><div className={styles.areaTrack} aria-hidden="true"><span style={{width:`${item.count/maxCategory*100}%`}}/></div>
        </Link>)}</div>
        <p className={styles.caption}>Grouped by primary purpose. Each project or community appears once.</p>
      </section>
    </div>
    <Suspense fallback={<section className={styles.evidence} aria-busy="true"><h2>Follow the evidence</h2><p className={styles.empty} role="status">Loading project and community records…</p></section>}><EvidenceOverview/></Suspense>
    <section className={styles.explore} aria-labelledby="explore-title"><div className={styles.sectionHeading}><div><h2 id="explore-title">Explore the ecosystem</h2></div></div>
      <div className={styles.destinations}>
        {[{href:"/wallets",title:"Wallets",text:"Compare features & platforms",logo:"/logos/glyphs/wallets.png"},{href:"/development",title:"Development",text:`${overview.counts.repositories} repositories in the inventory`,logo:"/logos/glyphs/development.png"},{href:"/arborist",title:"Arborist Calls",text:"Protocol discussions & recordings",logo:"/logos/arborist.png"},{href:"/communities",title:"Communities",text:"Local activity & public reports",logo:"/logos/communities.png"}].map(item=><Link href={item.href} className={styles.destination} key={item.href}><Image src={item.logo} alt="" width={28} height={28} unoptimized/><div><h3>{item.title}</h3><p>{item.text}</p></div><span aria-hidden="true">↗</span></Link>)}
      </div>
      <h3 className={styles.orgLabel}>Organizations</h3><div className={styles.organizations}>{organizations.map(app => <Link key={app.id} href={app.href}>{app.logo && <Image src={app.logo} alt="" width={25} height={25} unoptimized/>}<span>{app.label}</span><i aria-hidden="true">↗</i></Link>)}</div>
    </section>
    <details className={styles.sources} id="overview-sources"><summary>Coverage & sources <span aria-hidden="true">+</span></summary><div className={styles.sourceBody}>
      <p><b>Code activity.</b> Non-fork repositories in the wider inventory, measured on their default branches. Shared repositories may contain work outside Zcash; commits are not a delivery score. {overview.counts.projectRepositories} unique repositories are linked to catalog projects.</p>
      <p><b>Releases.</b> Only repositories linked to catalog projects, excluding forks, archived and disabled repositories. Release records are deduplicated by source; a shared repository may relate to several projects. The feed shows one record per repository. Previews are labeled separately.</p>
      <p><b>Areas of work.</b> Project histories and community groups share one identity list; ZecHub is counted once. Community and Education are combined for browsing, while their original categories and community membership stay separate.</p>
      <p><b>Evidence.</b> Funding, public work and milestone acceptance are independent records. Shared grants are not added into an ecosystem funding total. The registry baseline is {displayDate(overview.registryCheckedAt)}; individual records can have later review dates. Community directory links were checked {displayDate(COMMUNITIES_VERIFIED_ON)}.</p>
      <div><a href="/api/ecosystem" target="_blank" rel="noopener noreferrer">Catalog snapshot JSON ↗</a><a href="/api/project-history" target="_blank" rel="noopener noreferrer">Project history index JSON ↗</a><Link href="/zcg/methodology">Funding methodology ↗</Link></div>
    </div></details>
  </div>;
}
