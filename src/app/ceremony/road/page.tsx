import { CHAPTERS } from "@/lib/ceremony/story";
import { Pager, PartHeader, partEyebrow } from "../part-chrome";
import styles from "../ceremony.module.css";

export const metadata = {
  title: "The road to Zcash · Zcash Ceremony · OpenZcash",
  description:
    "The forty years before the Zcash genesis block: Chaum's blind signatures, the cypherpunks, Hashcash and bit gold, Bitcoin, Zerocoin and Zerocash, and the 2016 ceremony.",
};

export default function RoadPage() {
  return (
    <div className={styles.page}>
      <PartHeader
        eyebrow={partEyebrow("road", "1982 to 2016")}
        title="The road to Zcash"
      >
        Private electronic cash is an old idea. It took four decades of
        cryptography, a mailing list, a transparent Bitcoin and two papers
        before six witnesses could launch it.
      </PartHeader>

      <div>
        {CHAPTERS.map((c) => (
          <article
            key={c.id}
            id={c.id}
            className={styles.chapter}
            aria-labelledby={`${c.id}-title`}
          >
            <div className={styles.era}>{c.era}</div>
            <div className={styles.chapterBody}>
              <h2 id={`${c.id}-title`} className={styles.h2}>
                {c.title}
              </h2>
              <div className={styles.who}>{c.who}</div>
              {c.text.map((t) => (
                <p key={t.slice(0, 32)}>{t}</p>
              ))}
              {c.links ? (
                <div className={styles.links}>
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
      </div>

      <Pager slug="road" />
    </div>
  );
}
