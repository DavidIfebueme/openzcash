import Link from "next/link";
import { pageMetadata, SITE_URL } from "@/lib/seo/page-metadata";
/* eslint-disable @next/next/no-img-element */
import { PageHeader } from "@/components/ui";
import {
  getNews,
  newsFetchedAt,
  githubNewsHealth,
  githubNewsBehind,
  newsUnavailableSources,
  nowMs,
  type NewsItem,
  type NewsSource,
} from "@/lib/news/feed";
import { NewsSeen } from "@/components/news-seen";
import { newsReferences } from "@/lib/news/merge";
import { SourceRefresh } from "@/components/source-refresh";
import { newsView, NEWS_SOURCES, NEW_WINDOW_MS, type NewsSearchParams } from "@/lib/news/view";
import { getCalendarData } from "@/lib/calendar/source";
import { calendarView } from "@/lib/calendar/view";
import { CALENDAR_CATEGORIES, utcDay } from "@/lib/calendar/events";
import { subscribeLinks } from "@/lib/calendar/subscribe";
import { NewsCalendar } from "./news-calendar";
import styles from "./news.module.css";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "News · OpenZcash",
  description:
    "The last seven days across Zcash and the dates ahead: proposals, discussions, releases, grant payments, polls and meetings.",
  path: "/news",
  card: { kicker: "The last seven days across the Zcash ecosystem" },
});

/** Source marks are local images or text symbols. Ink images flip to light
 * in the dark theme; text symbols inherit the theme's ink color. */
const SOURCE: Record<NewsSource, { label: string; mark: string; glyph?: boolean; symbol?: boolean }> = {
  forum: { label: "Forum", mark: "/logos/marks/openzcash.png" },
  github: { label: "Releases", mark: "/logos/marks/github.png", glyph: true },
  sheet: { label: "Recent payments", mark: "ᙇ", symbol: true },
  proposal: { label: "Proposals", mark: "/logos/zcg.png" },
  dao: { label: "ZecHub DAO", mark: "/logos/zechub.png" },
  application: { label: "Proposals", mark: "/logos/zcg.png" },
};

