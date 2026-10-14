import { describe, expect, it } from "vitest";
import { officialProposalListings, officialProposalSnapshotSchema } from "./official-proposals-model";
import { reconcileProposalRows } from "@/lib/zcg/reconcile-proposals";

const url = (n: number) => `https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/${n}`;
const title = "ZEC Order Pay: shielded ZEC checkout, refunds and creator payouts for service marketplaces";
const detail = "Filtered by FPF / Outside of Scope / Guidelines Not Met";
const sourceUrl = "https://docs.google.com/spreadsheets/d/official-ledger/edit#gid=1164534734&range=A729";
const row = { id: "sheet-489", program: "zcg", title, platformLink: url(489), applicant: "TITANHOLD", submitted: "2026-10-13", status: "filtered", statusLabel: "Filtered", statusRaw: detail, statusSourceUrl: sourceUrl, amountUsd: 36000 };

describe("Participate screening status", () => {
  it("preserves filtered status, the published reason and the exact source row through the API schema", () => {
    const proposals = officialProposalListings([row]);
    const snapshot = officialProposalSnapshotSchema.parse({ version: 1, readAt: "2026-10-14T12:00:00.000Z", proposals });
    expect(snapshot.proposals[0]).toMatchObject({ issueNumber: 489, outcome: "filtered", statusDetail: detail, statusSourceUrl: sourceUrl, requestedUsd: 36000 });
  });

  it("keeps same-title resubmissions separate without substituting GitHub review for spreadsheet screening", () => {
    const result = reconcileProposalRows([
      { ...row, id: "sheet-481", platformLink: url(481), submitted: "2026-10-10", status: "under_review", statusRaw: "Waiting on applicant to post to forum" },
      row,
    ], [{ number: 489, title, url: url(489), applicant: "wolkodaww123-ctrl", createdAt: "2026-10-13T13:49:21Z", status: "review", amountUsd: 36000, summary: null, comments: 4 }], new Set(), new Map(), new Map());
    const proposals = officialProposalListings(result.rows);
    expect(proposals).toHaveLength(2);
    expect(proposals.find(p => p.issueNumber === 489)).toMatchObject({ outcome: "filtered", statusDetail: detail });
    expect(proposals.find(p => p.issueNumber === 481)).toMatchObject({ outcome: "under_review" });
    expect(proposals.every(p => p.outcome !== "rejected")).toBe(true);
  });

  it.each(["approved", "rejected", "under_review"])("retains %s without exposing a screening reason", status => {
    expect(officialProposalListings([{ ...row, status }])[0]).toMatchObject({ outcome: status });
    expect(officialProposalListings([{ ...row, status }])[0]).not.toHaveProperty("statusDetail");
  });
});
