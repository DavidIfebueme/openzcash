import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildCoinholderDashboard, parseCoinholderActivity } from "@/lib/coinholder/analytics/model";
import { CoinholderTallyMatchChart } from "./coinholder-tally-match";
import { CoinholderRecurringAmounts, recurringAxis } from "./coinholder-recurring-amounts";

const fixture = (name: string) => JSON.parse(readFileSync(`data/coinholder/${name}.json`, "utf8"));
const activity = parseCoinholderActivity(fixture("activity-q3-2026"), fixture("activity-q3-2026-transactions"));
const data = buildCoinholderDashboard(fixture("q3-2026-summary"), fixture("q3-2026-metadata"), {
  state: "snapshot", checkedAt: "2026-10-09T06:00:00.000Z", snapshotFetchedAt: "2026-10-09T05:00:00.000Z",
  sha256: "fixture", url: "https://zvote.zfnd.org", metadataUrl: "/api/coinholders/verify?round=q3-2026&format=json", warning: null,
}, activity);
const noop = () => {};
const matching = (selectedBallot: number | null) => renderToStaticMarkup(<CoinholderTallyMatchChart proposals={data.proposals} activity={data.activity} selectedBallot={selectedBallot} onSelectBallot={noop} />);
const recurring = (selectedBallot: number | null) => renderToStaticMarkup(<CoinholderRecurringAmounts proposals={data.proposals} selectedBallot={selectedBallot} onSelectBallot={noop} />);

describe("Coinholder tally-pattern insights", () => {
  it("shows matching tallies with their groups, the shared electorate and a data table", () => {
    const html = matching(null);
    expect(html).toContain('aria-label="Matching tallies"');
    expect(html).toContain("26 of 37");
    expect(html).toContain("Funded · near-unanimous");
    expect(html).toContain("Rejected · ~284K ZEC abstained");
    expect(html).toContain("Rejected · ~182K ZEC chose lower amount");
    expect(html).toContain("About the same ZEC voted on every proposal: 2,179,029.875–2,181,452.875 ZEC, from 877 to 888 casts each.");
    expect(html).toContain("Groups chain pairs within 2% of the vote.");
    expect(html).toContain("<td>#32 Ironwood external audit reimbursement</td><td>A</td><td>#33</td><td>1,580.25</td><td>0.07%</td>");
    expect([...html.matchAll(/class="coin-match-cell /g)]).toHaveLength(37 * 36);
    expect(html).toContain("Hover, focus or tap a cell to compare two proposals.");
    expect(html).toContain('role="slider"');
    expect(html).toContain('aria-valuetext="#27 Bonus Grant — Ironwood zk-SNARK Formal Verification and #28 CipherScan: 5,450.5 ZEC apart, 0.25% of the vote"');
    expect(html).not.toMatch(/NaN|Infinity|undefined/);
  });

  it("describes a selected proposal by its nearest tally", () => {
    const html = matching(14);
    expect(html).toContain("No near-copy");
    expect(html).toContain("Nearest: #23 Expanding Zcash In Unstoppable Wallet");
    expect(html).toContain("679,573.125 ZEC apart · 31.18% of the vote");
    expect(html).toContain('aria-pressed="true" aria-label="Select #14 Connaugh Zcash Videos"');
    expect(matching(33)).toContain("Group A · Funded · near-unanimous");
  });

  it("shows recurring amounts and the cap on any block that voted alike everywhere", () => {
    const html = recurring(null);
    expect(html).toContain('aria-label="Recurring amounts"');
    expect(html).toContain("<strong>×13</strong><span>largest repeat · Abstain</span>");
    expect(html).toContain("Abstain · 13 proposals");
    expect(html).toContain("104,432.375–113,478.375 ZEC");
    expect(html).toContain("No single voter held a majority of the ZEC voted.");
    expect(html).toContain("Connaugh Zcash Videos had the smallest leading option of any proposal: Abstain, 1,038,923.25 ZEC, 47.67% of all ZEC voted on it.");
    expect(html).toContain("It is also the only proposal whose Abstain alone could have reversed the outcome.");
    expect(html).toContain('<p role="status" aria-live="polite"><strong>Abstain · 13 proposals</strong>');
    expect([...html.matchAll(/class="coin-repeat-count/g)]).toHaveLength(5);
    expect(html).toContain(">1.25M</span>");
    expect(html).not.toMatch(/NaN|Infinity|undefined/);
  });

  it("marks a selected proposal on both scales", () => {
    const html = recurring(14);
    expect([...html.matchAll(/coin-repeat-tick[^"]*is-selected/g)]).toHaveLength(2);
    expect(html).toContain("Lower amount 196,044 ZEC · recurs ×4");
  });

  it("keeps the server-side summary schemas out of the client bundle", () => {
    // model.ts builds Zod schemas at load time; the panels may only import its types.
    for (const file of ["src/components/coinholder-analytics/coinholder-tally-match.tsx", "src/components/coinholder-analytics/coinholder-recurring-amounts.tsx", "src/lib/coinholder/analytics/tally-patterns.ts"]) {
      expect(readFileSync(file, "utf8")).not.toMatch(/import\s+\{[^}]*\}\s+from\s+"@\/lib\/coinholder\/analytics\/model"/);
    }
  });

  it("builds a zero-based axis of whole-ZEC steps", () => {
    expect(recurringAxis(8_311_386n)).toEqual({ maxUnits: 10_000_000n, ticks: [0n, 2_000_000n, 4_000_000n, 6_000_000n, 8_000_000n, 10_000_000n] });
    expect(recurringAxis(0n)).toEqual({ maxUnits: 800_000n, ticks: [0n, 800_000n] });
  });
});
