import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUNDS } from "@/lib/coinholder/rounds";
import { parseVoteSummary, verifyRound } from "@/lib/coinholder/verify";
import { proposalVerifyHref } from "@/lib/coinholder/proposal-decision";
import { zecDigits } from "@/lib/coinholder/verify-export";
import { backOf } from "@/lib/design-routes";
import { ProposalDetail } from "./proposal-detail";
import { ResultsBoard } from "../results-board";

const chain = vi.hoisted(() => ({ fetchVoteSummary: vi.fn() }));
vi.mock("@/lib/coinholder/vote-chain", () => chain);
import Page from "./[round]/[proposal]/page";
const raw = JSON.parse(readFileSync("src/lib/coinholder/fixtures/q3-2026-vote-summary.json", "utf8"));
beforeEach(() => chain.fetchVoteSummary.mockResolvedValue({ ok: true, summary: parseVoteSummary(raw), sha256: "a".repeat(64), bytes: 100, host: { name: "Valar Group", origin: "https://prod.vote-chain-primary.valargroup.org" }, url: "https://prod.vote-chain-primary.valargroup.org/tally", fetchedAt: "2026-10-02T19:45:00.000Z" }));
const render = async (round: string, proposal: string) => renderToStaticMarkup(await Page({ params: Promise.resolve({ round, proposal }) }));

