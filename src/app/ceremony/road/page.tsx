import { CHAPTERS } from "@/lib/ceremony/story";
import { Pager, PartHeader, partEyebrow } from "../part-chrome";
import styles from "../ceremony.module.css";

export const metadata = {
  title: "The road to the genesis block · Zcash Ceremony · OpenZcash",
  description:
    "A short documentary of the forty years before the Zcash genesis block: Chaum's blind signatures, the cypherpunks, Hashcash and bit gold, Bitcoin, Zerocoin and Zerocash, and the 2016 ceremony.",
};

export default function RoadPage() {
  return (
    <div className={styles.page}>
      <PartHeader
        eyebrow={partEyebrow("road", "A mini documentary")}
        title="The road to the genesis block"
      >
        Zcash did not begin in 2016. It began in 1982, with a cryptographer who
        thought money should not report on its owner, and passed through every
        hand that tried to build it before the technology was ready.
      </PartHeader>

      <section className={styles.film} aria-label="Six chapters">
        {CHAPTERS.map((c, i) => (
          <article
            key={c.id}
            id={c.id}
            className={styles.filmChapter}
            aria-labelledby={`${c.id}-title`}
          >
            <div>
              <div className={styles.chapterNo}>
                Chapter {String(i + 1).padStart(2, "0")}
              </div>
              <div className={styles.filmEra}>{c.era}</div>
              <div className={styles.filmWho}>{c.who}</div>
            </div>
            <div className={styles.filmBody}>
              <h2 id={`${c.id}-title`} className={styles.filmTitle}>
                {c.title}
              </h2>
              {c.text.map((t) => (
                <p key={t.slice(0, 32)}>{t}</p>
              ))}
              {c.links ? (
                <div className={styles.filmLinks}>
                  {c.links.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {l.label} ↗
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        ))}
        <p className={styles.dedication}>
          In memory of Hal Finney (1956–2014), the first to run Bitcoin after its creator.
        </p>
      </section>

      <Pager slug="road" />
    </div>
  );
}
