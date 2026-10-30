import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_CYCLE, cycleDateRange, cycleHref, cyclePhase, cycleWindows } from "@/lib/coinholder/cycles";
import { backOf } from "@/lib/design-routes";
import { CurrentCycle, CycleTimeline, PendingCycle } from "./cycle-view";

const sources = vi.hoisted(() => ({ dashboard: vi.fn(), chain: vi.fn() }));
vi.mock("@/lib/coinholder/analytics/server", () => ({ readCoinholderDashboard: sources.dashboard }));
vi.mock("@/lib/coinholder/vote-chain", () => ({ fetchVoteSummary: sources.chain }));
vi.mock("@/components/coinholder-analytics/dashboard", () => ({ CoinholderDashboardView: () => <div>Archived Q3 voting data</div> }));

import ResultsPage from "./results/page";
import ActivityPage from "./activity/page";
import VerifyPage from "./verify/page";

const NOW = Date.parse("2026-10-30T12:00:00Z");
const params = (round?: string | string[]) => ({ searchParams: Promise.resolve({ round }) });

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  sources.dashboard.mockReset().mockResolvedValue({});
  sources.chain.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("active cycle across Coinholder pages", () => {
  it.each([ResultsPage, ActivityPage, VerifyPage])("opens the pending cycle by default without fetching historical vote data", async (page) => {
    const html = renderToStaticMarkup(await page(params()));
    expect(html).toMatch(/aria-current="page"[^>]*>Q4 2026/);
    expect(html).toContain("Accepting proposals");
    expect(html).toContain("Awaiting publication");
    expect(html).toContain('href="/coinholders/proposals"');
    expect(html).not.toContain("results check out");
    expect(sources.dashboard).not.toHaveBeenCalled();
    expect(sources.chain).not.toHaveBeenCalled();
  });

  it("accepts explicit current-cycle links and normalizes query arrays", async () => {
    for (const page of [ResultsPage, ActivityPage, VerifyPage]) {
      const html = renderToStaticMarkup(await page(params([" Q4-2026 ", "q3-2026"])));
      expect(html).toMatch(/aria-current="page"[^>]*>Q4 2026/);
    }
    expect(sources.dashboard).not.toHaveBeenCalled();
    expect(sources.chain).not.toHaveBeenCalled();
  });

  it("keeps archived results and their verification links tied to Q3", async () => {
    const html = renderToStaticMarkup(await ResultsPage(params("q3-2026")));
    expect(html).toMatch(/aria-current="page"[^>]*>Q3 2026/);
    expect(html).toContain('href="/coinholders/verify?round=q3-2026"');
    expect(html).toContain('href="/coinholders/activity?round=q3-2026"');
    expect(html).not.toContain("The decision is still ahead");
    expect(backOf("/coinholders/verify/q3-2026/55").href).toBe("/coinholders/verify?round=q3-2026");
  });

  it("only loads the activity archive when its round is selected", async () => {
    const html = renderToStaticMarkup(await ActivityPage(params("q3-2026")));
    expect(sources.dashboard).toHaveBeenCalledOnce();
    expect(html).toContain("Archived Q3 voting data");
    expect(html).not.toContain("Voting activity comes next");
    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  it("does not mix pending Q4 into historical aggregate results", async () => {
    const html = renderToStaticMarkup(await ResultsPage(params("all")));
    expect(html).toMatch(/aria-current="page"[^>]*>All rounds/);
    expect(html).not.toContain("Awaiting publication");
    expect(html).not.toContain("The decision is still ahead");
  });
});

describe("announced calendar, not inferred outcomes", () => {
  it("shares the same dated stages and UTC deadline", () => {
    const html = renderToStaticMarkup(<CycleTimeline now={NOW} />);
    for (const stage of cycleWindows()) expect(html).toContain(cycleDateRange(stage.start, stage.end));
    expect(html).toContain("Deadlines at 20:00 UTC");
    expect(html).toContain('aria-current="step"');
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
  });

  it("waits for published evidence even after the scheduled voting window", () => {
    const after = Date.parse(ACTIVE_CYCLE.voteClose) + 1;
    expect(cyclePhase(ACTIVE_CYCLE, after).label).toBe("Awaiting published results");
    for (const view of ["results", "activity", "verify"] as const) {
      const html = renderToStaticMarkup(<PendingCycle view={view} now={after} />);
      expect(html).toContain("Awaiting publication");
      expect(html).not.toContain("aria-current=\"step\"");
      expect(html).not.toMatch(/<table|results check out|0 ZEC|0 votes/);
    }
  });

  it("keeps unapproved requests separate from the fund's commitments", () => {
    const html = renderToStaticMarkup(<CurrentCycle fund />);
    expect(html).toContain("Current requests are not approved commitments");
    expect(html).toContain(`href="${cycleHref("results")}"`);
  });
});
