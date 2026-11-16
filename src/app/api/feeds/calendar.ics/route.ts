import { getCalendarData } from "@/lib/calendar/source";
import { calendarIcs } from "@/lib/calendar/ics";
import { addDays, utcDay } from "@/lib/calendar/events";
import { SITE_URL } from "@/lib/seo/page-metadata";

export const dynamic = "force-dynamic";

/** The feed keeps a year of history next to everything still ahead. */
const HISTORY_DAYS = 365;

/**
 * The Zcash calendar as an iCalendar subscription: the same events as the
 * News calendar, with stable ids so subscribed calendars update in place.
 */
export async function GET() {
  const now = Date.now();
  const since = addDays(utcDay(now), -HISTORY_DAYS);
  const { events } = await getCalendarData();
  const recent = events.filter((event) => (event.end ?? event.start) >= since);
  return new Response(calendarIcs(recent, { now, siteUrl: SITE_URL }), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="zcash-calendar.ics"',
      "cache-control": "public, max-age=1800",
    },
  });
}
