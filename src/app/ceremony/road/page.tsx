import { Fragment } from "react";
import { clock } from "@/lib/ceremony/recordings";
import { CHAPTERS, type Chapter } from "@/lib/ceremony/story";
import { YouTubeLite } from "../youtube-lite";
import { Pager, PartHeader, partEyebrow } from "../part-chrome";
import styles from "../ceremony.module.css";

export const metadata = {
  title: "The road to the genesis block · Zcash Ceremony · OpenZcash",
  description:
    "A short documentary of the years from 1982 to the Zcash genesis block: Chaum's blind signatures, the cypherpunks, Hashcash and bit gold, Bitcoin, Zerocoin and Zerocash, and the 2016 ceremony.",
};

function ChapterQuote({ quote }: { quote: NonNullable<Chapter["quote"]> }) {
  return (
    <figure className={styles.filmQuote}>
      <blockquote cite={quote.href}>“{quote.text}”</blockquote>
      <figcaption>
        <a href={quote.href} target="_blank" rel="noreferrer">
          {quote.by} ↗
        </a>
      </figcaption>
    </figure>
  );
}

function ChapterFilm({ film }: { film: NonNullable<Chapter["film"]> }) {
  return (
    <figure className={styles.filmVideo}>
      <div className={styles.filmVideoFrame}>
        <YouTubeLite id={film.youtubeId} title={film.title} />
      </div>
      <figcaption>
        <strong>{film.title}</strong> · {clock(film.lengthS)}. {film.caption}{" "}
        <a
          href={`https://www.youtube.com/watch?v=${film.youtubeId}`}
          target="_blank"
          rel="noreferrer"
        >
          Watch on YouTube ↗
        </a>
      </figcaption>
    </figure>
  );
}

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

      <section
        className={styles.film}
        aria-label={`${CHAPTERS.length} chapters`}
      >
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
              {c.text.map((t, n) => (
                <Fragment key={t.slice(0, 32)}>
                  <p>{t}</p>
                  {c.quote && c.quote.after === n ? (
                    <ChapterQuote quote={c.quote} />
                  ) : null}
                  {c.film && c.film.after === n ? (
                    <ChapterFilm film={c.film} />
                  ) : null}
                </Fragment>
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
          In memory of Hal Finney (1956–2014), who received the first Bitcoin
          transaction.
        </p>
      </section>

      <Pager slug="road" />
    </div>
  );
}
