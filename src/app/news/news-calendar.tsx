import Link from "next/link";
import { CopyLinkButton } from "@/components/copy-link-button";
import {
  CALENDAR_CATEGORIES,
  CATEGORY_LABEL,
  type CalendarCategory,
  type CalendarEvent,
} from "@/lib/calendar/events";
import {
  eventState,
  whenLabel,
  type CalendarView,
} from "@/lib/calendar/view";
import type { SubscribeLinks } from "@/lib/calendar/subscribe";
import styles from "./news.module.css";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function CalendarIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="2" y="3" width="12" height="11" rx="2" />
      <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M6.5 9.5l3-3M7 4.5l1-1a2.8 2.8 0 014 4l-1 1M9 11.5l-1 1a2.8 2.8 0 01-4-4l1-1" />
    </svg>
  );
}

function Row({ event, today }: { event: CalendarEvent; today: string }) {
  const state = eventState(event, today);
  const { when, until } = whenLabel(event);
  const external = /^https?:/.test(event.link.href);
  return (
    <article className={styles.row} data-state={state.kind}>
      <time className={styles.when} dateTime={event.precision === "month" ? event.start.slice(0, 7) : event.start}>
        {when}
        {until ? <small>{until}</small> : null}
      </time>
      <div className={styles.title}>
        {event.title}
        {event.note ? <small>{event.note}</small> : null}
      </div>
      <div className={styles.meta}>
        <span className={`${styles.tag} ${styles.cat}`} data-category={event.category}>
          <i className={styles.dot} aria-hidden="true" />
          {CATEGORY_LABEL[event.category]}
        </span>
        <span className={styles.state}>{state.label}</span>
        <a
          className={styles.link}
          href={event.link.href}
          target={external ? "_blank" : undefined}
          rel={external ? "noreferrer" : undefined}
          aria-label={`${event.link.label}: ${event.title}`}
        >
          {event.link.label}
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  );
}

function MonthGrid({ view }: { view: CalendarView }) {
  const today = view.month.cells.find((cell) => cell.today)?.day;
  return (
    <div className={styles.mini} aria-hidden="true">
      <p className={styles.miniHead}>
        {view.month.label}
        {today ? <span>today {today}</span> : null}
      </p>
      <div className={styles.grid}>
        {WEEKDAYS.map((day, index) => <b key={index}>{day}</b>)}
        {view.month.cells.map((cell, index) => (
          <span
            key={cell.date ?? `blank-${index}`}
            className={styles.cell}
            data-today={cell.today || undefined}
            data-window={cell.inWindow || undefined}
          >
            {cell.day ?? ""}
            {cell.marks.length > 0 ? (
              <span className={styles.marks}>
                {cell.marks.map((mark) => (
                  <i key={mark} className={`${styles.mark} ${styles.cat}`} data-category={mark} />
                ))}
              </span>
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The legend is the filter: each category links to the calendar showing only it. */
function Filters({ totals, type }: { totals: CalendarView; type?: CalendarCategory }) {
  const items: { key?: CalendarCategory; label: string; count: number }[] = [
    { label: "All", count: totals.upcomingCount },
    ...CALENDAR_CATEGORIES.map((category) => ({
      key: category,
      label: CATEGORY_LABEL[category],
      count: totals.counts[category],
    })),
  ];
  return (
    <nav className={styles.filters} aria-label="Calendar categories">
      {items.map((item) => (
        <Link
          key={item.key ?? "all"}
          className={styles.filter}
          href={item.key ? `/news?view=calendar&type=${item.key}` : "/news?view=calendar"}
          aria-current={type === item.key ? "page" : undefined}
          scroll={false}
        >
          {item.key ? (
            <i className={`${styles.dot} ${styles.cat}`} data-category={item.key} aria-hidden="true" />
          ) : (
            <i className={styles.dotAll} aria-hidden="true" />
          )}
          <span>{item.label}</span>
          <strong>{item.count}</strong>
        </Link>
      ))}
    </nav>
  );
}

export function NewsCalendar({
  view,
  totals,
  type,
  today,
  links,
  unavailable,
}: {
  /** The calendar as shown, filtered by `type` when one is chosen. */
  view: CalendarView;
  /** The whole calendar, for the counts in the filter. */
  totals: CalendarView;
  type?: CalendarCategory;
  today: string;
  links: SubscribeLinks;
  unavailable: string[];
}) {
  const empty = view.upcoming.length === 0 && view.past.length === 0;
  return (
    <>
      <section className={styles.subscribe} aria-labelledby="news-calendar-subscribe">
        <p className={styles.subscribeText}>
          <strong id="news-calendar-subscribe">Add the Zcash calendar to yours</strong>
          New and changed dates show up on their own.
        </p>
        <div className={styles.actions}>
          <a className={`${styles.button} ${styles.primary}`} href={links.google} target="_blank" rel="noreferrer">
            <CalendarIcon />
            Google Calendar
          </a>
          <a className={styles.button} href={links.webcal}>Apple · Outlook</a>
          <CopyLinkButton value={links.https} className={styles.button}>
            <LinkIcon />
          </CopyLinkButton>
        </div>
      </section>

      {unavailable.length > 0 ? (
        <p role="status" className="ws-news-meta">
          Temporarily unable to read {unavailable.join(", ")}. The other dates are current.
        </p>
      ) : null}

      <div className={styles.layout}>
        <aside className={styles.side} aria-label="This month">
          <MonthGrid view={view} />
          <Filters totals={totals} type={type} />
        </aside>
        <div className={styles.agenda}>
          {empty ? <p className={styles.empty}>No dates to show right now.</p> : null}
          {view.upcoming.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2 className={styles.month}>{group.label}</h2>
              {group.events.map((event) => <Row key={event.id} event={event} today={today} />)}
            </section>
          ))}
          {view.past.length > 0 ? (
            <section aria-label="Past 30 days">
              <h2 className={styles.month}>Past 30 days</h2>
              {view.past.map((event) => <Row key={event.id} event={event} today={today} />)}
            </section>
          ) : null}
        </div>
      </div>

      <p className={styles.foot}>
        From the governance poll calendar, the Coinholder Grants round, ZCG minutes, elections and
        payment schedule, Arborist Call notes and the network. Estimates appear here only.{" "}
        <a href={links.https}>calendar.ics</a>
      </p>
    </>
  );
}
