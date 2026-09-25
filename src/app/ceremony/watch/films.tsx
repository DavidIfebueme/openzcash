import { FILM_GROUPS, UNRELEASED, type Film } from "@/lib/ceremony/films";
import { clock } from "@/lib/ceremony/recordings";
import { YouTubeLite } from "./youtube-lite";
import styles from "./films.module.css";

const monthYear = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

function FilmCard({ film }: { film: Film }) {
  return (
    <article className={styles.card}>
      <div className={styles.media}>
        {film.youtubeId ? (
          <YouTubeLite
            id={film.youtubeId}
            title={film.title}
            start={film.start}
          />
        ) : (
          <a
            className={styles.external}
            href={film.href}
            target="_blank"
            rel="noreferrer"
          >
            <span>Opens on {film.source}</span>
            <strong>↗</strong>
          </a>
        )}
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>{film.title}</h3>
        <div className={styles.meta}>
          {film.by} · {monthYear(film.date)}
          {film.lengthS !== null ? ` · ${clock(film.lengthS)}` : ""}
        </div>
        <p className={styles.note}>{film.note}</p>
        <a
          className={styles.link}
          href={film.href}
          target="_blank"
          rel="noreferrer"
        >
          {film.youtubeId ? "Watch on YouTube" : `View on ${film.source}`} ↗
        </a>
      </div>
    </article>
  );
}

/** Every other film about the ceremonies, grouped, after the Denver player. */
export function Films() {
  return (
    <>
      {FILM_GROUPS.map((g) => (
        <section
          key={g.id}
          className={styles.group}
          aria-labelledby={`films-${g.id}`}
        >
          <div className={styles.head}>
            <h2 id={`films-${g.id}`} className={styles.groupTitle}>
              {g.title}
            </h2>
            <p className={styles.lede}>{g.lede}</p>
          </div>
          <div className={styles.grid}>
            {g.films.map((f) => (
              <FilmCard key={f.id} film={f} />
            ))}
          </div>
          {g.id === "stations" ? (
            <p className={styles.unreleased}>
              {UNRELEASED.text}{" "}
              {UNRELEASED.links.map((l, i) => (
                <span key={l.href}>
                  {i > 0 ? " · " : ""}
                  <a href={l.href} target="_blank" rel="noreferrer">
                    {l.label} ↗
                  </a>
                </span>
              ))}
            </p>
          ) : null}
        </section>
      ))}
    </>
  );
}
