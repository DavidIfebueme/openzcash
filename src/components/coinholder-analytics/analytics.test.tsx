import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  buildCoinholderDashboard,
  parseCoinholderActivity,
  type CoinholderDashboard,
} from "@/lib/coinholder/analytics/model";
import { parseCoinholderRevealHistory } from "@/lib/coinholder/analytics/reveals";
import { CoinholderDashboardView, mergeCoinholderRefresh } from "./dashboard";
import { CoinholderActivityChart, fillCoinholderBuckets, groupCoinholderDays } from "./coinholder-activity";
import { CoinholderShareWeightChart } from "./coinholder-share-weight-chart";
import { CoinholderDecisionChart } from "./coinholder-decision-chart";
import { CoinholderRevealsChart } from "./coinholder-reveals-chart";
import { CoinholderHeatmap } from "./coinholder-heatmap";
import { CoinholderChartAxes, coinholderAxisIndices, coinholderAxisIntervals, coinholderChartGeometry, coinholderCountScale, coinholderPlot, coinholderPointerX, coinholderTooltipPercent } from "./coinholder-chart-axis";

vi.mock("server-only", () => ({}));
const fixture = (name: string) => JSON.parse(readFileSync(`data/coinholder/${name}.json`, "utf8"));
const summary = fixture("q3-2026-summary");
const history = parseCoinholderRevealHistory(fixture("q3-2026-reveals"), summary);
const activity = parseCoinholderActivity(fixture("activity-q3-2026"), fixture("activity-q3-2026-transactions"));
const data = buildCoinholderDashboard(summary, fixture("q3-2026-metadata"), {
  state: "snapshot", checkedAt: "2026-10-09T06:00:00.000Z", snapshotFetchedAt: "2026-10-09T05:00:00.000Z",
  sha256: "fixture", url: "https://zvote.zfnd.org", metadataUrl: "/api/coinholders/verify?round=q3-2026&format=json", warning: null,
}, activity, history);
const noop = () => {};
const numbers = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });

function renderActivity(selectedBallot: number | null = null, initial: CoinholderDashboard = data) {
  return renderToStaticMarkup(<CoinholderActivityChart activity={initial.activity} revealHistory={initial.revealHistory} proposals={initial.proposals} selectedBallot={selectedBallot} onSelectBallot={noop} />);
}

