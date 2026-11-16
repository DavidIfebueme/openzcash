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
    return { when: event.estimated ? `≈ ${month}` : month };
  }
  if (event.precision === "after") {
    return { when: `After ${monthDay(addDays(event.start, -1))}` };
  }
  return {
    when: `${event.estimated ? "≈ " : ""}${dayLabel(event.start)}`,
    until: event.end && event.end !== event.start ? `to ${dayLabel(event.end)}` : undefined,
  };
}

export function lastDay(event: CalendarEvent): string {
  return event.end ?? event.start;
}

export function eventState(event: CalendarEvent, today: string): EventState {
  // An open-ended step is never done by the calendar alone: only its record ends it.
  if (event.precision === "after") return { kind: "next", label: "Pending" };
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
  day: number;
  date: string;
  /** A day of the previous or next month, drawn to fill the six weeks. */
  outside: boolean;
  today: boolean;
  /** Inside a window (a ranged event) that has not ended. */
  inWindow: boolean;
  /** Categories of the events that start or end on this day, at most three. */
  marks: CalendarCategory[];
}

export interface MonthView {
  /** "2026-11" */
  key: string;
  label: string;
  /** Six weeks from Monday, always 42 cells. */
  cells: MonthCell[];
  /** Whether the month shown is today's month. */
  current: boolean;
  todayDay: number;
  /** The neighbouring months that still hold dates, or null at either end. */
  prev: string | null;
  next: string | null;
}

export interface CalendarView {
  upcoming: CalendarGroup[];
  past: CalendarEvent[];
  upcomingCount: number;
  counts: Record<CalendarCategory, number>;
  month: MonthView;
}

/** A month-precision event sorts after the dated events of its month. */
function sortDay(event: CalendarEvent): string {
  if (event.precision !== "month") return event.start;
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

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

function shiftMonth(key: string, months: number): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + months, 1)).toISOString().slice(0, 7);
}

/** The months the calendar can show: from its first dated event to its last, and today. */
function monthRange(dated: CalendarEvent[], today: string): [string, string] {
  let first = today.slice(0, 7);
  let last = first;
  for (const event of dated) {
    if (event.start.slice(0, 7) < first) first = event.start.slice(0, 7);
    if (lastDay(event).slice(0, 7) > last) last = lastDay(event).slice(0, 7);
  }
  return [first, last];
}

function monthView(events: CalendarEvent[], today: string, requested?: string): MonthView {
  const dated = events.filter((event) => event.precision === "day");
  const current = today.slice(0, 7);
  const [first, last] = monthRange(dated, today);
  const key =
    requested && MONTH_KEY.test(requested) && requested >= first && requested <= last ? requested : current;
  const start = `${key}-01`;
  const gridStart = addDays(start, -((asDate(start).getUTCDay() + 6) % 7));
  const cells = Array.from({ length: 42 }, (_, index): MonthCell => {
    const date = addDays(gridStart, index);
    const outside = date.slice(0, 7) !== key;
    const onDay = new Set(
      outside
        ? []
        : dated.filter((event) => event.start === date || event.end === date).map((event) => event.category),
    );
    return {
      day: Number(date.slice(8)),
      date,
      outside,
      today: !outside && date === today,
      inWindow:
        !outside &&
        dated.some((event) =>
          event.end !== undefined && event.end !== event.start &&
          event.end >= today && event.start <= date && date <= event.end),
      marks: CALENDAR_CATEGORIES.filter((category) => onDay.has(category)).slice(0, 3),
    };
  });
  return {
    key,
    label: monthLabel(start),
    cells,
    current: key === current,
    todayDay: Number(today.slice(8)),
    prev: key > first ? shiftMonth(key, -1) : null,
    next: key < last ? shiftMonth(key, 1) : null,
  };
}

/** Splits the calendar into what is open or coming and what just happened. */
export function calendarView(events: CalendarEvent[], today: string, month?: string): CalendarView {
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
    month: monthView(events, today, month),
  };
}
