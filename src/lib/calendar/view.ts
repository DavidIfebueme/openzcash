import {
  CALENDAR_CATEGORIES,
  addDays,
  daysBetween,
  monthDay,
  type CalendarCategory,
  type CalendarEvent,
} from "./events";

/** Past events stay on the page this long; the feed keeps a year. */
export const PAST_DAYS = 30;
/** Events further out than this are grouped under "Later". */
export const LATER_AFTER_DAYS = 120;

export type EventStateKind = "done" | "now" | "next";
export interface EventState {
  kind: EventStateKind;
  label: string;
}

const MONTH_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const SHORT_MONTH_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const WEEKDAY_DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function asDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

/** "2026-11-16" → "Mon 16 Nov". */
export function dayLabel(day: string): string {
  return WEEKDAY_DAY_MONTH.format(asDate(day)).replace(",", "");
}

/** "2026-11-16" → "November 2026". */
export function monthLabel(day: string): string {
  return MONTH_YEAR.format(asDate(day));
}

/** How the event's date is written in the list. */
export function whenLabel(event: CalendarEvent): { when: string; until?: string } {
  if (event.precision === "month") {
    const month = SHORT_MONTH_YEAR.format(asDate(event.start));
    return { when: event.estimated ? `~ ${month}` : month };
  }
  return {
    when: dayLabel(event.start),
    until: event.end && event.end !== event.start ? `to ${dayLabel(event.end)}` : undefined,
  };
}

export function lastDay(event: CalendarEvent): string {
  return event.end ?? event.start;
}

export function eventState(event: CalendarEvent, today: string): EventState {
  if (event.precision === "month") {
    return event.start.slice(0, 7) < today.slice(0, 7)
      ? { kind: "done", label: "Done" }
      : { kind: "next", label: "Estimated" };
  }
  const end = lastDay(event);
  if (end < today) return { kind: "done", label: "Done" };
  if (event.start > today) {
    const days = daysBetween(today, event.start);
    return { kind: "next", label: days === 1 ? "Tomorrow" : `In ${days} days` };
  }
  if (event.start === end) return { kind: "now", label: "Today" };
  if (event.start === today) return { kind: "now", label: "Opens today" };
  if (end === today) return { kind: "now", label: "Closes today" };
  return { kind: "now", label: `Open until ${monthDay(end)}` };
}

export interface CalendarGroup {
  label: string;
  events: CalendarEvent[];
}

export interface MonthCell {
  day: number | null;
  date: string | null;
  today: boolean;
  /** Inside a window (a ranged event) that has not ended. */
  inWindow: boolean;
  /** Category of the first event that starts or ends on this day. */
  mark: CalendarCategory | null;
}

export interface CalendarView {
  upcoming: CalendarGroup[];
  past: CalendarEvent[];
  upcomingCount: number;
  counts: Record<CalendarCategory, number>;
  month: { label: string; cells: MonthCell[] };
}

/** A month-precision event sorts after the dated events of its month. */
function sortDay(event: CalendarEvent): string {
  if (event.precision === "day") return event.start;
  return addDays(addDays(`${event.start.slice(0, 7)}-01`, 32).slice(0, 7) + "-01", -1);
}

function byStart(a: CalendarEvent, b: CalendarEvent): number {
  return (
    sortDay(a).localeCompare(sortDay(b)) ||
    lastDay(a).localeCompare(lastDay(b)) ||
    a.title.localeCompare(b.title)
  );
}

function groupUpcoming(events: CalendarEvent[], today: string): CalendarGroup[] {
  const later = addDays(today, LATER_AFTER_DAYS);
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of [...events].sort(byStart)) {
    const anchor = event.start < today ? today : event.start;
    const label = anchor > later ? "Later" : monthLabel(anchor);
    groups.set(label, [...(groups.get(label) ?? []), event]);
  }
  return [...groups.entries()].map(([label, list]) => ({ label, events: list }));
}

function monthGrid(events: CalendarEvent[], today: string): MonthCell[] {
  const first = `${today.slice(0, 7)}-01`;
  const lead = (asDate(first).getUTCDay() + 6) % 7;
  const length = daysBetween(first, addDays(first, 31).slice(0, 7) + "-01");
  const dated = events.filter((event) => event.precision === "day");
  const cells: MonthCell[] = Array.from({ length: lead }, () => ({
    day: null, date: null, today: false, inWindow: false, mark: null,
  }));
  for (let day = 1; day <= length; day++) {
    const date = addDays(first, day - 1);
    const marked = dated
      .filter((event) => event.start === date || event.end === date)
      .sort((a, b) =>
        CALENDAR_CATEGORIES.indexOf(a.category) - CALENDAR_CATEGORIES.indexOf(b.category));
    cells.push({
      day,
      date,
      today: date === today,
      inWindow: dated.some((event) =>
        event.end !== undefined && event.end !== event.start &&
        event.end >= today && event.start <= date && date <= event.end),
      mark: marked[0]?.category ?? null,
    });
  }
  return cells;
}

/** Splits the calendar into what is open or coming and what just happened. */
export function calendarView(events: CalendarEvent[], today: string): CalendarView {
  const pastFrom = addDays(today, -PAST_DAYS);
  const upcomingEvents = events.filter((event) => eventState(event, today).kind !== "done");
  const past = events
    .filter((event) => eventState(event, today).kind === "done" && lastDay(event) >= pastFrom)
    .sort((a, b) => lastDay(b).localeCompare(lastDay(a)) || a.title.localeCompare(b.title));
  const counts = Object.fromEntries(
    CALENDAR_CATEGORIES.map((category) => [
      category,
      upcomingEvents.filter((event) => event.category === category).length,
    ]),
  ) as Record<CalendarCategory, number>;
  return {
    upcoming: groupUpcoming(upcomingEvents, today),
    past,
    upcomingCount: upcomingEvents.length,
    counts,
    month: { label: monthLabel(today), cells: monthGrid(events, today) },
  };
}