describe("OpenZcash Coinholder analytics", () => {
  it("keeps scroll boxes from stretching the page or trapping page scroll", () => {
    const css = readFileSync("src/app/coinholders/analytics.css", "utf8");
    // Screen-reader helpers are absolutely positioned; a scroll box must be their containing block.
    for (const box of ["coin-data-scroll", "coin-share-weight-scroll", "coin-margin-scroll", "coin-heatmap-scroll"]) {
      expect(css).toMatch(new RegExp(`\\.coin-${box.slice(5)} \\{ position: relative;`));
    }
    expect(css).not.toMatch(/overscroll-behavior:\s*contain/);
  });

  it("renders all seven historical charts and their reading guides inside the native page", () => {
    const html = renderToStaticMarkup(<CoinholderDashboardView initial={data} />);
    expect(html).toContain('class="coinholder-analytics"');
    expect(html).toContain("Q3 2026");
    expect(html).toContain("Finalized");
    for (const chart of ["Cast volume", "Revealed shares", "Shares vs ZEC", "Decision margin", "Reveal heatmap", "Matching tallies", "Recurring amounts"]) {
      expect(html).toContain(`aria-label="${chart}"`);
      expect(html).toContain(`aria-label="How to read ${chart}"`);
      expect(html).toContain(`aria-label="${chart} guide" hidden=""`);
    }
    expect(html).toContain("All 37 proposals");
    expect([...html.matchAll(/preserveAspectRatio="none"/g)]).toHaveLength(2);
    expect(html).toContain("32,598");
    expect(html).toContain("145,620");
    expect(html).toContain('href="/coinholders"');
    expect(html).toContain('href="/coinholders/results?round=q3-2026"');
    expect(html).not.toMatch(/Sign in|Community session|dao-app|\/communities\//);
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it("links selected ballot 8 to curated grant 59, not to the ballot number", () => {
    const html = renderActivity(8);
    expect(html).toContain('href="/coinholders/verify/q3-2026/59"');
    expect(html).toContain("Verify this proposal");
    expect(html).not.toContain('href="/coinholders/verify/q3-2026/8"');
    expect(html).toContain('aria-label="Inspect cast activity"');
    expect(html).toContain('role="slider"');
    expect(html).toContain('aria-valuemin="1"');
    expect(html).toContain("UTC");
    expect(renderActivity()).toContain('href="/coinholders/verify?round=q3-2026"');
    expect(html).toContain("1 proposal, 13 days");
    expect(html).not.toContain("1 proposals");
  });

  it.each(data.proposals.map(proposal => [proposal.ballot, proposal.id] as const))(
    "preserves all four exact share counts and final ZEC amounts for ballot %s (grant %s)",
    (ballot, grantId) => {
      const html = renderToStaticMarkup(<CoinholderShareWeightChart proposals={data.proposals} history={history} selectedBallot={ballot} onSelectBallot={noop} />);
      const rows = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].slice(1);
      expect(rows).toHaveLength(4);
      const source = summary.proposals.find((proposal: { id: number }) => proposal.id === ballot);
      rows.forEach((row, index) => {
        const option = source.options.find((item: { index?: number }) => (item.index ?? 0) === index);
        const count = option.ballot_count ?? 0;
        expect(row[1]).toContain(`${numbers.format(count)} ${count === 1 ? "share" : "shares"}`);
        expect(row[1]).toContain(`${numbers.format((option.total_value ?? 0) / 8)} ZEC`);
      });
      expect(html).toContain(`href="/coinholders/verify/q3-2026/${grantId}"`);
      expect(html).not.toMatch(/NaN|Infinity/);
    },
  );

  it("retains final ZEC and marks unavailable share history without inventing zeros", () => {
    const html = renderToStaticMarkup(<CoinholderShareWeightChart proposals={data.proposals} history={null} selectedBallot={8} onSelectBallot={noop} />);
    expect(html).toContain("60,769.125 ZEC");
    expect(html).toContain("2,012,174.625 ZEC");
    expect(html).toContain("Unavailable");
    expect(html).not.toContain("0 shares");
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it("retains explicit count-versus-weight semantics in guides and accessible labels", () => {
    const html = renderActivity();
    expect(html).toContain("Casts are not wallets or ZEC weight over time");
    expect(html).toContain("share counts do not identify holders");
    expect(html).toContain("Gap is ZEC % minus share %");
    expect(html).toContain("excluding Abstain");
    expect(html).toContain("No shares");
    expect(html).toContain("Use arrow keys to inspect adjacent days and proposals");
  });

  it("retains missing history states across casts, reveals and heatmap", () => {
    expect(renderActivity(null, { ...data, activity: null })).toContain("Activity index unavailable");
    expect(renderToStaticMarkup(<CoinholderRevealsChart history={null} selectedBallot={null} />)).toContain("Share history unavailable");
    expect(renderToStaticMarkup(<CoinholderHeatmap proposals={data.proposals} history={null} selectedBallot={null} onSelectBallot={noop} />)).toContain("Reveal history unavailable");
  });

  it("ranks all proposals and keeps the final threshold separate from the margin", () => {
    const html = renderToStaticMarkup(<CoinholderDecisionChart proposals={data.proposals} selectedBallot={null} onSelectBallot={noop} />);
    expect([...html.matchAll(/data-margin-ballot=/g)]).toHaveLength(37);
    expect([...html.matchAll(/coin-margin-outcome--approved/g)]).toHaveLength(17);
    expect([...html.matchAll(/coin-margin-outcome--rejected/g)]).toHaveLength(20);
    expect(html).toContain("strictly more than 50%");
    expect(html).toContain("420,000 ZEC");
  });

  it("keeps historical series when a source refresh deliberately omits them", () => {
    const { activity: oldActivity, revealHistory: oldReveals, ...fresh } = data;
    const next = mergeCoinholderRefresh(data, { ...fresh, source: { ...data.source, checkedAt: "2026-10-09T06:01:00.000Z" }, activityOmitted: true });
    expect(next.activity).toBe(oldActivity);
    expect(next.revealHistory).toBe(oldReveals);
    expect(next.source.checkedAt).toBe("2026-10-09T06:01:00.000Z");
    const missing = mergeCoinholderRefresh(data, { ...data, activity: null, revealHistory: null });
    expect(missing.activity).toBeNull();
    expect(missing.revealHistory).toBeNull();
  });
});

describe("count axes and UTC bucketing", () => {
  it("fills silent periods without changing the cumulative count", () => {
    const start = Date.parse("2026-09-20T10:00:00Z");
    const buckets = fillCoinholderBuckets([
      { at: "2026-09-20T09:00:00Z", count: 7, cumulative: 7 },
      { at: "2026-09-20T10:00:00Z", count: 3, cumulative: 10 },
      { at: "2026-09-20T12:00:00Z", count: 2, cumulative: 12 },
    ], start, start + 2 * 3_600_000, 3_600_000);
    expect(buckets.map(bucket => [bucket.count, bucket.cumulative])).toEqual([[3, 10], [0, 10], [2, 12]]);
  });
  it("groups the real hourly index into UTC days and preserves the 32,598 casts", () => {
    const days = groupCoinholderDays(activity.hours);
    expect(days.reduce((total, day) => total + day.count, 0)).toBe(32_598);
    expect(days.at(-1)?.cumulative).toBe(32_598);
    expect(days.every(day => day.at.endsWith("T00:00:00.000Z"))).toBe(true);
  });
  it("keeps axes readable with integer steps, including empty and small series", () => {
    expect(coinholderCountScale(4967)).toEqual({ max: 5000, ticks: [0, 1000, 2000, 3000, 4000, 5000] });
    expect(coinholderCountScale(76874)).toEqual({ max: 80000, ticks: [0, 20000, 40000, 60000, 80000] });
    for (let value = 0; value < 100; value++) expect(coinholderCountScale(value).ticks.every(Number.isInteger)).toBe(true);
    expect(coinholderAxisIndices(13, 240)).toEqual([0, 4, 8, 12]);
    expect(coinholderAxisIndices(0)).toEqual([]);
  });
});


describe("responsive chart geometry", () => {
  it("keeps a 152px plot on a narrow screen and aligns axes, tooltips and pointer inspection", () => {
    const geometry = coinholderChartGeometry(
      { width: 218, height: 201.6, left: 58, top: 20 },
      { width: 258, height: 201.6, left: 18, top: 20 },
    )!;
    expect(geometry.scaleX).toBe(.25);
    expect(geometry.scaleY).toBeCloseTo(.8);
    expect(coinholderPlot.height * geometry.scaleY).toBeCloseTo(152);
    expect(coinholderAxisIntervals(geometry)).toBe(5);
    expect(geometry.offsetX).toBe(40);
    expect(geometry.offsetY).toBe(0);
    const center = coinholderPlot.left + coinholderPlot.width / 2;
    const screenCenter = geometry.svgLeft + center * geometry.scaleX;
    expect(coinholderPointerX(screenCenter, geometry)).toBeCloseTo(center);
    expect(coinholderTooltipPercent(center, geometry)).toBeCloseTo((40 + center * .25) / 258 * 100);
    const html = renderToStaticMarkup(<CoinholderChartAxes geometry={geometry} ticks={[0, 5000]} max={5000} labels={[{ x: center, label: "Sep 23" }]} />);
    expect(html).toContain("left:43.5px");
    expect(html).toContain("left:151.75px");
    const dateStyle = html.match(/class="coin-axis-x"[^>]*style="([^"]+)"/)![1];
    expect(Number(dateStyle.match(/top:([\d.]+)px/)![1])).toBeCloseTo(176.8);
    expect(html).toContain("5,000");
  });

  it("preserves desktop proportions and maps first/last periods to the same SVG coordinates", () => {
    const geometry = coinholderChartGeometry({ width: 872, height: 252, left: 300, top: 100 })!;
    expect(geometry.scaleX).toBe(1);
    expect(geometry.scaleY).toBe(1);
    for (const x of [coinholderPlot.left, coinholderPlot.left + coinholderPlot.width]) {
      expect(coinholderPointerX(300 + x, geometry)).toBe(x);
      expect(coinholderTooltipPercent(x, geometry)).toBe(x / 872 * 100);
    }
    expect(coinholderChartGeometry({ width: 0, height: 0, left: 0, top: 0 })).toBeNull();
  });
});
