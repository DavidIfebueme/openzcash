import { describe, expect, it } from "vitest";
import { OPEN_DECISION } from "@/lib/governance/open-decisions";
import { ACTIVE_CYCLE } from "@/lib/coinholder/cycles";
import {
  arboristEvents,
  coinholderEvents,
  electionEvents,
  governanceEvents,
  halvingEvents,
  meetingEvents,
  paymentEvents,
  type CalendarEvent,
} from "./events";
import { calendarView, eventState, whenLabel } from "./view";
import { absoluteUrl, calendarIcs, fold } from "./ics";

const TODAY = "2026-11-16";
const SITE = "https://openzcash.org";

function day(id: string, start: string, end?: string): CalendarEvent {
  return {
    id,
    category: "zcg",
    title: id,
    start,
    end,
    precision: "day",
    link: { label: "Link", href: "/x" },
  };
}

describe("calendar events", () => {
  it("turns the governance poll into deadlines and one polling window", () => {
    const events = governanceEvents(OPEN_DECISION);
    const vote = events.find(
      (event) => event.title === "Dev Fund poll: coinholders and panels vote",
    );
    expect(vote).toMatchObject({ start: "2026-11-16", end: "2026-11-30" });
    expect(
      events.find((event) => event.title === "Dev Fund poll: proposals closed"),
    ).toMatchObject({
      start: "2026-11-08",
      end: undefined,
    });
    expect(
      events.find((event) => event.title === "Dev Fund poll: result read"),
    ).toMatchObject({
      start: "2026-12-01",
      precision: "after",
      note: "No date announced yet",
    });
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
  });

  it("dates the Coinholder round by its announced UTC windows", () => {
    const [submissions, review, vote] = coinholderEvents(ACTIVE_CYCLE);
    expect(submissions).toMatchObject({
      start: "2026-10-30",
      end: "2026-11-13",
    });
    expect(review).toMatchObject({
      start: "2026-11-16",
      end: "2026-12-16",
      note: "Closes Dec 16, 20:00 UTC",
    });
    expect(vote).toMatchObject({
      id: "coinholder-q4-2026-vote",
      start: "2026-12-17",
      end: "2026-12-29",
    });
  });

  it("keeps only records with a real date", () => {
    expect(
      meetingEvents([
        {
          id: "m1",
          meetingDate: "2026-11-09",
          url: "https://forum.example/m1",
        },
        { id: "m2", meetingDate: null, url: "https://forum.example/m2" },
        {
          id: "m3",
          meetingDate: "2026-02-30",
          url: "https://forum.example/m3",
        },
      ]).map((event) => event.id),
    ).toEqual(["zcg-meeting-m1"]);
    const election = electionEvents([
      {
        id: "june-2026",
        title: "June 2026 election",
        url: "https://forum.example/e",
        nominationsClose: "2026-06-08",
        communityCall: null,
        votingCloses: "2026-06-29",
        resultsBy: "2026-07-01",
      },
    ]);
    expect(election.map((event) => event.title)).toEqual([
      "ZCG election: nominations close",
      "ZCG election: voting closes",
      "ZCG election: results",
    ]);
    const calls = arboristEvents([
      {
        number: 134,
        date: "2026-10-15",
        video: "https://youtu.be/a",
        videoId: "a",
        url: "https://github.com/n/134",
      },
      {
        number: null,
        date: "2026-11-12",
        video: "https://youtu.be/b",
        videoId: "b",
        url: null,
      },
      { number: 1, date: null, video: null, videoId: null, url: null },
    ]);
    expect(calls.map((event) => [event.title, event.link.label])).toEqual([
      ["Arborist Call #134", "Notes"],
      ["Arborist Call", "YouTube"],
    ]);
  });

  it("keeps an Arborist Call's id when its recording later gains notes and a number", () => {
    const recording = {
      number: null,
      date: "2026-11-12",
      video: "https://youtu.be/b",
      videoId: "b",
      url: null,
    };
    const withNotes = { ...recording, number: 135, url: "https://github.com/n/135" };
    const [before] = arboristEvents([recording]);
    const [after] = arboristEvents([withNotes]);
    expect(after.id).toBe(before.id);
    // Both records of the same call collapse into one entry, the one with notes.
    const both = arboristEvents([recording, withNotes]);
    expect(both).toHaveLength(1);
    expect(both[0]).toMatchObject({ id: before.id, title: "Arborist Call #135", link: { label: "Notes" } });
  });

  it("limits payment estimates to this month and the next, at month precision", () => {
    const events = paymentEvents(
      [
        { label: "2026-11", count: 3 },
        { label: "2026-12", count: 1 },
        { label: "2027-03", count: 9 },
      ],
      TODAY,
    );
    expect(
      events.map((event) => [event.start, event.note, event.precision]),
    ).toEqual([
      ["2026-11-01", "3 milestones in the payment schedule", "month"],
      ["2026-12-01", "1 milestone in the payment schedule", "month"],
    ]);
  });

  it("marks the halving date as an estimate and skips a missing projection", () => {
    expect(halvingEvents(null)).toEqual([]);
    const [halving] = halvingEvents({
      nextHalvingHeight: 6_132_390,
      estimatedHalvingAt: "2028-11-24T10:00:00Z",
    });
    expect(halving).toMatchObject({
      title: "Next halving · block 6,132,390",
      precision: "month",
      estimated: true,
    });
    expect(whenLabel(halving).when).toBe("~ Nov 2028");
  });
});

