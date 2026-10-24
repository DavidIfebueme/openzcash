import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { payoutSummary } from "@/lib/coinholder/fund";
import {
  COINHOLDER_SHEET_URL,
  FUND_MULTISIG,
  PAYOUTS,
} from "@/lib/coinholder/program";
import { ROUNDS } from "@/lib/coinholder/rounds";
import { Payouts } from "./payouts";

const render = (summary = payoutSummary(PAYOUTS, ROUNDS)) =>
  renderToStaticMarkup(
    <Payouts
      summary={summary}
      sheetUrl={COINHOLDER_SHEET_URL}
      multisigUrl={FUND_MULTISIG.explorer}
    />,
  );
const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/\s+/g, " ");

describe("Payouts panel", () => {
  const html = render();
  const text = textOf(html);

  it("totals what has left the fund: 7,887.125 ZEC for $8,556,933 across 22 grants in 3 rounds", () => {
    expect(text).toContain("7,887.125 ZEC");
    expect(text).toContain("22 grants in 3 rounds");
    expect(text).toContain("$8,556,933");
  });

  it("shows the Q3 2026 payout of Oct 16, 2026 with its ZEC and the price it implies", () => {
    expect(text).toContain("Oct 16, 2026");
    expect(text).toContain("7,320.535");
    expect(text).toContain("$1,146.09");
    expect(text).toContain("Q3 2026 · 7,320.535 ZEC");
  });

  it("keeps the earlier payouts: 436.77 ZEC at $279.19 and 129.82 ZEC at $346.63", () => {
    expect(text).toContain("436.77");
    expect(text).toContain("$279.19");
    expect(text).toContain("129.82");
    expect(text).toContain("$346.63");
  });

  it("links each round to FPF's announcement, the amounts to the sheet and the multisig to the explorer", () => {
    for (const p of PAYOUTS) expect(html).toContain(`href="${p.source}"`);
    expect(html).toContain(`href="${COINHOLDER_SHEET_URL}"`);
    expect(html).toContain(`href="${FUND_MULTISIG.explorer}"`);
  });

  it("names the latest payout by date, whatever the order of the rows", () => {
    const s = payoutSummary(PAYOUTS, ROUNDS);
    const reversed = { ...s, rows: [...s.rows].reverse() };
    expect(textOf(render(reversed))).toContain("Q3 2026 · 7,320.535 ZEC");
  });

  it("marks up the table for screen readers and opens external links safely", () => {
    expect(html).toContain("<caption");
    expect(html.match(/<th scope="col"/g)).toHaveLength(6);
    expect(html.match(/<th scope="row"/g)).toHaveLength(3);
    expect(html.match(/target="_blank"/g)?.length).toBe(
      html.match(/rel="noreferrer"/g)?.length,
    );
  });

  it("renders nothing until a payout has been reported", () => {
    expect(
      render({
        rows: [],
        totalUsd: 0,
        totalZec: 0,
        totalGrants: 0,
        pending: null,
      }),
    ).toBe("");
  });
});
