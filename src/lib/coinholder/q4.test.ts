import { describe, expect, it } from "vitest";
import { Q4, READY_FOR_VOTE_LABEL, q4Phase, q4Proposals, q4Totals, requestedCents, type Q4Issue } from "./q4";

const issue = (patch: Partial<Q4Issue> = {}): Q4Issue => ({
  number: 70, title: "Retroactive Grant Application - Example", state: "open",
  created_at: "2026-10-30T16:43:16Z", updated_at: "2026-10-30T21:28:18Z",
  labels: [{ name: READY_FOR_VOTE_LABEL }], user: { login: "applicant" },
  body: "### Requested Grant Amount (USD)\n$9,081.20\n### Organization or Individual Name\nExample Org\n### Category\nInfrastructure\n### Project Summary\nCompleted **work**.\n### Total Budget (USD)\n$90,000",
  ...patch,
});

describe("official Q4 submissions", () => {
  it("requires the exact label, current intake and an open, undecided issue", () => {
    const excluded = [
      issue({ number: 1, labels: [] }), issue({ number: 2, labels: ["Ready For Vote"] }),
      issue({ number: 3, labels: [READY_FOR_VOTE_LABEL.toLowerCase()] }),
      issue({ number: 4, state: "closed" }), issue({ number: 5, pull_request: {} }),
      issue({ number: 6, created_at: "2026-08-14T19:51:55Z" }),
      issue({ number: 7, created_at: "2027-01-01T00:00:00Z" }),
      issue({ number: 8, labels: [READY_FOR_VOTE_LABEL, "Approved by Coinholders"] }),
      issue({ number: 9, labels: [READY_FOR_VOTE_LABEL, "Withdrawn"] }),
    ];
    expect(q4Proposals([...excluded, issue()]).map((p) => p.number)).toEqual([70]);
  });
  it("preserves cents, source identity and the applicant's summary", () => {
    expect(q4Proposals([issue()])[0]).toMatchObject({ title: "Example", requestedUsdCents: 908120, organization: "Example Org", category: "Infrastructure", summary: "Completed work.", url: expect.stringContaining("/ZcashCoinholderGrantsProgram/issues/70") });
  });
  it("deduplicates page overlap and sorts newest first", () => {
    expect(q4Proposals([issue(), issue({ number: 71 }), issue()]).map((p) => p.number)).toEqual([71, 70]);
  });
  it("does not borrow a budget or count an unknown request as a known zero", () => {
    const proposals = q4Proposals([issue(), issue({ number: 71, body: "### Requested Grant Amount (USD)\nTo be confirmed\n### Total Budget (USD)\n$100,000" })]);
    expect(proposals[0].requestedUsdCents).toBeNull();
    expect(q4Totals(proposals)).toEqual({ requestedUsdCents: 908120, missingAmounts: 1 });
  });
});

it("parses USD without accepting ambiguous or malformed amounts", () => {
  expect(requestedCents("US$64,430")).toBe(6443000);
  expect(requestedCents("64,430.05 USD")).toBe(6443005);
  for (const value of ["$1,25", "$5k", "$500 or $800", "-50", "0", "$5.555", "1e5", "$500\nOther $50"]) expect(requestedCents(value)).toBeNull();
});

it("uses the current request when a parenthetical note records its previous amount", () => {
  expect(requestedCents("$1,690 (reduced from $2,000 on 2026-11-02, see Other Funding Sources)")).toBe(169000);
  expect(requestedCents("USD 1,690.25 (reduced from US$2,000)")).toBe(169025);
  expect(requestedCents("2,500 USD (increased from $2,000 on 2026-11-02)")).toBe(250000);
  expect(requestedCents("$1,620 (reduced from $2,000 on 2026-11-02 and to $1,620 on 2026-11-22, see Other Funding Sources)")).toBe(162000);
  expect(requestedCents("$1,250.50 (increased from $900 and to $1,000 and to $1,250.50)")).toBe(125050);
});

it("does not turn ambiguous, conditional or contradictory notes into requested totals", () => {
  for (const value of [
    "$1,690 (or $2,000)",
    "$1,690 (per month)",
    "$1,690 (reduced from $2,000 if approved)",
    "$1,690 (reduced from $1,500)",
    "$1,690 (increased from $2,000)",
    "$1,690 (reduced from $2,000 or $3,000)",
    "$1,690 (reduced from $2,000, see $310 contribution)",
    "$1,690 (reduced from $2,000) plus $310",
    "$1,690 (reduced from $2k)",
    "$1,620 (reduced from $2,000 and to $1,690)",
    "$1,620 (reduced from $2,000 and to $1,500 and to $1,620)",
    "$1,620 (reduced from $2,000 and to $1,620 if approved)",
    "$1,620 (reduced from $2k and to $1,620)",
  ]) expect(requestedCents(value), value).toBeNull();
});

it("uses announced boundaries and does not call submissions a live vote", () => {
  expect(q4Phase(Date.parse(Q4.submissionsOpen)).label).toBe("Accepting proposals");
  expect(q4Phase(Date.parse(Q4.submissionsClose) + 1).label).toBe("Submissions closed");
  expect(q4Phase(Date.parse(Q4.reviewOpen)).step).toBe(1);
  expect(q4Phase(Date.parse(Q4.voteOpen)).label).toBe("Scheduled voting period");
  expect(q4Phase(Date.parse(Q4.voteClose) + 1).step).toBe(-1);
});