describe("calendar view", () => {
  it("names where each event stands", () => {
    expect(eventState(day("a", "2026-11-16", "2026-11-30"), TODAY)).toEqual({
      kind: "now",
      label: "Opens today",
    });
    expect(eventState(day("b", "2026-11-10", "2026-11-20"), TODAY)).toEqual({
      kind: "now",
      label: "Open until Nov 20",
    });
    expect(eventState(day("c", "2026-11-10", "2026-11-16"), TODAY)).toEqual({
      kind: "now",
      label: "Closes today",
    });
    expect(eventState(day("d", "2026-11-16"), TODAY)).toEqual({
      kind: "now",
      label: "Today",
    });
    expect(eventState(day("e", "2026-11-17"), TODAY)).toEqual({
      kind: "next",
      label: "Tomorrow",
    });
    expect(eventState(day("f", "2026-12-01"), TODAY)).toEqual({
      kind: "next",
      label: "In 15 days",
    });
    expect(eventState(day("g", "2026-11-15"), TODAY)).toEqual({
      kind: "done",
      label: "Done",
    });
  });

  it("keeps an open-ended step pending, after a date, until the record gives it one", () => {
    const result = { ...day("result", "2026-12-01"), precision: "after" as const };
    expect(whenLabel(result).when).toBe("After Nov 30");
    for (const today of ["2026-11-16", "2026-12-01", "2026-12-20"]) {
      expect(eventState(result, today)).toEqual({ kind: "next", label: "Pending" });
    }
    expect(calendarView([result], "2026-12-20").upcoming[0].events.map((event) => event.id)).toEqual(["result"]);
    expect(calendarView([result], "2026-12-20").past).toEqual([]);
  });

  it("groups upcoming events by month, far ones under Later, and keeps 30 days of past", () => {
    const view = calendarView(
      [
        day("window", "2026-11-10", "2026-12-16"),
        day("dec", "2026-12-17"),
        day("far", "2027-06-01"),
        day("recent", "2026-11-09"),
        day("old", "2026-10-01"),
      ],
      TODAY,
    );
    expect(
      view.upcoming.map((group) => [
        group.label,
        group.events.map((event) => event.id),
      ]),
    ).toEqual([
      ["November 2026", ["window"]],
      ["December 2026", ["dec"]],
      ["Later", ["far"]],
    ]);
    expect(view.past.map((event) => event.id)).toEqual(["recent"]);
    expect(view.upcomingCount).toBe(3);
    expect(view.counts.zcg).toBe(3);
  });

  it("lists a month-precision estimate after the dated events of its month", () => {
    const view = calendarView(
      [
        { ...day("payments", "2026-11-01"), precision: "month" },
        day("vote", "2026-11-16", "2026-11-30"),
      ],
      TODAY,
    );
    expect(view.upcoming[0].events.map((event) => event.id)).toEqual(["vote", "payments"]);
    expect(whenLabel(view.upcoming[0].events[1]).when).toBe("Nov 2026");
  });

  it("draws the current month from Monday with windows and marks", () => {
    const { month } = calendarView(
      [day("window", "2026-11-16", "2026-11-30"), day("mark", "2026-11-09")],
      TODAY,
    );
    expect(month.label).toBe("November 2026");
    // 1 November 2026 is a Sunday: six blank cells before it.
    expect(month.cells.slice(0, 7).map((cell) => cell.day)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      1,
    ]);
    const byDay = new Map(
      month.cells.filter((cell) => cell.day).map((cell) => [cell.day, cell]),
    );
    expect(byDay.size).toBe(30);
    expect(byDay.get(16)).toMatchObject({
      today: true,
      inWindow: true,
      mark: "zcg",
    });
    expect(byDay.get(9)).toMatchObject({ inWindow: false, mark: "zcg" });
    expect(byDay.get(15)).toMatchObject({ inWindow: false, mark: null });
  });
});