describe("proposal detail route", () => {
  it("shows a corrected result, exact tallies, both arithmetic tests, and dated FPF attribution", async () => {
    const html = await render("q3-2026", "55");
    expect(html).toContain("Connaugh Zcash Videos");
    expect(html).toContain("2,179,248.125");
    expect(html).toContain("<title>Accept: 757,044.250 ZEC</title>");
    expect(html).toContain("570,162.4375");
    expect(html).toContain("66.4%");
    expect(html).toContain("34.7%");
    expect(html).toContain("Key numbers");
    expect(html).toContain("Vote totals, all options");
    expect(html).toContain("Majority cutoff (50%)");
    expect(html).toContain("Directional vote, without Abstain");
    expect(html).toContain("Reject, do not support");
    expect(html).toContain("Reject, lower amount");
    expect(html).toContain("with or without Abstain");
    expect(html).toContain("Corrected after publication");
    expect(html).toContain("FPF’s current counting rule");
    expect(html).toContain("/57909/19");
    expect(html).toContain("explicit choice, not a default");
    expect(html).toContain("Verify it yourself");
    expect(html).toContain("Every option matches the vote-chain summary");
    expect(html).toContain("select(.id == 14)");
    expect(html).toContain("not proof of disbursement");
  });

  it.each([
    { ballot: 4, id: "60", result: "funded", shares: ["99.9%", "0.1%", "&lt;0.1%", "Excluded"] },
    { ballot: 13, id: "48", result: "rejected", shares: ["11.3%", "87.9%", "0.7%", "Excluded"] },
    { ballot: 14, id: "55", result: "funded", shares: ["66.4%", "16.4%", "17.2%", "Excluded"] },
  ])("explains the rule and both percentage bases on ballot #$ballot", async ({ id, result, shares }) => {
    const html = await render("q3-2026", id);
    const tally = html.match(/<table[^>]*><caption>Vote totals, all options<\/caption>[\s\S]*?<\/table>/)![0];
    expect(tally).toContain("% of all votes");
    expect(tally).toContain("% of directional vote");
    const body = tally.match(/<tbody>([\s\S]*?)<\/tbody>/)![1];
    const lastCells = [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(row =>
      [...row[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].at(-1)![1].replace(/<[^>]*>/g, ""));
    expect(lastCells).toEqual(shares);
    const verdict = html.slice(html.indexOf(`<h2>Proposal ${result}</h2>`), html.indexOf("<table"));
    expect(verdict).toContain("FPF’s current counting rule:");
    expect(verdict).toContain("All votes, including Abstain, count toward the 420,000 ZEC participation threshold. Abstain is excluded from the approval majority.");
    const directionalRow = html.match(/<tr><th scope="row">Directional vote[^<]*<\/th>([\s\S]*?)<\/tr>/)![1];
    expect(directionalRow).not.toMatch(/✓|×|data-met|aria-label/);
    expect(html).toContain('aria-label="Minimum met"');
  });

  it.each([0, 420000])("shows undefined directional percentages for an all-Abstain tally of %s", abstain => {
    const base = ROUNDS.find(r => r.id === "q3-2026")!;
    const proposal = { ...base.proposals[0], tally: { approve: 0, reject: 0, rejectLower: 0, abstain } };
    const round = { ...base, proposals: [proposal] };
    const check = verifyRound(round);
    const html = renderToStaticMarkup(<ProposalDetail round={round} proposal={proposal} row={check.rows[0]} chain={null} digits={3} poll={false} />);
    const tally = html.match(/<table[^>]*><caption>Vote totals, all options<\/caption>[\s\S]*?<\/table>/)![0];
    expect(tally).not.toMatch(/NaN|Infinity/);
    expect(tally).toMatch(/<td>—<\/td><\/tr><\/tfoot>/);
    expect(tally).toContain("Excluded");
    expect(html).toContain("No directional votes were cast.");
  });

  it("handles every historical question and preserves veto and discarded states", () => {
    for (const round of ROUNDS) {
      const check = verifyRound(round);
      for (const proposal of round.proposals) {
        const row = check.rows.find(r => r.id === proposal.id)!;
        const html = renderToStaticMarkup(<ProposalDetail round={round} proposal={proposal} row={row} chain={null} digits={zecDigits(check)} poll={check.kind === "poll"} />);
        if (proposal.outcome === "discarded") { expect(html).toContain("No published tally"); expect(html).not.toContain("<svg"); }
        if (proposal.outcome === "vetoed") { expect(html).toContain("Passed, then vetoed"); expect(html).not.toContain("Proposal funded</h2>"); }
        if (check.kind === "poll") expect(html).toContain("For comparison only");
        if (round.id !== "q3-2026") {
          expect(html).not.toContain('href="/verify/coinholder_verify.py"');
          expect(html).toContain(`/coinholders/verify?round=${round.id}#recount`);
        }
      }
    }
  });

  it("does not claim live verification when the chain is unavailable", async () => {
    chain.fetchVoteSummary.mockResolvedValue({ ok: false, error: "Unavailable", checkedAt: "2026-10-02T19:45:00.000Z" });
    const html = await render("q3-2026", "55");
    expect(html).toContain("not a fresh verification");
    expect(html).not.toContain("Every option matches");
  });

  it("returns not found for unknown rounds, unknown proposals, and ballot-number guesses", async () => {
    await expect(render("q5-2026", "55")).rejects.toThrow();
    await expect(render("q3-2026", "not-a-proposal")).rejects.toThrow();
    await expect(render("q2-2026", "55")).rejects.toThrow();
  });

  it("links every proposal title from results, and keeps the shell in the verify hierarchy", () => {
    for (const round of ROUNDS.filter(r => r.proposals.length)) {
      const html = renderToStaticMarkup(<ResultsBoard roundId={round.id} proposals={round.proposals} ballot={round.ballot} />);
      for (const proposal of round.proposals) {
        const href = proposalVerifyHref(round.id, proposal.id);
        expect(html).toContain(`href="${href}"`);
        expect(backOf(href)).toEqual({ href: "/coinholders/verify", label: "Verify it yourself" });
      }
    }
  });

  it("corrects Q3's default-Abstain claim without rewriting the Q1 interface history", () => {
    const q3 = ROUNDS.find(r => r.id === "q3-2026")!;
    const q1 = ROUNDS.find(r => r.id === "q1-2026")!;
    expect(q3.votingSystem).toContain("explicitly select Abstain");
    expect(q3.turnout).not.toContain("defaults");
    expect(q1.votingSystem).toContain("defaulting to Abstain");
  });
});
