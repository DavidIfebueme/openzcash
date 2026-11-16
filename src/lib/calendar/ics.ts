import { addDays, isIsoDay, type CalendarEvent } from "./events";

/**
 * iCalendar (RFC 5545) rendering of the Zcash calendar. Every event is an
 * all-day entry with a stable UID, so calendar apps that subscribe update an
 * entry in place when its date or wording changes. Month-precision estimates
 * and open-ended steps are left out: a subscription only carries dates that
 * were published.
 */
export const CALENDAR_NAME = "Zcash · OpenZcash";
export const CALENDAR_DESCRIPTION =
  "Governance polls, Coinholder Grants rounds, ZCG meetings and elections, and Arborist Calls, as listed on openzcash.org/news.";
/** How often clients are asked to re-read the feed. */
export const REFRESH_INTERVAL = "PT6H";

/** Text value: escapes the separators and keeps line breaks as \n. */
function text(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** One-line text: a newline in a title can never start a new property. */
function line(value: string): string {
  return text(value.replace(/[\r\n]+/g, " "));
}

/** Absolute http(s) URL, or null for anything else. */
export function absoluteUrl(href: string, siteUrl: string): string | null {
  try {
    const url = new URL(href, siteUrl);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/** Folds content lines at 75 octets, as RFC 5545 section 3.1 requires. */
export function fold(contentLine: string): string {
  const bytes = new TextEncoder().encode(contentLine);
  if (bytes.length <= 75) return contentLine;
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Never split a multi-byte UTF-8 character.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    parts.push(decoder.decode(bytes.slice(start, end)));
    start = end;
    limit = 74; // continuation lines start with a space
  }
  return parts.join("\r\n ");
}

function basicDate(day: string): string {
  return day.replaceAll("-", "");
}

function stamp(now: number): string {
  return new Date(now)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function vevent(
  event: CalendarEvent,
  now: number,
  siteUrl: string,
  host: string,
): string[] {
  const url = absoluteUrl(event.link.href, siteUrl);
  const description = [event.note, url ? `${event.link.label}: ${url}` : null]
    .filter((part): part is string => Boolean(part))
    .join("\n");
  return [
    "BEGIN:VEVENT",
    `UID:${event.id}@${host}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART;VALUE=DATE:${basicDate(event.start)}`,
    `DTEND;VALUE=DATE:${basicDate(addDays(event.end ?? event.start, 1))}`,
    `SUMMARY:${line(event.title)}`,
    ...(description ? [`DESCRIPTION:${text(description)}`] : []),
    ...(url ? [`URL:${url}`] : []),
    `CATEGORIES:${line(event.category)}`,
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
  ];
}

export function calendarIcs(
  events: CalendarEvent[],
  { now, siteUrl }: { now: number; siteUrl: string },
): string {
  const host = new URL(siteUrl).host;
  const dated = events
    .filter((event) => event.precision === "day" && isIsoDay(event.start))
    .filter(
      (event) =>
        event.end === undefined ||
        (isIsoDay(event.end) && event.end >= event.start),
    )
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OpenZcash//Zcash calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${line(CALENDAR_NAME)}`,
    `X-WR-CALDESC:${line(CALENDAR_DESCRIPTION)}`,
    `REFRESH-INTERVAL;VALUE=DURATION:${REFRESH_INTERVAL}`,
    `X-PUBLISHED-TTL:${REFRESH_INTERVAL}`,
    ...dated.flatMap((event) => vevent(event, now, siteUrl, host)),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
