import { describe, expect, it } from "vitest";
import { reconcileProposalRows } from "./reconcile-proposals";
import { officialProposalListings } from "@/lib/participate/official-proposals-model";
import type { GrantApplication } from "./github-applications";
import type { ProposalTableRow } from "@/app/zcg/proposals/proposals-table";
const url = (n: number) => `https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/${n}`;
const app = (number: number): GrantApplication => ({ number, url: url(number), title: `Proposal ${number}`, status: "review", createdAt: "2026-10-13T02:00:00.000Z", applicant: "author", summary: null, amountUsd: 5000, comments: 0 });
const sheet = (number: number, status = "under_review"): ProposalTableRow => ({ id: `sheet-${number}`, program: "zcg", title: `Proposal ${number}`, platformLink: url(number), applicant: "Applicant", submitted: "2026-10-12", status, statusLabel: status, source: "sheet" });
const reconcile = (rows: ProposalTableRow[], apps: GrantApplication[], decisions = new Map<number, string>(), missing = new Set<number>()) => reconcileProposalRows(rows, apps, missing, decisions, new Map());

describe("one published proposal queue", () => {
  it("lists new unlabeled applications immediately and enriches existing rows once", () => {
    const result = reconcile([sheet(386)], [app(386), app(480), app(481), app(483), app(486)]);
    expect(result.rows).toHaveLength(5);
    expect(officialProposalListings(result.rows).map(row => row.issueNumber).sort()).toEqual([386, 480, 481, 483, 486]);
    expect(result.rows.find(row => row.id === "sheet-386")).toMatchObject({ amountUsd: 5000, submitted: "2026-10-12" });
  });
  it("keeps a decided spreadsheet verdict over leftover GitHub review labels", () => {
    const result = reconcile([sheet(454, "approved")], [app(454)]);
    expect(result.rows).toHaveLength(1);
    expect(officialProposalListings(result.rows)[0].outcome).toBe("approved");
  });
  it("moves the same official issue out of review after the published decision", () => {
    const result = reconcile([sheet(454), sheet(439)], [], new Map([[454, "approved"], [439, "withdrawn"]]));
    expect(officialProposalListings(result.rows).map(row => row.outcome).sort()).toEqual(["abandoned", "approved"]);
    expect(result.rows.filter(row => row.status === "under_review")).toHaveLength(0);
  });
  it("drops only missing undecided issues, preserving decided historical records", () => {
    const result = reconcile([sheet(100), sheet(101, "approved")], [], new Map(), new Set([100, 101]));
    expect(result.removedCount).toBe(1);
    expect(result.rows.map(row => row.id)).toEqual(["sheet-101"]);
  });
  it("never turns Coinholder rows or spoofed issue URLs into official ZCG entries", () => {
    expect(officialProposalListings([{ ...sheet(454), program: "coinholder" }, { ...sheet(455), platformLink: `https://example.com/?next=${url(455)}` }])).toEqual([]);
  });
  it("agrees on all under-review identities and requested budgets", () => {
    const result = reconcile([sheet(1), sheet(2, "rejected"), sheet(3)], [app(1), app(2), app(4)], new Map([[3, "approved"]]));
    const standard = result.rows.filter(row => row.status === "under_review").map(row => [row.platformLink, row.amountUsd]).sort();
    const participate = officialProposalListings(result.rows).filter(row => row.outcome === "under_review").map(row => [row.url, row.requestedUsd]).sort();
    expect(participate).toEqual(standard);
  });
});
