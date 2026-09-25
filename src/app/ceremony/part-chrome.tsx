import Link from "next/link";
import type { ReactNode } from "react";
import { neighbours, PARTS } from "@/lib/ceremony/parts";
import styles from "./ceremony.module.css";

/** Eyebrow, serif title and lede for a part (or the overview). */
export function PartHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <header className={styles.head}>
      <div className={styles.eyebrow}>{eyebrow}</div>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.lede}>{children}</p>
    </header>
  );
}

/** "Part III · Denver station" style eyebrow for a part slug. */
export function partEyebrow(slug: string, extra?: string): string {
  const part = PARTS.find((p) => p.slug === slug);
  return [part ? `Part ${part.numeral}` : null, extra]
    .filter(Boolean)
    .join(" · ");
}

/** Previous and next part, at the foot of every part. */
export function Pager({ slug }: { slug: string }) {
  const { prev, next } = neighbours(slug);
  return (
    <nav aria-label="Parts of the Zcash Ceremony" className={styles.pager}>
      {prev ? (
        <Link href={prev.href}>
          <span>Previous</span>
          <strong>← {prev.label}</strong>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next.href}>
          <span>Next</span>
          <strong>{next.label} →</strong>
        </Link>
      ) : null}
    </nav>
  );
}
