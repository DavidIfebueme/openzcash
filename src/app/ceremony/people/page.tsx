import Link from "next/link";
import {
  AUTHORS,
  LINEAGE,
  OBSERVER,
  PAPERS,
  WITNESSES,
  initials,
} from "@/lib/ceremony/people";
import { Pager, PartHeader, partEyebrow } from "../part-chrome";
import styles from "../ceremony.module.css";

export const metadata = {
  title: "The people · Zcash Ceremony · OpenZcash",
  description:
    "The six witnesses of the 2016 Zcash ceremony and their pseudonyms, the authors of Zerocoin and Zerocash, and the cypherpunk lineage behind them.",
};

function Sources({ links }: { links: { label: string; href: string }[] }) {
  return (
    <span className={styles.links}>
      {links.map((l) => (
        <a key={l.href} href={l.href} target="_blank" rel="noreferrer">
          {l.label} ↗
        </a>
      ))}
    </span>
  );
}

export default function PeoplePage() {
  return (
    <div className={styles.page}>
      <PartHeader eyebrow={partEyebrow("people")} title="The people">
        Three witnesses were named to the other participants from the start and
        to the public three days after the ceremony. Three ran under pseudonyms
        Zooko Wilcox invented so nobody could target them during the ceremony,
        and the last of those stayed hidden until 2022.
      </PartHeader>

      <section className={styles.section} aria-labelledby="witnesses">
        <div className={styles.sectionHead}>
          <h2 id="witnesses" className={styles.h2}>
            The six witnesses
          </h2>
          <span className={styles.note}>October 22–23, 2016</span>
        </div>
        <div className={`${styles.card} ${styles.wrap}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Witness</th>
                <th>Known then as</th>
                <th className={styles.hideSm}>Role</th>
                <th className={styles.hideSm}>Public since</th>
                <th>Sources</th>
              </tr>
            </thead>
            <tbody>
              {WITNESSES.map((w) => (
                <tr key={w.name}>
                  <td>
                    <strong>{w.name}</strong>
                  </td>
                  <td>{w.knownAs ? `“${w.knownAs}”` : "Own name"}</td>
                  <td className={styles.hideSm}>{w.role}</td>
                  <td className={styles.hideSm}>{w.public}</td>
                  <td>
                    <Sources links={w.sources} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={`${styles.card} ${styles.person}`}>
          <span className={styles.avatar} aria-hidden="true">
            {initials(OBSERVER.name)}
          </span>
          <span className={styles.personText}>
            <span className={styles.personName}>{OBSERVER.name}</span>
            <span className={styles.muted}>{OBSERVER.role}.</span>
            <Sources links={OBSERVER.sources} />
          </span>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="authors">
        <div className={styles.sectionHead}>
          <h2 id="authors" className={styles.h2}>
            Zerocoin and Zerocash
          </h2>
          <span className={styles.note}>
            2013 and 2014 · Zerocoin, then Zerocash, which Zcash implements
          </span>
        </div>
        <div className={styles.grid}>
          {AUTHORS.map((a) => (
            <div key={a.name} className={`${styles.card} ${styles.person}`}>
              <span className={styles.avatar} aria-hidden="true">
                {initials(a.name)}
              </span>
              <span className={styles.personText}>
                <span className={styles.personName}>{a.name}</span>
                <span className={styles.links}>
                  {a.papers.map((p) => (
                    <a
                      key={p}
                      href={PAPERS[p].href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {p} ↗
                    </a>
                  ))}
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="lineage">
        <div className={styles.sectionHead}>
          <h2 id="lineage" className={styles.h2}>
            Before Zcash
          </h2>
          <span className={styles.note}>1982 to 2016 · told in Part I</span>
        </div>
        <div className={styles.grid}>
          {LINEAGE.map((l) => (
            <Link
              key={l.name}
              href={`/ceremony/road#${l.chapter}`}
              className={`${styles.card} ${styles.person}`}
            >
              <span className={styles.avatar} aria-hidden="true">
                {initials(l.name)}
              </span>
              <span className={styles.personText}>
                <span className={styles.personName}>{l.name}</span>
                <span className={styles.muted}>{l.note}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <Pager slug="people" />
    </div>
  );
}