describe("calendar feed", () => {
  const events = [
    ...governanceEvents(OPEN_DECISION),
    ...halvingEvents({
      nextHalvingHeight: 6_132_390,
      estimatedHalvingAt: "2028-11-24T10:00:00Z",
    }),
  ];
  const ics = calendarIcs(events, {
    now: Date.parse("2026-11-16T01:00:00Z"),
    siteUrl: SITE,
  });

  it("publishes all-day events with stable ids and an exclusive end date", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain(
      "UID:governance-nu7-1-poll-coinholders-and-panels-vote@openzcash.org",
    );
    expect(ics).toContain(
      "DTSTART;VALUE=DATE:20261116\r\nDTEND;VALUE=DATE:20261201",
    );
    expect(ics).toContain("DTSTAMP:20261116T010000Z");
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT6H");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(
      OPEN_DECISION.steps.filter((step) => step.to !== null).length,
    );
    // The result has no announced date, so the subscription does not invent one.
    expect(ics).not.toContain("result read");
  });

  it("leaves estimates out and never lets text start a new property", () => {
    expect(ics).not.toContain("halving");
    const hostile = calendarIcs(
      [
        {
          ...day("x", "2026-11-20"),
          title: "Meeting\r\nATTENDEE:mailto:a@b.c",
          note: "a, b; c\\d",
          link: { label: "Bad", href: "javascript:alert(1)" },
        },
      ],
      { now: 0, siteUrl: SITE },
    );
    expect(hostile).toContain("SUMMARY:Meeting ATTENDEE:mailto:a@b.c");
    expect(hostile).not.toMatch(/\r\nATTENDEE/);
    expect(hostile).toContain("DESCRIPTION:a\\, b\\; c\\\\d");
    expect(hostile).not.toContain("javascript:");
  });

  it("folds long lines at 75 octets without splitting a character", () => {
    const folded = fold(`SUMMARY:${"é".repeat(60)}`);
    for (const part of folded.split("\r\n")) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    }
    expect(folded.replace(/\r\n /g, "")).toBe(`SUMMARY:${"é".repeat(60)}`);
    for (const contentLine of ics.split("\r\n")) {
      expect(new TextEncoder().encode(contentLine).length).toBeLessThanOrEqual(
        75,
      );
    }
  });

  it("only links http(s) addresses, made absolute against the site", () => {
    expect(absoluteUrl("/coinholders", SITE)).toBe(
      "https://openzcash.org/coinholders",
    );
    expect(absoluteUrl("https://forum.zcashcommunity.com/t/1", SITE)).toBe(
      "https://forum.zcashcommunity.com/t/1",
    );
    expect(absoluteUrl("webcal://example.org/x.ics", SITE)).toBeNull();
  });
});
