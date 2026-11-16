import type { SourceLink } from "./decisions";

/**
 * The decision the network is taking now, shown as a calendar that points to
 * where it is happening. The page compares nothing and recommends nothing:
 * the proposals are linked, not summarised, because the ballot wording was
 * still being settled when this was written.
 *
 * Source: the organizers' timeline on the Zcash Community Forum (topic 58906,
 * first post of 2026-11-05; draft questions of 2026-11-10 and 2026-11-13).
 * Dates are UTC. Update this record when the organizers publish a change or
 * a result; `reviewedAt` is the day the sources were last read.
 */
export interface CalendarStep {
  /** The date as shown. */
  when: string;
  label: string;
  /** First and last day of the step (ISO, UTC); null while it has no end. */
  from: string;
  to: string | null;
  /** The UTC time the step ends, when the organizers announced one. */
  endsAt?: string;
}

export interface Pointer {
  label: string;
  links: SourceLink[];
}

export interface OpenDecision {
  title: string;
  /** How the organizers name the round. */
  round: string;
  /** Short name for calendar entries, e.g. "Dev Fund poll". */
  calendarName?: string;
  /** The polling window as shown, and its first and last day. */
  window: string;
  opens: string;
  closes: string;
  note: string;
  steps: CalendarStep[];
  pointers: Pointer[];
  source: SourceLink;
  reviewedAt: string;
}

export const OPEN_DECISION: OpenDecision = {
  title: "ZCG's share of the Dev Fund",
  round: "NU7.1 poll",
  calendarName: "Dev Fund poll",
  window: "Nov 16 to 30",
  opens: "2026-11-16",
  closes: "2026-11-30",
  note: "Nothing is decided. Without rough consensus, the rules in force stay.",
  steps: [
    {
      when: "Nov 8",
      label: "Proposals closed",
      from: "2026-11-05",
      to: "2026-11-08",
      endsAt: "23:59 UTC",
    },
    {
      when: "Nov 10 and 13",
      label: "Draft questions",
      from: "2026-11-09",
      to: "2026-11-13",
    },
    {
      when: "By Nov 15",
      label: "Final questions",
      from: "2026-11-14",
      to: "2026-11-15",
    },
    {
      when: "Nov 16 to 30",
      label: "Coinholders and panels vote",
      from: "2026-11-16",
      to: "2026-11-30",
      endsAt: "23:59 UTC",
    },
    {
      when: "After Nov 30",
      label: "Result read",
      from: "2026-12-01",
      to: null,
    },
  ],
  pointers: [
    {
      label: "Timeline and questions",
      links: [
        {
          label: "Zcash Community Forum",
          href: "https://forum.zcashcommunity.com/t/zcg-and-the-dev-fund-timeline-for-proposals-and-polling/58906",
        },
      ],
    },
    {
      label: "Proposals to read",
      links: [
        { label: "PR 1423", href: "https://github.com/zcash/zips/pull/1423" },
        { label: "PR 1428", href: "https://github.com/zcash/zips/pull/1428" },
        { label: "PR 1431", href: "https://github.com/zcash/zips/pull/1431" },
      ],
    },
    {
      label: "Rules in force",
      links: [
        { label: "ZIP 1015", href: "https://zips.z.cash/zip-1015" },
        { label: "ZIP 1016", href: "https://zips.z.cash/zip-1016" },
      ],
    },
  ],
  source: {
    label: "Timeline, forum",
    href: "https://forum.zcashcommunity.com/t/zcg-and-the-dev-fund-timeline-for-proposals-and-polling/58906",
  },
  reviewedAt: "2026-11-14",
};

export type StepState = "done" | "now" | "next";

/** Where each step stands on a given day (ISO, UTC). */
export function stepStates(
  steps: readonly CalendarStep[],
  today: string,
): StepState[] {
  return steps.map((step) => {
    if (today < step.from) return "next";
    if (step.to !== null && today > step.to) return "done";
    return "now";
  });
}

export type PollStatus = "before" | "open" | "closed";

export function pollStatus(
  decision: Pick<OpenDecision, "opens" | "closes">,
  today: string,
): PollStatus {
  if (today < decision.opens) return "before";
  return today > decision.closes ? "closed" : "open";
}

export const POLL_STATUS_LABEL: Record<PollStatus, string> = {
  before: "polling window",
  open: "polls open",
  closed: "polls closed",
};

/** The current day in UTC, as an ISO date. */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
