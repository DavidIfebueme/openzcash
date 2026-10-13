import { describe, expect, it } from "vitest";
import { buildOfficialApprovedBudgets, officialBudgetTitle, officialZcgBudgetIssue, type OfficialBudgetMilestone, type OfficialBudgetProposal } from "./approved-budget-match";
import { ZCG_GIDS } from "@/lib/zcg/sheets";

const issueUrl = (number: number) => `https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/${number}`;
const proposal = (overrides: Partial<OfficialBudgetProposal> = {}): OfficialBudgetProposal => ({
  id: "proposal-454", title: "OpenZcash", status: "approved", platformLink: issueUrl(454),
  sourceSheetGid: ZCG_GIDS.proposals, sourceRowIndex: 707, program: "zcg", origin: "sheet", locked: false, ...overrides,
});
const milestone = (overrides: Partial<OfficialBudgetMilestone> = {}): OfficialBudgetMilestone => ({
  project: "OpenZcash", recipientNameRaw: "OpenZcash", amountUsdCents: 750000n, grantStatus: "open",
  sourceSheet: "grants_disbursed", sourceSheetGid: ZCG_GIDS.grantsDisbursed, sourceRowIndex: 888,
  origin: "sheet", locked: false, isTest: false, isInternal: false, ...overrides,
});

describe("official approved budget identity", () => {
  it("accepts the canonical repository URL with case, slash and comment fragments", () => {
    expect(officialZcgBudgetIssue(`${issueUrl(454)}/#issuecomment-123`)).toBe(454);
    expect(officialZcgBudgetIssue(issueUrl(454).toLowerCase())).toBe(454);
  });

  it.each([
    "https://github.com.evil.test/ZcashCommunityGrants/zcashcommunitygrants/issues/454",
    "https://evil.test/github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/454",
    "https://github.com@evil.test/ZcashCommunityGrants/zcashcommunitygrants/issues/454",
    "https://someone@github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/454",
    "https://github.com:8443/ZcashCommunityGrants/zcashcommunitygrants/issues/454",
    "https://github.com/Other/zcashcommunitygrants/issues/454",
    "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/pull/454",
    `${issueUrl(454)}/unrelated`, "text before " + issueUrl(454), issueUrl(0),
    "http://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/454",
    issueUrl(454).replace("454", "0454"), issueUrl(454).replace("454", "9007199254740992"), null,
  ])("rejects a noncanonical identity: %s", link => {
    expect(officialZcgBudgetIssue(link)).toBeNull();
    expect(buildOfficialApprovedBudgets([proposal({ platformLink: link })], [milestone()]).budgets).toEqual({});
  });

  it("normalizes formatting and only a trailing revision marker", () => {
    expect(officialBudgetTitle("Grant Application — OpenZcash (revision of #333)")).toBe("openzcash");
    expect(officialBudgetTitle("Zcash Arabia (August to December 2026")).toBe("zcash arabia august to december 2026");
    expect(officialBudgetTitle("OpenZcash (revision of #333) phase 2")).not.toBe("openzcash");
    expect(officialBudgetTitle("OpenZcash (phase 2)")).not.toBe("openzcash");
  });
});

