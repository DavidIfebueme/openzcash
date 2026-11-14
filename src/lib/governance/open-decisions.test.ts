import { describe, expect, it } from "vitest";
import {
  OPEN_DECISION,
  pollStatus,
  stepStates,
  todayUtc,
} from "./open-decisions";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("the open decision", () => {
  it("keeps its calendar in date order", () => {
    const starts = OPEN_DECISION.steps.map((step) => step.from);
    expect(starts).toEqual([...starts].sort());
    for (const step of OPEN_DECISION.steps) {
      expect(step.from).toMatch(ISO_DATE);
      if (step.to !== null) {
        expect(step.to).toMatch(ISO_DATE);
        expect(step.to >= step.from).toBe(true);
      }
    }
  });

  it("points only to public sources", () => {
    const links = OPEN_DECISION.pointers.flatMap((pointer) => pointer.links);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link.href).toMatch(/^https:\/\//);
    expect(OPEN_DECISION.source.href).toMatch(/^https:\/\//);
    expect(OPEN_DECISION.reviewedAt).toMatch(ISO_DATE);
  });

  it("marks the step in progress on a given day", () => {
    expect(stepStates(OPEN_DECISION.steps, "2026-11-14")).toEqual([
      "done",
      "done",
      "now",
      "next",
      "next",
    ]);
  });

  it("moves on once voting starts and after it ends", () => {
    expect(stepStates(OPEN_DECISION.steps, "2026-11-16")).toEqual([
      "done",
      "done",
      "done",
      "now",
      "next",
    ]);
    expect(stepStates(OPEN_DECISION.steps, "2026-12-05")).toEqual([
      "done",
      "done",
      "done",
      "done",
      "now",
    ]);
  });

  it("marks nothing as in progress before the calendar starts", () => {
    expect(stepStates(OPEN_DECISION.steps, "2026-10-01")).toEqual([
      "next",
      "next",
      "next",
      "next",
      "next",
    ]);
  });

  it("says whether the polls are open", () => {
    expect(pollStatus(OPEN_DECISION, "2026-11-14")).toBe("before");
    expect(pollStatus(OPEN_DECISION, "2026-11-16")).toBe("open");
    expect(pollStatus(OPEN_DECISION, "2026-11-30")).toBe("open");
    expect(pollStatus(OPEN_DECISION, "2026-12-01")).toBe("closed");
  });

  it("reads the day in UTC", () => {
    expect(todayUtc(new Date("2026-11-15T23:30:00-05:00"))).toBe("2026-11-16");
    expect(todayUtc(new Date("2026-11-16T00:00:00Z"))).toBe("2026-11-16");
  });
});
