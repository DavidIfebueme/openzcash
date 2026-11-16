import type { OpenDecision } from "@/lib/governance/open-decisions";
import type { AnnouncedCycle } from "@/lib/coinholder/cycles";

/**
 * The Zcash calendar: dated steps the portal already tracks elsewhere,
 * gathered in one list for the News page and the iCalendar feed. Nothing here
 * invents a date: every event comes from a record with its own source, and
 * estimates are marked as such and kept to month precision.
 *
 * Dates are UTC calendar days (YYYY-MM-DD); `end` is inclusive.
 */
export const CALENDAR_CATEGORIES = [
  "governance",
  "coinholder",
  "zcg",
  "network",
  "community",
] as const;
export type CalendarCategory = (typeof CALENDAR_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<CalendarCategory, string> = {
  governance: "Governance",
  coinholder: "Coinholder",
  zcg: "ZCG",
  network: "Network",
  community: "Community",
};

export interface CalendarLink {
  label: string;
  href: string;
}

export interface CalendarEvent {
  /** Stable across updates: calendar apps match changes by this id. */
  id: string;
  category: CalendarCategory;
  title: string;
  note?: string;
  start: string;
  end?: string;
  /**
   * "day" events go to the feed. "month" estimates and "after" steps (open-ended,
   * from `start` on, with no date of their own yet) stay on the page.
   */
  precision: "day" | "month" | "after";
  estimated?: boolean;
  link: CalendarLink;
}

const DAY_MS = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDay(value: unknown): value is string {
  return (
    typeof value === "string" &&
    ISO_DAY.test(value) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  return utcDay(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
  );
}

export function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const MONTH_DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/** "2026-11-30" → "Nov 30". */
export function monthDay(day: string): string {
  return MONTH_DAY.format(new Date(`${day}T00:00:00Z`));
}

/** "2026-12-16T20:00:00Z" → "Dec 16, 20:00 UTC". */
function deadline(instant: string): string {
  const at = new Date(instant);
  return `${MONTH_DAY.format(at)}, ${TIME.format(at)} UTC`;
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

/**
 * The open governance decision. The polling window is one ranged event; every
 * other step is the day it ends (a deadline). A step with no end yet, such as
 * the result, stays open-ended until the record gives it a date.
 */
export function governanceEvents(decision: OpenDecision): CalendarEvent[] {
  const name = decision.calendarName ?? decision.round;
  return decision.steps.map((step) => {
    const window =
      step.from === decision.opens && step.to === decision.closes;
    const day = step.to ?? step.from;
    const open = step.to === null;
    return {
      id: `governance-${slug(decision.round)}-${slug(step.label)}`,
      category: "governance",
      title: `${name}: ${lowerFirst(step.label)}`,
      note: window
        ? `${decision.title} · ${decision.round}`
        : open
          ? "No date announced yet"
          : undefined,
      start: window ? step.from : day,
      end: window ? decision.closes : undefined,
      precision: open ? "after" : "day",
      link: { label: "Forum", href: decision.source.href },
    };
  });
}

/** The announced Coinholder Grants round: its three windows. */
export function coinholderEvents(cycle: AnnouncedCycle): CalendarEvent[] {
  const name = `Coinholder Grants ${cycle.label}`;
  const windows = [
    ["submissions", cycle.submissionsOpen, cycle.submissionsClose],
    ["review", cycle.reviewOpen, cycle.reviewClose],
    ["vote", cycle.voteOpen, cycle.voteClose],
  ] as const;
  return windows.map(([key, open, close]) => ({
    id: `coinholder-${slug(cycle.id)}-${key}`,
    category: "coinholder",
    title: `${name}: ${key}`,
    note: `Closes ${deadline(close)}`,
    start: utcDay(Date.parse(open)),
    end: utcDay(Date.parse(close)),
    precision: "day",
    link: { label: "Round", href: "/coinholders" },
  }));
}

export interface MeetingRecord {
  id: string;
  meetingDate: string | null;
  url: string;
}

/** ZCG committee meetings, dated by their published minutes. */
export function meetingEvents(meetings: MeetingRecord[]): CalendarEvent[] {
  return meetings
    .filter((meeting) => isIsoDay(meeting.meetingDate))
    .map((meeting) => ({
      id: `zcg-meeting-${slug(meeting.id)}`,
      category: "zcg",
      title: "ZCG committee meeting",
      note: "Minutes published",
      start: meeting.meetingDate!,
      precision: "day",
      link: { label: "Minutes", href: meeting.url },
    }));
}

export interface ElectionRecord {
  id: string;
  title: string;
  url: string;
  nominationsClose: string | null;
  communityCall: string | null;
  votingCloses: string | null;
  resultsBy: string | null;
}

/** Published milestones of each ZCG committee election. */
export function electionEvents(elections: ElectionRecord[]): CalendarEvent[] {
  const steps = [
    ["nominations", "nominationsClose", "nominations close"],
    ["community-call", "communityCall", "community call"],
    ["voting", "votingCloses", "voting closes"],
    ["results", "resultsBy", "results"],
  ] as const;
  return elections.flatMap((election) =>
    steps.flatMap(([key, field, label]): CalendarEvent[] => {
      const day = election[field];
      if (!isIsoDay(day)) return [];
      return [
        {
          id: `zcg-election-${slug(election.id)}-${key}`,
          category: "zcg",
          title: `ZCG election: ${label}`,
          note: election.title,
          start: day,
          precision: "day",
          link: { label: "Election", href: election.url },
        },
      ];
    }),
  );
}

export interface ArboristRecord {
  number: number | null;
  date: string | null;
  video: string | null;
  videoId: string | null;
  url: string | null;
}

/** Notes outrank a call number, which outranks a recording alone. */
function richness(call: ArboristRecord): number {
  return (call.url ? 4 : 0) + (call.number != null ? 2 : 0) + (call.video ? 1 : 0);
}

/**
 * Arborist Calls that took place, with their notes or recording. One call per
 * day, keyed by its date: a recording that later gains notes and a number keeps
 * the same id, so a subscribed calendar updates the entry instead of adding one.
 */
export function arboristEvents(calls: ArboristRecord[]): CalendarEvent[] {
  const byDay = new Map<string, ArboristRecord>();
  for (const call of calls) {
    if (!isIsoDay(call.date)) continue;
    const current = byDay.get(call.date);
    if (!current || richness(call) > richness(current)) byDay.set(call.date, call);
  }
  return [...byDay.values()]
    .map((call) => ({
      id: `arborist-${call.date}`,
      category: "community",
      title: call.number == null ? "Arborist Call" : `Arborist Call #${call.number}`,
      note: call.url ? undefined : call.video ? "Recording available" : undefined,
      start: call.date!,
      precision: "day",
      link: call.url
        ? { label: "Notes", href: call.url }
        : call.video
          ? { label: "YouTube", href: call.video }
          : { label: "Archive", href: "/arborist" },
    }));
}

export interface PaymentMonth {
  /** "2026-12" */
  label: string;
  count: number;
}

/** Scheduled ZCG milestone payments for this month and the next. */
export function paymentEvents(
  months: PaymentMonth[],
  today: string,
): CalendarEvent[] {
  const thisMonth = today.slice(0, 7);
  const nextMonth = addDays(`${thisMonth}-01`, 32).slice(0, 7);
  return months
    .filter((month) => month.label === thisMonth || month.label === nextMonth)
    .filter((month) => month.count > 0 && isIsoDay(`${month.label}-01`))
    .map((month) => ({
      id: `zcg-payments-${month.label}`,
      category: "zcg",
      title: "ZCG scheduled grant payments",
      note: `${month.count} milestone${month.count === 1 ? "" : "s"} in the payment schedule`,
      start: `${month.label}-01`,
      precision: "month",
      link: { label: "Schedule", href: "/zcg/schedule" },
    }));
}

export interface HalvingEstimate {
  nextHalvingHeight: number | null;
  estimatedHalvingAt: string | null;
}

/** The next halving, dated by the network projection. */
export function halvingEvents(
  estimate: HalvingEstimate | null,
): CalendarEvent[] {
  if (!estimate?.nextHalvingHeight || !estimate.estimatedHalvingAt) return [];
  const at = Date.parse(estimate.estimatedHalvingAt);
  if (!Number.isFinite(at)) return [];
  return [
    {
      id: `network-halving-${estimate.nextHalvingHeight}`,
      category: "network",
      title: `Next halving · block ${estimate.nextHalvingHeight.toLocaleString("en-US")}`,
      note: "Date estimated from the current block height",
      start: utcDay(at),
      precision: "month",
      estimated: true,
      link: { label: "Network", href: "/zcash-network" },
    },
  ];
}