describe("official approved budget reconciliation", () => {
  it("sums the startup allocation and all four milestones for #454 with exact row provenance", () => {
    const rows = [milestone(), ...Array.from({ length: 4 }, (_, index) => milestone({ amountUsdCents: 937500n, sourceRowIndex: 889 + index }))];
    const result = buildOfficialApprovedBudgets([proposal()], rows);
    expect(result.unmatched).toEqual([]);
    expect(result.budgets["454"]).toEqual({
      usdCents: "4500000",
      sourceUrl: expect.stringMatching(/\/edit#gid=803214474&range=A889:L893$/),
      proposalSourceUrl: expect.stringMatching(/\/edit#gid=1164534734&range=A708$/),
      sourceRows: [889, 890, 891, 892, 893],
    });
  });

  it.each([
    [424, "GraphSense Zcash Shielded Accounting Repair", "graphsense zcash shielded accounting repair", 800000n],
    [438, "Human readable version of Ironwood formal verification, first steps - bulletproofs in the AGM", "Human readable version of Ironwood formal verification first steps bulletproofs in the AGM", 800000n],
    [405, "Grant Application — Zcash World, Mumbai (Devcon 8 week)", "Zcash World, Mumbai (Devcon 8 week)", 2030000n],
    [400, "Zcash Arabia (August to December 2026", "Zcash Arabia (August to December 2026)", 2700000n],
  ] as const)("recovers the historical official issue #%s through sheet identity", (number, title, project, amount) => {
    const result = buildOfficialApprovedBudgets([proposal({ platformLink: issueUrl(number), title })], [milestone({ project, amountUsdCents: amount })]);
    expect(result.budgets[String(number)]?.usdCents).toBe(amount.toString());
  });

  it("permits a rejected earlier application with the same title", () => {
    const result = buildOfficialApprovedBudgets([
      proposal({ id: "old", status: "rejected", platformLink: issueUrl(380) }), proposal(),
    ], [milestone()]);
    expect(result.budgets["454"]?.usdCents).toBe("750000");
    expect(result.budgets["380"]).toBeUndefined();
  });

  it("does not fuzzy-match a different grant with similar words", () => {
    const result = buildOfficialApprovedBudgets([proposal({ title: "Zaino Release Stabilization" })], [milestone({ project: "Zaino Stability" })]);
    expect(result).toEqual({ budgets: {}, unmatched: [{ issueNumber: 454, reason: "missing_grant_budget" }] });
  });

  it("withholds two approved applications sharing one normalized title", () => {
    const result = buildOfficialApprovedBudgets([proposal(), proposal({ id: "another", platformLink: issueUrl(455) })], [milestone()]);
    expect(result.budgets).toEqual({});
    expect(result.unmatched).toEqual([
      { issueNumber: 454, reason: "ambiguous_approved_title" }, { issueNumber: 455, reason: "ambiguous_approved_title" },
    ]);
  });

  it.each(["approved", "rejected", "pending"])("withholds a duplicate canonical issue with status %s", status => {
    const result = buildOfficialApprovedBudgets([proposal(), proposal({ id: "duplicate", status, title: "Different title" })], [milestone()]);
    expect(result).toEqual({ budgets: {}, unmatched: [{ issueNumber: 454, reason: "ambiguous_issue_identity" }] });
  });

  it("withholds a grant attributed to multiple recipients", () => {
    const result = buildOfficialApprovedBudgets([proposal()], [milestone(), milestone({ sourceRowIndex: 889, recipientNameRaw: "Someone else" })]);
    expect(result.budgets).toEqual({});
    expect(result.unmatched[0]?.reason).toBe("ambiguous_grant_recipient");
  });

  it("normalizes recipient whitespace and case without allocating to separate people", () => {
    const result = buildOfficialApprovedBudgets([proposal()], [milestone(), milestone({ sourceRowIndex: 889, recipientNameRaw: "  OPENZCASH  " })]);
    expect(result.budgets["454"]?.usdCents).toBe("1500000");
  });

  it("does not double-count duplicate source rows", () => {
    const result = buildOfficialApprovedBudgets([proposal()], [milestone(), milestone()]);
    expect(result).toEqual({ budgets: {}, unmatched: [{ issueNumber: 454, reason: "duplicate_milestone_source" }] });
  });

  it.each([null, -1n, -750000n])("does not turn missing or negative budgets into an approved total: %s", amountUsdCents => {
    const result = buildOfficialApprovedBudgets([proposal()], [milestone(), milestone({ sourceRowIndex: 889, amountUsdCents })]);
    expect(result.budgets).toEqual({});
    expect(result.unmatched[0]?.reason).toBe("incomplete_grant_budget");
  });

  it("withholds an all-zero budget but permits a documented zero milestone", () => {
    expect(buildOfficialApprovedBudgets([proposal()], [milestone({ amountUsdCents: 0n })]).budgets).toEqual({});
    expect(buildOfficialApprovedBudgets([proposal()], [milestone(), milestone({ sourceRowIndex: 889, amountUsdCents: 0n })]).budgets["454"]?.usdCents).toBe("750000");
  });

  it.each(["cancelled", "Cancelled", "unknown", null])("withholds the whole grant when a milestone status is %s", grantStatus => {
    const result = buildOfficialApprovedBudgets([proposal()], [milestone(), milestone({ sourceRowIndex: 889, grantStatus })]);
    expect(result.budgets).toEqual({});
    expect(result.unmatched[0]?.reason).toBe("unconfirmed_grant_status");
  });

  it("includes completed and open milestones in the total rather than an unpaid remainder", () => {
    const result = buildOfficialApprovedBudgets([proposal()], [milestone({ grantStatus: "completed" }), milestone({ sourceRowIndex: 889, grantStatus: "open" })]);
    expect(result.budgets["454"]?.usdCents).toBe("1500000");
  });

  it.each([
    { origin: "admin" }, { origin: "demo" }, { locked: true }, { sourceSheetGid: "wrong" },
    { sourceRowIndex: null }, { sourceRowIndex: -1 }, { sourceRowIndex: 1.5 }, { sourceRowIndex: Number.NaN }, { sourceRowIndex: Number.MAX_SAFE_INTEGER },
  ])("rejects an untrusted approved proposal source: %o", fields => {
    const result = buildOfficialApprovedBudgets([proposal(fields)], [milestone()]);
    expect(result.budgets).toEqual({});
    expect(result.unmatched[0]?.reason).toBe("untrusted_proposal_source");
  });

  it.each([
    { origin: "admin" }, { origin: "demo" }, { locked: true }, { isTest: true }, { isInternal: true }, { sourceSheetGid: "wrong" },
    { sourceRowIndex: null }, { sourceRowIndex: -1 }, { sourceRowIndex: 1.5 }, { sourceRowIndex: Number.NaN }, { sourceRowIndex: Number.MAX_SAFE_INTEGER },
  ])("rejects the whole budget rather than silently dropping an untrusted milestone: %o", fields => {
    const result = buildOfficialApprovedBudgets([proposal()], [milestone(), milestone({ sourceRowIndex: 889, ...fields })]);
    expect(result.budgets).toEqual({});
    expect(result.unmatched[0]?.reason).toBe("untrusted_milestone_source");
  });

  it("ignores Coinholder and other ledgers even when their names coincide", () => {
    const result = buildOfficialApprovedBudgets([proposal(), proposal({ id: "coinholder", program: "coinholder" })], [milestone(), milestone({ sourceSheet: "coinholder_grants", sourceSheetGid: ZCG_GIDS.coinholderGrants }), milestone({ sourceSheet: "ic_payments" })]);
    expect(result.budgets["454"]?.usdCents).toBe("750000");
    expect(result.unmatched).toEqual([]);
    expect(buildOfficialApprovedBudgets([proposal({ program: "coinholder" })], [milestone()]).budgets).toEqual({});
  });

  it("preserves distinct noncontiguous source rows without inventing a contiguous range", () => {
    const result = buildOfficialApprovedBudgets([proposal()], [milestone({ sourceRowIndex: 901 }), milestone({ sourceRowIndex: 888 })]);
    expect(result.budgets["454"]).toMatchObject({ sourceRows: [889, 902], sourceUrl: expect.stringMatching(/&range=A889$/) });
  });

  it("sums integer cents beyond floating-point precision without truncation", () => {
    const result = buildOfficialApprovedBudgets([proposal()], [milestone({ amountUsdCents: 9007199254740993n }), milestone({ sourceRowIndex: 889, amountUsdCents: 1n })]);
    expect(result.budgets["454"]?.usdCents).toBe("9007199254740994");
  });

  it("does not mutate input source observations", () => {
    const record = Object.freeze(proposal());
    const row = Object.freeze(milestone());
    expect(buildOfficialApprovedBudgets(Object.freeze([record]), Object.freeze([row])).budgets["454"]?.usdCents).toBe("750000");
  });
});
