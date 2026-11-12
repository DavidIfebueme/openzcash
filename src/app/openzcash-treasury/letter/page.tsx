import localFont from "next/font/local";
import Link from "next/link";
import { CommunityCredit } from "@/components/community-credit";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { COMMUNITY_DISCUSSION, TREASURY_PATH, openLetter, treasuryCopy } from "@/lib/openzcash-treasury/content";
import styles from "../treasury.module.css";
import { emphasize } from "./emphasis";

export const metadata = pageMetadata({
  title: "An open letter to the Zcash community · OpenZcash",
  description: "The next chapter for OpenZcash: open source, voluntary donations, a public treasury and an invitation to contribute.",
  path: `${TREASURY_PATH}/letter`,
});

/**
 * The title and the signature are set in the serif bundled for the Ceremony pages. It is loaded
 * from that folder so the repository keeps one copy of the file and its license.
 */
const serif = localFont({
  src: "../../ceremony/fonts/cormorant-garamond.woff2",
  weight: "500 600",
  style: "normal",
  variable: "--font-letter",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

const t = treasuryCopy;

export default function OpenLetterPage() {
  return <div className={`${styles.page} ${styles.letterPage} ${serif.variable}`}>
    <div className={styles.topline}><Link href={TREASURY_PATH} className={styles.textLink}>← {t.return}</Link></div>
    <article className={styles.letter}>
      <header><h1>{openLetter.title}</h1><p className={styles.lead}>{openLetter.lead}</p></header>
      {openLetter.sections.map((section) => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{emphasize(paragraph)}</p>)}</section>)}
      <p className={styles.signature}><span>{t.signOff}</span><span className={styles.signatureName}>Michae2xl</span></p>
    </article>
    <div className={styles.letterAfter}>
      <aside className={styles.letterStatus}><strong>{t.preparing}</strong><p>{t.sourceNote} {t.pendingNote}</p></aside>
      <nav className={styles.references} aria-label={t.references}><h2>{t.references}</h2><Link href="/zarvis/about">Zarvis ↗</Link><Link href="/zcg/copilot">ZCG Copilot ↗</Link><Link href="/funding-history">Since block zero ↗</Link><Link href="/governance">Governance ↗</Link></nav>
      <div className={styles.actions}><Link className={styles.primary} href={TREASURY_PATH}>OpenZcash Treasury <span aria-hidden="true">→</span></Link><a className={styles.textLink} href={COMMUNITY_DISCUSSION} target="_blank" rel="noopener noreferrer">{t.discuss} ↗</a></div>
    </div>
    <CommunityCredit screen="openzcash-treasury" />
  </div>;
}
