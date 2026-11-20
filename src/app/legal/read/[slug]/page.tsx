import Image from "next/image";
import { notFound } from "next/navigation";
import { ProposalMarkdown } from "@/components/participate/workspace/proposal-markdown";
import styles from "@/components/legal/reader.module.css";
import { ReadingLink } from "@/components/legal/reading-link";
import { isReadingLanguage, legalDate, readingLanguages } from "@/lib/legal/presentation";
import { brazilDeskName, brazilReports, forumReadings, readingPath } from "@/lib/legal/readings";
import { pageMetadata } from "@/lib/seo/page-metadata";
type Report = {
  title: string;
  subtitle: string;
  sections: { heading: string; blocks: (string | { image: string; caption: string; width: number; height: number })[] }[];
};

// Edition keys come exclusively from the reviewed report catalog.
async function loadEdition(key: string): Promise<Report> {
  return (await import(`../../../../../data/legal/reports/${key}.json`)).default;
}

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props) {
  const { slug } = await params;
  const report = brazilReports.find(entry => entry.item.id === slug);
  const item = report?.item ?? forumReadings.find(post => post.item.id === slug)?.item;
  if (!item) return {};
  const en = report?.record.english && (await searchParams).lang === "en";
  return pageMetadata({ title: (en ? (await loadEdition(report.record.english)).title : item.portugueseTitle ?? item.title) + " · OpenZcash", description: item.summary,
    path: readingPath(item) + (en ? "?lang=en" : "") });
}

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const filters = new URLSearchParams();
  for (const key of ["q", "region", "source", "topic", "language"]) {
    const value = query[key];
    if (typeof value === "string" && value) filters.set(key, value);
  }
  const suffix = filters.size ? "?" + filters : "";
  const back = "/legal" + suffix + "#updates";
  const entry = brazilReports.find(entry => entry.item.id === slug);
  if (!entry) {
    const post = forumReadings.find(entry => entry.item.id === slug);
    if (!post) notFound();
    return <article className={styles.reader}>
      <a className={styles.back} href={back}>← Privacy &amp; Policy</a>
      <header className={styles.heading}>
        <p className={styles.label}>Zcash Community Forum · Policy discussion</p>
        <h1>{post.item.title}</h1>
        <p>{post.source.author} (@{post.source.username}) · <time dateTime={post.source.posted}>{legalDate(post.source.posted)}</time></p>
        <a href={post.item.url} target="_blank" rel="noopener noreferrer">Open original post ↗</a>
      </header>
      <div className={styles.prose}><ProposalMarkdown>{post.source.markdown}</ProposalMarkdown></div>
      <footer className={styles.signature}>
        <span className={styles.creditLabel}>Posted by</span>
        <strong>{post.source.author}</strong>
        <a href={`https://forum.zcashcommunity.com/u/${encodeURIComponent(post.source.username)}`} target="_blank" rel="noopener noreferrer">Zcash Community Forum ↗</a>
      </footer>
    </article>;
  }

  const { record, item } = entry;
  const isEnglish = Boolean(record.english) && query.lang === "en";
  const originalLanguage = isReadingLanguage(record.originalLanguage) ? record.originalLanguage : undefined;
  const pdfLabel = isEnglish ? "Original PDF" : "PDF original";
  const report = await loadEdition(isEnglish ? record.english : record.portuguese);
  const enParams = new URLSearchParams(filters);
  enParams.set("lang", "en");
  const path = readingPath(item);
  return <article className={styles.reader} lang={isEnglish ? "en" : "pt-BR"}>
    <a className={styles.back} href={back} lang="en">← Privacy &amp; Policy</a>
    <header className={styles.heading}>
      <p className={styles.label}>{brazilDeskName} · {isEnglish ? "Country report" : "Relatório"}</p>
      <h1>{report.title}</h1>
      <p>{report.subtitle}</p>
      <p>{isEnglish ? "By" : "Por"} {record.author} · {record.byline}</p>
      <div className={styles.actions}>
        <nav aria-label={isEnglish ? "Report language" : "Idioma do relatório"}>
          <a href={path + suffix} hrefLang="pt-BR" lang="pt-BR" aria-current={!isEnglish ? "page" : undefined}>{readingLanguages.pt.name} <span aria-hidden="true">{readingLanguages.pt.flag}</span></a>
          {record.english && <a href={path + "?" + enParams} hrefLang="en" lang="en" aria-current={isEnglish ? "page" : undefined}>{readingLanguages.en.name} <span aria-hidden="true">{readingLanguages.en.flag}</span></a>}
        </nav>
        <ReadingLink href={record.original} external language={originalLanguage}
          label={originalLanguage ? pdfLabel + " (" + originalLanguage.toUpperCase() + ")" : pdfLabel}/>
      </div>
    </header>
    <div className={styles.layout}>
      <nav className={styles.contents} aria-label={isEnglish ? "Contents" : "Índice"}>
        <h2>{isEnglish ? "Contents" : "Índice"}</h2>
        <ol>{report.sections.map((section, index) => <li key={section.heading}><a href={"#section-" + (index + 1)}>{section.heading}</a></li>)}</ol>
      </nav>
      <div className={styles.prose}>{report.sections.map((section, index) => <section key={section.heading} id={"section-" + (index + 1)}>
        <h2>{section.heading}</h2>
        {section.blocks.map((block, i) => typeof block === "string" ? <p key={i}>{block}</p> :
          <figure key={i}>
            <a href={block.image} target="_blank" rel="noopener noreferrer"><Image src={block.image} alt={block.caption} width={block.width} height={block.height} unoptimized/></a>
            <figcaption>{block.caption}</figcaption>
          </figure>)}
      </section>)}
        {record.reference && <aside className={styles.references}><h2>{isEnglish ? "Official reference" : "Referência oficial"}</h2>
          <a href={record.reference} target="_blank" rel="noopener noreferrer">{record.referenceLabel} ↗</a>
        </aside>}
        <footer className={styles.signature}>
          <Image className={styles.watermark} src={record.watermark} alt="" width={128} height={128} unoptimized/>
          <span className={styles.creditLabel}>{isEnglish ? "Written by" : "Escrito por"}</span>
          <strong>{record.author}</strong>
          <nav aria-label={isEnglish ? "Author’s social profiles" : "Redes sociais da autora"}>
            {record.socials.map(profile => (
              <a key={profile.url} href={profile.url} target="_blank" rel="noopener noreferrer">
                <span aria-hidden="true" className={styles.socialIcon} style={{ maskImage: `url(${profile.icon})` }}/>
                {profile.label}<span aria-hidden="true">&nbsp;↗</span>
              </a>
            ))}
          </nav>
        </footer>
      </div>
    </div>
  </article>;
}
