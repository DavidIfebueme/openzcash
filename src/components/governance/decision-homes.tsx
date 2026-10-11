import Link from "next/link";
import styles from "./decision-homes.module.css";

/**
 * Each kind of Zcash decision lives with the body that takes it. Every
 * decision page says who decides at the top and links the other homes at the
 * bottom, so a visitor who looks in the wrong place is one click away.
 */
export type DecisionHome = "committee" | "elections" | "fund" | "network";

const HOMES: { id: DecisionHome; who: string; what: string; href: string }[] = [
  {
    id: "committee",
    who: "ZCG committee",
    what: "Grant verdicts",
    href: "/zcg/participate?view=history",
  },
  {
    id: "elections",
    who: "ZCAP",
    what: "Committee elections",
    href: "/zcg/committee#elections",
  },
  {
    id: "fund",
    who: "Coinholders and key-holders",
    what: "Coinholder grants votes",
    href: "/coinholders",
  },
  {
    id: "network",
    who: "ZIP process and coinholder polls",
    what: "Network upgrades and polls",
    href: "/governance",
  },
];

/** "Decided by …" marker for a page header. */
export function DecidedBy({ who, how }: { who: string; how?: string }) {
  return (
    <p className={styles.decidedBy}>
      <span className={styles.label}>Decided by</span>
      <strong>{who}</strong>
      {how ? <span className={styles.how}>{how}</span> : null}
    </p>
  );
}

/** The four homes of Zcash decisions, with the current one marked. */
export function DecisionHomes({ current }: { current: DecisionHome }) {
  return (
    <nav aria-label="Who decides what" className={styles.homes}>
      <p className={styles.title}>Who decides what</p>
      <ul>
        {HOMES.map((h) => (
          <li key={h.id}>
            {h.id === current ? (
              <div className={styles.home} data-current aria-current="page">
                <span className={styles.who}>{h.who}</span>
                <span className={styles.what}>{h.what}</span>
                <span className={styles.here}>This page</span>
              </div>
            ) : (
              <Link href={h.href} className={styles.home}>
                <span className={styles.who}>{h.who}</span>
                <span className={styles.what}>{h.what} →</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
