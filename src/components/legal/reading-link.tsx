import { readingLanguages } from "@/lib/legal/presentation";
import type { ReadingLanguage } from "@/lib/legal/types";
import styles from "./legal.module.css";

export function ReadingLink({ href, language, label, external = false }: {
  href: string; language?: ReadingLanguage; label?: string; external?: boolean;
}) {
  const edition = language && readingLanguages[language];
  return <a className={styles.readingLink} href={href} hrefLang={language}
    target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
    {external && <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 4h6v6m0-6L10 14M10 5H5v14h14v-5"/></svg>}
    {label ?? edition?.name ?? "Open source"}
    {external && <span className={styles.srOnly}> (opens in a new tab)</span>}
    {edition && <span aria-hidden="true">{edition.flag}</span>}
  </a>;
}
