import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseVoteSummary } from "@/lib/coinholder/verify";
import type { ChainResult } from "@/lib/coinholder/vote-chain";

const RAW = readFileSync(
  join(process.cwd(), "src/lib/coinholder/fixtures/q3-2026-vote-summary.json"),
);
const Q3_ID =
  "2cba66eb16c7581a1692cb0b033785da0131059f645a0d2fb4dc2a5131505e01";
const HASH = "9b858326b8149de92ea6788314a714b521fb2f57215e3742ec9b35b67c6639b5";
const LIVE: ChainResult = {
  ok: true,
  summary: parseVoteSummary(JSON.parse(RAW.toString("utf8"))),
  sha256: HASH,
  bytes: RAW.byteLength,
  host: {
    id: "valar",
    name: "Valar Group",
    origin: "https://prod.vote-chain-primary.valargroup.org",
  },
  url: `https://prod.vote-chain-primary.valargroup.org/shielded-vote/v1/vote-summary/${Q3_ID}`,
  fetchedAt: "2026-09-30T22:36:19.000Z",
};

const chain = vi.hoisted(() => ({ fetchVoteSummary: vi.fn() }));
vi.mock("@/lib/coinholder/vote-chain", () => chain);

import Page, { metadata } from "./page";

const render = async (round = "q3-2026") =>
  renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve(round ? { round } : {}) }),
  );
const rows = (html: string) => (html.match(/<tr>/g) ?? []).length - 1;
/** The page's words without its tags. */
const text = (html: string) => html.replace(/<[^>]+>/g, "");

beforeEach(() => {
  chain.fetchVoteSummary.mockReset();
  chain.fetchVoteSummary.mockResolvedValue(LIVE);
});

