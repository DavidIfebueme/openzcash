import { describe, expect, it } from "vitest";
import { ROUNDS } from "./rounds";
import { PROGRAM } from "./program";
import {
  QUORUM_ZEC,
  approvalShare,
  castZec,
  decidedZec,
  summarize,
  voteValue,
} from "./derive";
import days from "@/data/funding/days.json";
import { APPS, overviewEntry, paletteEntries, placeOf } from "@/lib/design-routes";
import type { Round } from "./types";

const round = (id: string): Round => {
  const r = ROUNDS.find((x) => x.id === id);
  if (!r) throw new Error(`missing round ${id}`);
  return r;
};
const cents = (usd: number) => Math.round(usd * 100);

describe("Coinholder program rounds", () => {
  it("lists every round once, newest first, with the Q3 2026 results at the program home", () => {
    expect(ROUNDS.map((r) => r.id)).toEqual([
      "q3-2026",
      "q2-2026",
      "q1-2026",
      "q4-2025",
      "ratification-2025",
    ]);
    expect(new Set(ROUNDS.map((r) => r.id)).size).toBe(ROUNDS.length);
    for (const r of ROUNDS) {
      expect(new Set(r.proposals.map((p) => p.id)).size, r.id).toBe(
        r.proposals.length,
      );
      for (const link of [...r.sources, ...r.proposals.flatMap((p) => p.links)])
        expect(link.href, `${r.id} ${link.label}`).toMatch(/^https:\/\//);
    }
  });

  it("matches FPF's Q3 2026 results as corrected on September 30: 37 proposals, 17 funded, 20 rejected", () => {
    const q3 = round("q3-2026");
    const s = summarize(q3);
    expect(s.questions).toBe(37);
    expect(s.counts).toEqual({ funded: 17, rejected: 20 });
    expect(s.requestedUsdCents).toBe(cents(9_014_383.2));
    expect(s.fundedRequestedUsdCents).toBe(cents(8_389_992));
    // Every Q3 proposal is keyed by its FPF GitHub issue and links to it.
    for (const p of q3.proposals)
      expect(
        p.links.some((l) => l.href.endsWith(`/issues/${p.id}`)),
        p.title,
      ).toBe(true);
    const connaugh = q3.proposals.find((p) => p.id === "55")!;
    expect(connaugh.outcome).toBe("funded");
    expect(connaugh.correction?.href).toContain("/57909/4");
  });

  it("keeps the Q3 tallies on the vote chain's 0.125 ZEC grid, with the published turnout range", () => {
    const q3 = round("q3-2026");
    const cast = q3.proposals.map((p) => castZec(p.tally!));
    for (const p of q3.proposals) {
      for (const v of Object.values(p.tally!))
        expect(Number.isInteger(v * 8), `${p.title}: ${v}`).toBe(true);
    }
    expect(Math.min(...cast)).toBe(2_179_029.875);
    expect(Math.max(...cast)).toBe(2_181_452.875);
    const connaugh = q3.proposals.find((p) => p.id === "55")!.tally!;
    expect(decidedZec(connaugh)).toBe(1_140_324.875);
    expect(approvalShare(connaugh)!).toBeCloseTo(0.6639, 3);
  });

  it("agrees with ZIP 1016 as applied (quorum on all ZEC voted, majority without abstentions) on every Q3 and Q1 question", () => {
    for (const id of ["q3-2026", "q1-2026"]) {
      for (const p of round(id).proposals.filter(
        (x) => x.tally && x.outcome !== "discarded",
      )) {
        const passes =
          castZec(p.tally!) >= QUORUM_ZEC &&
          (approvalShare(p.tally!) ?? 0) > 0.5;
        expect(p.outcome === "funded", `${id} ${p.title}`).toBe(passes);
      }
    }
  });

  it("records the Q1 2026 round with its discarded seventh question and the single funded proposal", () => {
    const q1 = round("q1-2026");
    expect(summarize(q1).counts).toEqual({
      funded: 1,
      rejected: 5,
      discarded: 1,
    });
    for (const p of q1.proposals.filter((x) => x.tally))
      expect(castZec(p.tally!), p.title).toBeCloseTo(500_607.94, 2);
    expect(
      q1.proposals.find((p) => p.outcome === "discarded")?.tally,
    ).toBeNull();
  });

  it("records the Q4 2025 round: five approved, one of them vetoed, $121,941 paid", () => {
    const q4 = round("q4-2025");
    const s = summarize(q4);
    expect(s.counts).toEqual({ funded: 4, vetoed: 1, rejected: 4 });
    expect(s.requestedUsdCents).toBe(cents(5_618_665));
    expect(s.fundedRequestedUsdCents).toBe(cents(121_941));
    for (const p of q4.proposals) {
      const approved = p.tally!.approve > p.tally!.reject;
      expect(["funded", "vetoed"].includes(p.outcome), p.title).toBe(approved);
      expect(castZec(p.tally!), p.title).toBeGreaterThanOrEqual(QUORUM_ZEC);
    }
  });

  it("keeps the ratification poll and the postponed Q2 round, whose submissions were all decided in Q3", () => {
    const ratification = round("ratification-2025");
    expect(summarize(ratification).counts).toEqual({ passed: 3 });
    expect(
      Math.max(...ratification.proposals.map((p) => castZec(p.tally!))),
    ).toBe(1_494_765);
    const q2 = round("q2-2026");
    expect(q2.proposals).toHaveLength(0);
    const q3Issues = new Set(round("q3-2026").proposals.map((p) => p.id));
    expect(q2.carriedOver).toHaveLength(9);
    for (const c of q2.carriedOver!)
      expect(q3Issues.has(c.href.split("/").pop()!), c.title).toBe(true);
  });
});

describe("Round calendars", () => {
  it("dates every phase drawn to scale in agreement with its label, in order", () => {
    const day = (iso: string) =>
      new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
    for (const r of ROUNDS) {
      const dated = r.windows.filter((w) => w.start && w.end);
      let last = "";
      for (const w of dated) {
        expect(w.value.startsWith(day(w.start!)), `${r.id} ${w.label}`).toBe(true);
        expect(w.value, `${r.id} ${w.label}`).toContain(day(w.end!));
        expect(w.start! <= w.end! && w.start! > last, `${r.id} ${w.label}`).toBe(true);
        last = w.end!;
      }
    }
    expect(round("q3-2026").windows.every((w) => w.start && w.end)).toBe(true);
  });
});

describe("Value of the vote", () => {
  it("prices every vote at the Bitfinex close of the day it ended, matching the site's daily price series", () => {
    const close = new Map(
      (days.rows as [string, number, number, number | null][]).map((r) => [r[0], r[3]]),
    );
    for (const r of ROUNDS) {
      expect(r.closePrice === null, r.id).toBe(r.status === "postponed");
      if (r.closePrice && close.has(r.closePrice.date))
        expect(r.closePrice.usd, r.id).toBe(close.get(r.closePrice.date));
    }
    // Q3 closed after the series ends; its close is pinned here.
    expect(round("q3-2026").closePrice).toEqual({ usd: 1399.9, date: "2026-09-29" });
  });

  it("values the ZEC that voted at the close and today, and the requests against it", () => {
    const v = voteValue(round("q3-2026"), 1000)!;
    expect(v.zec).toBe(2_181_452.875);
    expect(v.atCloseUsd).toBeCloseTo(2_181_452.875 * 1399.9, 2);
    expect(v.todayUsd).toBe(2_181_452_875);
    expect(v.requestedShareOfStake!).toBeCloseTo(9_014_383.2 / (2_181_452.875 * 1399.9), 10);
    expect(voteValue(round("q2-2026"), 1000)).toBeNull();
    expect(voteValue(round("q1-2026"), null)!.todayUsd).toBeNull();
  });
});

describe("Program navigation", () => {
  it("sits above ZCG under its short name, with the official name as the tooltip, and FPF as administrator", () => {
    const ids = APPS.map((a) => a.id);
    expect(ids.indexOf("coinholders")).toBe(ids.indexOf("zcg") - 1);
    const app = APPS.find((a) => a.id === "coinholders")!;
    expect(app.label).toBe("Coinholder Grants");
    expect(app.sub).toBe(PROGRAM.officialName);
    expect(app.href).toBe("/coinholders");
    expect(app.pages.filter((p) => !p.hidden).map((p) => p.label)).toEqual(["Program overview", "Proposals", "Results", "Voting activity", "Verify it yourself", "The fund", "Coinholder Copilot"]);
    // Verification remains directly after activity in the program menu.
    expect(app.pages.find((p) => p.href === "/coinholders/verify")?.hidden).toBeFalsy();
    // …but ⌘K finds it; other hidden pages stay out of the palette.
    expect(paletteEntries(app).map((p) => p.label)).toEqual(["Program overview", "Proposals", "Results", "Voting activity", "Verify it yourself", "The fund", "Coinholder Copilot"]);
    const zcg = APPS.find((a) => a.id === "zcg")!;
    expect(paletteEntries(zcg).map((p) => p.label)).not.toContain("Stipends");
    expect(APPS.find((a) => a.id === "fpf")).toMatchObject({ sub: "Program administrator", pages: [] });
    // Each fund's share of every block reward, beside its name in the sidebar.
    expect(app.share?.value).toBe("12%");
    expect(APPS.find((a) => a.id === "zcg")?.share?.value).toBe("8%");
  });
  it("lists each app's landing page as an Overview entry when the app has inner pages", () => {
    const app = (id: string) => APPS.find((a) => a.id === id)!;
    expect(overviewEntry(app("coinholders"))).toBeNull();
    expect(overviewEntry(app("zcg"))).toMatchObject({ href: "/zcg", label: "Overview" });
    // An app without inner pages is its own page: nothing to list.
    expect(overviewEntry(app("news"))).toBeNull();
    expect(overviewEntry(app("ongoing-test"))).toBeNull();
    for (const a of APPS.filter((x) => x.pages.length && !x.navigationOnly))
      expect(overviewEntry(a) !== null || a.pages.some((p) => p.href === a.href), a.id).toBe(true);
  });
  it("places the overview, results, fund and copilot inside the program", () => {
    expect(placeOf("/coinholders")).toMatchObject({ app: { id: "coinholders" } });
    expect(placeOf("/coinholders")?.page).toBeUndefined();
    for (const [path, label] of [["/coinholders/activity", "Voting activity"], ["/coinholders/results", "Results"], ["/coinholders/fund", "The fund"], ["/coinholders/verify", "Verify it yourself"], ["/zcg/coinholder/copilot", "Coinholder Copilot"]]) {
      expect(placeOf(path)?.page?.label, path).toBe(label);
    }
    expect(placeOf("/zcg/fpf")?.app.id).toBe("fpf");
  });
});