function rel(ts: string, now: number): string {
  const d = Math.floor((now - Date.parse(ts)) / 86_400_000);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return mo < 12 ? `${mo}mo ago` : `${Math.floor(d / 365)}y ago`;
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<NewsSearchParams>;
}) {
  const params = await searchParams;
  const calendarMode = (Array.isArray(params.view) ? params.view[0] : params.view) === "calendar";
  const [items, calendar] = await Promise.all([getNews(), getCalendarData()]);
  const now = nowMs();
  const today = utcDay(now);
  const everything = calendarView(calendar.events, today);
  const rawType = Array.isArray(params.type) ? params.type[0] : params.type;
  const type = CALENDAR_CATEGORIES.find((category) => category === rawType);
  const month = Array.isArray(params.month) ? params.month[0] : params.month;
  const agenda = calendarView(
    type ? calendar.events.filter((event) => event.category === type) : calendar.events,
    today,
    month,
  );
  const { source, query, shown, counts, totalCount, newCount } = newsView(items, params, now);
  const githubHealth = githubNewsHealth();
  const githubUnavailable = githubNewsBehind(githubHealth);
  const showGithubWarning = githubUnavailable.length > 0 && (!source || source === "github");
  const unavailable = newsUnavailableSources();
  const latest = items[0]?.ts ?? "";
  const newCut = now - NEW_WINDOW_MS;
  const fetchedAt = newsFetchedAt();
  const mins = fetchedAt ? Math.floor((now - fetchedAt) / 60_000) : null;
  const fetchedAgo = mins == null ? "" : mins < 1 ? "just now" : `${mins}m ago`;
  const q = query ? `&q=${encodeURIComponent(query)}` : "";

  return (
    <>
      <NewsSeen latest={latest} />
      <SourceRefresh />
      <PageHeader
        title="News"
        subtitle="The last seven days across Zcash, and the dates ahead."
      />

      <nav className={styles.tabs} aria-label="News views">
        <Link href="/news" aria-current={calendarMode ? undefined : "page"}>
          <span>Feed</span>
          <strong>{totalCount}</strong>
        </Link>
        <Link href="/news?view=calendar" aria-current={calendarMode ? "page" : undefined}>
          <span>Calendar</span>
          <strong>{everything.upcomingCount}</strong>
        </Link>
        <p className={styles.tabsMeta}>
          {calendarMode
            ? "Times in UTC"
            : `${shown.length === totalCount ? `${totalCount} updates` : `${shown.length} of ${totalCount} updates`} · ${newCount} new in 48 hours`}
        </p>
      </nav>

      {calendarMode ? (
        <NewsCalendar
          view={agenda}
          totals={everything}
          type={type}
          today={today}
          links={subscribeLinks(SITE_URL)}
          unavailable={calendar.unavailable}
        />
      ) : (
      <>
      <div className="ws-news-bar">
      <nav className="ws-news-sources" aria-label="News sources">
        <Link
          href={query ? `/news?q=${encodeURIComponent(query)}` : "/news"}
          aria-current={!source ? "page" : undefined}
        >
          <span>All</span>
          <strong>{totalCount}</strong>
        </Link>
        {NEWS_SOURCES.map(key => (
          <Link
            key={key}
            href={`/news?source=${key}${q}`}
            aria-current={source === key ? "page" : undefined}
          >
            <span>{SOURCE[key].label}</span>
            <strong>{counts[key]}</strong>
          </Link>
        ))}
      </nav>

      <form
        key={JSON.stringify([query, source ?? ""])}
        className="ws-news-search"
        role="search"
      >
        <input
          name="q"
          type="search"
          aria-label="Search news"
          placeholder="Search this week's updates…"
          defaultValue={query}
        />
        {source ? (
          <input type="hidden" name="source" value={source} />
        ) : null}
        {query ? (
          <Link href={source ? `/news?source=${source}` : "/news"}>
            Clear
          </Link>
        ) : null}
      </form>
      </div>

      {unavailable.length > 0 ? (
        <p role="status" className="ws-news-meta">
          Temporarily unable to refresh {unavailable.join(", ")}. Showing the last available records; retrying automatically.
        </p>
      ) : null}

      {showGithubWarning ? (
        <p role="status" className="mb-5 rounded-xl border border-amber-300/50 bg-amber-500/5 px-4 py-3 text-sm text-stone-700">
          GitHub updates are incomplete: {githubUnavailable.length} of {githubHealth.length} repositories
          could not be refreshed. Previously verified releases are kept within the seven-day window.
          {" "}<Link href="/development" className="text-amber-700 underline underline-offset-4">Browse development activity ↗</Link>
        </p>
      ) : null}

      <div className="ws-news-list">
        {shown.length === 0 ? (
          <p className="ws-news-empty">
            {source === "github" && githubUnavailable.length > 0
              ? "No recent releases could be verified for this view. Try again shortly or browse development activity."
              : items.length === 0
              ? "No recent activity. Sources may be momentarily unreachable."
              : "No updates match this view. Clear the filters or revisit the source later."}
          </p>
        ) : null}
        {shown.map((i: NewsItem) => {
          const s = SOURCE[i.source];
          const isNew = Date.parse(i.ts) > newCut;
          const external = i.url.startsWith("http");
          return (
            <article key={i.id} className="ws-news-row">
              {s.symbol ? (
                <span className={styles.currencyMark} aria-hidden="true">
                  {s.mark}
                </span>
              ) : (
                <img
                  src={s.mark}
                  alt=""
                  width={16}
                  height={16}
                  className={s.glyph ? "ws-news-mark ws-news-mark-glyph" : "ws-news-mark"}
                />
              )}
              <a className="ws-news-title" href={i.url} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
                <span>{i.title}</span>
                {isNew ? <i className="ws-news-new" aria-label="new" /> : null}
              </a>
              <span className="ws-news-kind">{i.kind}</span>
              <nav className="ws-news-links" aria-label={`Sources for ${i.title}`}>
                {newsReferences(i).map(ref => {
                  const label = ref.source === "github" ? "GitHub" : ref.source === "proposal" ? "Record" : SOURCE[ref.source].label;
                  return <a key={ref.url} href={ref.url} target={ref.url.startsWith("http") ? "_blank" : undefined} rel="noreferrer"
                    title={ref.publishedAt ? `${label} · ${new Date(ref.publishedAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC` : label}>
                    {label}<span aria-hidden="true">↗</span>
                  </a>;
                })}
              </nav>
              <span className="ws-news-date tnum">{rel(i.ts, now)}</span>
            </article>
          );
        })}
      </div>

      <details className="ws-news-coverage">
        <summary>Sources &amp; updates</summary>
        <div>
          <p>Forum and proposals refresh every 5 minutes, releases hourly, and spreadsheet records every 6 hours.</p>
          <p>Spreadsheet payments are dated by when the ledger recorded them when that is known, otherwise by their paid date; each title shows the paid date.</p>
          <p>{fetchedAgo ? `Feed checked ${fetchedAgo}. ` : ""}This feed covers the last seven days. Older entries remain on their source pages.</p>
        </div>
      </details>
      </>
      )}
    </>
  );
}
