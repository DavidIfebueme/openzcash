import Image from "next/image";
import { Suspense } from "react";
import { brazilDeskName, brazilReports, forumReadings, readingPath, withLegalReadings } from "@/lib/legal/readings";
import type { LegalFeed, LegalItem } from "@/lib/legal/types";
import { legalDate, legalItemDate } from "@/lib/legal/presentation";
import { ReadingLink } from "./reading-link";
import { LegalNewsroom } from "./newsroom";
import styles from "./legal.module.css";

const PGP_JOIN_URL = "https://community.pgpz.org/signin?callbackUrl=%2F&reason=signup";

type EditionProps = {
  id: string;
  source: string;
  contributor: string;
  mark: string;
  item: LegalItem;
  lang: "pt-BR" | "en";
  collection: string;
  alternate?: { label: string; href: string };
};

function Edition({ id, source, contributor, mark, item, lang, collection, alternate }: EditionProps) {
  const path = readingPath(item);
  return <section id={id} className={styles.edition} aria-labelledby={id + "-title"}>
    <header className={styles.imprint}>
      <div className={styles.mark}><Image src={mark} alt="" width={80} height={56} unoptimized/></div>
      <div><h2 id={id + "-title"}>{source}</h2><p>{contributor}</p></div>
    </header>
    <div className={styles.editionBody}>
      <div className={styles.dateline}><span>{item.kind}</span><time dateTime={item.publishedAt}>{legalItemDate(item)}</time></div>
      <h3 lang={lang}><a href={path}>{item.title}</a></h3>
      <p>{item.summary}</p>
      <div className={styles.readActions}>
        <ReadingLink href={path} language={lang === "pt-BR" ? "pt" : "en"} label={lang === "pt-BR" ? "Ler em português" : "Read in English"}/>
        {alternate && <ReadingLink href={alternate.href} language="en" label={alternate.label} external={alternate.href.startsWith("https://")}/>}
      </div>
    </div>
    <a className={styles.collection} href={"/legal?source=" + item.sourceId + "#updates"}>{collection}<span aria-hidden="true">→</span></a>
  </section>;
}

export function LegalPage({ feed: archive }: { feed: LegalFeed }) {
  const { item: brazilReport, record } = brazilReports[0];
  const forum = forumReadings[0];
  const feed = withLegalReadings(archive);
  const latest = feed.items.filter(item => item.sourceId === "pgp").sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];
  const health = feed.sourceHealth ?? [{ sourceId: "pgp", status: feed.pgpStatus, lastSuccessAt: feed.pgpLastSuccessAt }];
  return <div className={styles.page}>
    <header className={styles.masthead}>
      <h1>Privacy &amp; Policy</h1>
      <p>Country reports, community analysis and official updates on financial privacy.</p>
    </header>
    <div className={styles.editions}>
      <Edition id="pgp" source="Pretty Good Policy for Zcash" contributor={forum.source.author} mark="/logos/pgpz.png"
        item={forum.item} lang="en" collection="All forum readings"
        alternate={{ label: "Forum original", href: forum.item.url }}/>
      <Edition id="brasil" source={brazilDeskName} contributor={record.author} mark="/legal/brasil/zcash-brasil.webp"
        item={brazilReport} lang="pt-BR" collection={`All ${brazilDeskName} reports`}
        alternate={record.english ? { label: "English", href: readingPath(brazilReport) + "?lang=en" } : undefined}/>
    </div>
    <section id="updates" className={styles.updates} aria-labelledby="updates-title">
      <div className={styles.sectionHeading}><h2 id="updates-title">Updates</h2></div>
      <Suspense fallback={<p>Loading filters…</p>}><LegalNewsroom feed={feed}/></Suspense>
    </section>
    <details className={styles.sources}><summary>Sources &amp; coverage <span aria-hidden="true">+</span></summary>
      <div className={styles.sourceContent}><p>Daily collection covers the PGPZ public archive, Banco Central do Brasil, Argentina’s AAIP and Uruguay’s URCDP. Reviewed documents add context from other authorities. Publication, update, memo period and application dates stay separate.</p>
      {feed.archive && <p><strong>Daily collection:</strong> {feed.archive.status === "available" && feed.archive.lastCollectedAt ? `Public-source history is stored. Last successful collection: ${legalDate(feed.archive.lastCollectedAt)} (São Paulo calendar).` : "The daily archive is not available in this environment. Reviewed source records remain visible."}</p>}
      {health.map(health => <p key={health.sourceId}><strong>{feed.sources.find(source => source.id === health.sourceId)?.name ?? health.sourceId}:</strong> {health.status === "live" ? "Public feed retrieved successfully." : health.status === "cached" ? "Temporarily unavailable. Showing the last successful retrieval." : "Could not refresh. Reviewed records remain available."}{health.lastSuccessAt ? ` Last successful read: ${legalDate(health.lastSuccessAt)}.` : ""}</p>)}
      <p>The daily collector retrieves public metadata. Contributor reports and selected forum posts have reading copies on OpenZcash. Undated PGPZ reports remain available on its public archive. PGPZ provides independent analysis; it does not speak for regulators.</p>
      <p>Memos and reports are public. <a href={PGP_JOIN_URL} target="_blank" rel="noopener noreferrer">Join PGP by email ↗</a> · <a href="https://pgpz.org/" target="_blank" rel="noopener noreferrer">About PGP ↗</a>{latest && <> · <a href={latest.url} target="_blank" rel="noopener noreferrer">{legalItemDate(latest)} · {latest.title} ↗</a></>}</p>
      <ul>{feed.sources.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.name} ↗</a><span>{source.role} · {source.mode === "live" ? "Public feed + reviewed records" : "Reviewed documents"}</span></li>)}</ul>
      <p>Coverage is selective. Status labels summarize dated source documents; they do not replace legal advice or establish Zcash’s legality in every jurisdiction.</p></div>
    </details>
  </div>;
}