describe("Verify it yourself", () => {
  it("checks an explicitly selected Q3 2026 against the live vote chain, with the hash, host and time of the fetch", async () => {
    const html = await render();
    expect(chain.fetchVoteSummary).toHaveBeenCalledWith(Q3_ID);
    // The verdict: every result checks out, in the positive colour, with its three checks.
    expect(html).toContain("Q3 2026 · Coinholder Grants");
    expect(html).toMatch(
      /data-positive="true">37 of 37<\/span> results check out/,
    );
    expect(html).toContain("quorum met on all");
    expect(html).toContain("ZIP 1016 gives the published outcome");
    expect(html).toContain("equals the vote chain");
    expect(html).toContain("all four options · Valar Group");
    // The hash as a short chip, the full hash on hover and for screen readers.
    expect(html).toContain("9b858326…6639b5");
    expect(html).toContain(HASH);
    // The host in full, beside its name.
    expect(text(html)).toContain(
      "from Valar Group (prod.vote-chain-primary.valargroup.org) · 27,480 bytes · fetched Sep 30, 2026, 22:36 UTC",
    );
    expect(html).toContain("Rebuild it yourself");
    expect(html).toContain("coinholder_verify.py");
    expect(rows(html)).toBe(37);
    expect(html).toContain(
      "Published first as Abstain, then corrected to Funded.",
    );
    // Never a voter count, and nothing on share anomalies.
    expect(html).not.toMatch(/\d+ voters|4\.47/);
    // No Q3 outcome turns on whether Abstain counts toward the minimum.
    expect(html).toContain("420,000 ZEC or more, with or without Abstain");
    expect(html).toContain("fetched live and hashed");
    // The later FPF reply clarifies participation and the explicit Abstain choice.
    expect(html).toContain("FPF counting and ballot clarification, October 2, 2026 ↗");
    expect(html).not.toContain("FPF&#x27;s correction");
  });

  it("labels the share column and never rounds a share to 100.0% or 0.0% while the other side has ZEC", async () => {
    const html = await render();
    expect(html).toContain(">Accept share<");
    expect(html).toContain(
      "Accept share is the part of the ZEC for or against that chose Accept, Abstain left out",
    );
    expect(html).not.toContain("Accept %");
    expect(html).toContain(
      "Lower is Reject, would reconsider at a lower amount",
    );
    // Ballots 32, 33 and 34: 99.98%, 99.9997% and 99.995%.
    expect(html).toContain("&gt;99.9%");
    expect(html).not.toContain("100.0%");
  });

  it("still renders every row from the stored tallies when the chain does not answer", async () => {
    chain.fetchVoteSummary.mockResolvedValue({
      ok: false,
      tried: [],
      error: "offline",
      checkedAt: "2026-09-30T22:40:00.000Z",
    });
    const html = await render("q3-2026");
    expect(html).toContain("vote chain unavailable just now");
    expect(html).toContain(
      "this site&#x27;s stored copy, not compared this time",
    );
    expect(html).toContain(
      "Asked prod.vote-chain-primary.valargroup.org and zvote.zfnd.org at Sep 30, 2026, 22:40 UTC; neither answered.",
    );
    // Not the positive colour: the chain check did not run.
    expect(html).not.toContain("data-positive");
    expect(html).toContain("37 of 37</span> results check out");
    expect(html).not.toContain(HASH);
    expect(rows(html)).toBe(37);
    // What the page checked says so too: no comparison ran this time.
    expect(html).not.toContain("fetched live and hashed");
    expect(html).toContain(
      "The comparison with the vote chain did not run this time",
    );
  });

  it("marks a tally that differs from the chain", async () => {
    const j = JSON.parse(RAW.toString("utf8"));
    j.proposals[13].options[2].total_value += 1;
    chain.fetchVoteSummary.mockResolvedValue({
      ...LIVE,
      summary: parseVoteSummary(j),
    });
    const html = await render();
    expect(html).toContain("36 of 37</span> results check out");
    expect(html).not.toContain("data-positive");
    expect(html).toContain(
      "#14 Connaugh Zcash Videos does not: its tally differs from the vote chain.",
    );
    expect(html).toContain("differs from the vote chain on 1 of 37");
    expect(html).toContain("chain differs");
    expect(html).toContain("1 of 37 tallies differs");
    expect(html).toContain(
      "Vote chain: Accept 757,044.250 · Reject 187,236.625 · Lower 196,044.125",
    );
  });

  it("shows how a Coin Voting round is recounted, without a live check", async () => {
    const html = await render("Q1-2026");
    expect(chain.fetchVoteSummary).not.toHaveBeenCalled();
    expect(html).toContain("Recount it yourself");
    expect(html).toContain("https://github.com/hhanh00/zcv");
    expect(html).toContain(
      "tallies from the Voting Authorities&#x27; recount ↗",
    );
    expect(html).toContain("recounted with the published election seed");
    expect(html).not.toContain("equals the vote chain");
    // No tabs for a round with one way to check it.
    expect(html).not.toContain('role="tablist"');
    expect(html).toContain("6 of 6</span> results check out");
    expect(html).toContain("1 Funded · 5 Rejected");
    expect(html).toContain("6 tallies");
    expect(rows(html)).toBe(7);
    expect(html).toContain(
      "a single election covering all seven questions, with one seed",
    );
    expect(html).toContain("cargo build --release");
    expect(html).toContain(">Approve share<");
  });

  it("says where the Q1 2026 minimum depends on Abstain, and that no outcome does", async () => {
    const html = await render("q1-2026");
    expect(html).toContain("with Abstain · 4 of 6 without");
    expect(html).toContain(
      "Under FPF’s current counting rule, Abstain counts toward the 420,000 ZEC minimum: all 6 met it. For comparison, without Abstain, ZChat and zcash.me did not. Both were rejected either way.",
    );
  });

  it("does not claim to have checked a Coin Voting round's figures against its post", async () => {
    for (const round of ["q1-2026", "q4-2025", "ratification-2025"]) {
      const html = await render(round);
      expect(html, round).not.toContain(
        "Each tally is the one its source published",
      );
      expect(html, round).toContain("That each figure here matches");
    }
    expect(await render("ratification-2025")).toContain(
      "applied for comparison only: the poll set the program&#x27;s terms",
    );
  });

  it("draws how each proposal was decided: highest Accept share first, Abstain left out, every figure for screen readers", async () => {
    const html = await render();
    expect(html).toContain("How each proposal was decided");
    expect(html).toContain(
      "ZEC for or against · the line is 50% · Abstain left out",
    );
    expect(html).toMatch(/aria-pressed="true"[^>]*>Accept share</);
    expect(html).toContain("Outcome and Accept share on the right");
    expect(html).not.toContain("Right:");
    expect(html).toContain(">Ballot #<");
    // Ballot 33 has the highest share (99.9997%), so the chart opens with it.
    const chart = html.slice(html.indexOf('id="decided"'));
    expect(chart.indexOf("#33 Ironwood zk-SNARK")).toBeLessThan(
      chart.indexOf("#34 Orchard Counterfeiting"),
    );
    expect(html).toContain(
      "#14 Connaugh Zcash Videos. Accept 757,044.250 ZEC, Reject 187,236.625 ZEC, Reject at a lower amount 196,044.000 ZEC, Abstain 1,038,923.250 ZEC; 2,179,248.125 ZEC in all. Accept 66.4% of the ZEC for or against. ZIP 1016 gives Funded. Published: Funded.",
    );
    expect(html).toContain(">corrected<");
    expect(html).toContain(">Funded<");
    expect(html).toContain(">80.6%<");
  });

  it("says the ratification poll's options as Yes and No", async () => {
    const html = await render("ratification-2025");
    expect(html).toContain("How each question was decided");
    expect(html).toContain("ZEC for Yes or No · the line is 50%");
    expect(html).toContain(">Yes share<");
    expect(html).toContain("3 of 3</span> results check out");
    expect(html).toContain("3 Passed");
  });

  it("says on the Q4 2025 recount that the vetoed grant passed the rule", async () => {
    const html = await render("q4-2025");
    expect(html).toContain("Include transparent votes and reconcile units");
    expect(html).toContain("shielded + transparent, for each option");
    expect(html).toContain("separately rounded totals");
    expect(html).toContain("5 Funded · 4 Rejected");
    expect(html).toContain(
      "the same rule gives every published outcome. The vetoed grant passed the rule, so the rule counts it Funded; the veto came afterwards.",
    );
    expect(await render("q1-2026")).not.toContain(
      "The vetoed grant passed the rule",
    );
  });

  it("offers the rebuild three ways, each step with its expected result from the round's data", async () => {
    const html = await render();
    for (const tab of ["curl + jq", "Python", "Spreadsheet"])
      expect(html).toContain(`>${tab}</button>`);
    expect(html).toContain('role="tablist"');
    // The steps shorten the hash as the verdict does, and the Fetch step gives it in full.
    expect(html).toContain("37 rows · sha256 9b858326…6639b5");
    expect(html).not.toContain("9b85…39b5");
    expect(html).toContain(
      `The hash should match the one above, in full: <code>${HASH}</code>.`,
    );
    // The Python steps say what each does.
    for (const title of ["Download the script", "Run it", "Compare"])
      expect(html).toContain(`>${title}</span>`);
    expect(html).toContain("37 rows × 4 options");
    expect(html).toContain("17 Funded · 20 Rejected");
    expect(html).toContain("compare: 37 of 37 agree");
    expect(html).toContain("37 rows + header");
    expect(html).toContain(
      "=IMPORTDATA(&quot;https://openzcash.org/api/coinholders/verify?round=q3-2026&amp;format=csv&quot;)",
    );
    expect(html).toContain(
      "=IF(AND(E2+F2+G2+H2&gt;=420000, E2&gt;F2+G2), &quot;Funded&quot;, &quot;Rejected&quot;)",
    );
    expect(html).toContain(
      "This path checks the rule on OpenZcash&#x27;s numbers.",
    );
    // The one-liner and the Python compare are still there.
    expect(html).toContain("In one line: curl and jq");
    expect(html).toContain(
      "--compare &#x27;https://openzcash.org/api/coinholders/verify?round=q3-2026&amp;format=json&#x27;",
    );
  });

  it("folds every figure under a disclosure, below the guide and above what the page does not check", async () => {
    const html = await render();
    expect(html).toMatch(
      /<details[^>]*><summary><h2 id="every"[^>]*>All figures <span>\(37 proposals\)<\/span>/,
    );
    expect(html.indexOf('id="rebuild"')).toBeLessThan(
      html.indexOf('id="every"'),
    );
    expect(html.indexOf('id="every"')).toBeLessThan(
      html.indexOf('id="limits"'),
    );
    // Collapsed by default.
    expect(html).not.toMatch(
      /<details[^>]* open=""[^>]*><summary><h2 id="every"/,
    );
  });

  it("does not silently verify Q3 for an unsupported round", async () => {
    const html = await render("q2-2026");
    expect(html).not.toContain(HASH);
    expect(chain.fetchVoteSummary).not.toHaveBeenCalled();
  });

  it("shares a card for the pending current round", () => {
    const [image] = metadata.openGraph?.images as { url: string }[];
    expect(
      new URL(image.url, "https://openzcash.org").searchParams.get("n"),
    ).toBe("Q4 2026 · In progress");
    expect(metadata.openGraph).toMatchObject({ url: "/coinholders/verify" });
  });
});
