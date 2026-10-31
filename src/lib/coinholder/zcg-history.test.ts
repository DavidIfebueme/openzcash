import { describe, expect, it } from "vitest";
import { priorZcg, type ZcgPayment, type ZcgApproval } from "./zcg-history";
import type { Q4ProposalSummary } from "./q4";

const proposal: Q4ProposalSummary = {
  number: 70, title: "Wallet maintenance", applicant: "walletdev", organization: "Nighthawk",
  category: null, summary: null, requestedUsdCents: 5000000, url: "https://github.com/example/70",
  createdAt: "2026-10-30T16:43:16Z", updatedAt: "2026-10-30T16:43:16Z",
};
const payment: ZcgPayment = { project: "Wallet development", recipient: "nighthawk", sourceSheet: "grants_disbursed", isPaid: true, isInternal: false, isTest: false, paidDate: "2024-06-10" };
const approval: ZcgApproval = { title: "Wallet maintenance", applicantsRaw: "Nighthawk", program: "zcg", status: "approved",
  decisionDate: "2026-09-01", platformLink: "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/123", forumLink: null };

describe("prior ZCG history", () => {
  it("links a dated grant paid to the same recipient, including reviewed aliases", () => {
    expect(priorZcg(proposal, { payments: [payment], approvals: [] })).toMatchObject({
      status: "confirmed", basis: "recipient", href: "/zcg/grant?g=Wallet%20development",
    });
    expect(priorZcg({ ...proposal, organization: "reddev" }, { payments: [{ ...payment, recipient: "RED.DEV INC" }], approvals: [] }).status).toBe("confirmed");
  });
  it("recognizes an earlier approved proposal without claiming it was paid", () => {
    expect(priorZcg(proposal, { payments: [], approvals: [approval] })).toMatchObject({ status: "confirmed", basis: "proposal", href: approval.platformLink });
    expect(priorZcg({ ...proposal, title: "New wallet work" }, { payments: [], approvals: [approval] })).toMatchObject({ status: "confirmed", basis: "recipient" });
  });
  it("does not attribute a related Maya project paid to Hanh to the Maya team", () => {
    const maya = { ...proposal, title: "Maya Protocol integration", organization: "Maya Protocol", applicant: "ahdzib-maya" };
    expect(priorZcg(maya, { payments: [{ ...payment, project: "Transparent & Shielded DEX with Maya Protocol", recipient: "Hanh" }],
      approvals: [{ ...approval, title: maya.title, applicantsRaw: "Hanh" }] })).toEqual({ status: "unconfirmed" });
  });
  it("excludes Coinholder awards and unpaid ledger entries", () => {
    expect(priorZcg(proposal, { payments: [{ ...payment, sourceSheet: "coinholder_grants" }, { ...payment, isPaid: false }],
      approvals: [{ ...approval, program: "coinholder" }] })).toEqual({ status: "unconfirmed" });
  });
  it("requires an earlier dated record and a published approval", () => {
    expect(priorZcg(proposal, { payments: [{ ...payment, paidDate: null }, { ...payment, paidDate: "2026-11-01" }],
      approvals: [{ ...approval, status: "rejected" }, { ...approval, status: "pending" }, { ...approval, decisionDate: null },
        { ...approval, decisionDate: "2026-11-01" }, { ...approval, decisionDate: "2026-10-30" }] })).toEqual({ status: "unconfirmed" });
  });
  it("does not infer identity from partial names or empty placeholders", () => {
    expect(priorZcg(proposal, { payments: [{ ...payment, recipient: "Nighthawk collaborators" }], approvals: [] }).status).toBe("unconfirmed");
    expect(priorZcg({ ...proposal, applicant: "", organization: "N/A" }, { payments: [{ ...payment, recipient: "N/A" }], approvals: [] }).status).toBe("unconfirmed");
  });
  it("does not combine another recipient's paid milestone with the applicant's unpaid one", () => {
    expect(priorZcg(proposal, { payments: [
      { ...payment, recipient: "Another team" },
      { ...payment, isPaid: false },
      { ...payment, paidDate: "2026-11-01" },
    ], approvals: [] })).toEqual({ status: "unconfirmed" });
  });
  it("excludes internal and test payments even when names match", () => {
    expect(priorZcg(proposal, { payments: [
      { ...payment, isTest: true }, { ...payment, isInternal: true },
    ], approvals: [] })).toEqual({ status: "unconfirmed" });
  });
  it("matches a source handle with an @ prefix without substring matching", () => {
    expect(priorZcg(proposal, { payments: [{ ...payment, recipient: "@walletdev" }], approvals: [] }).status).toBe("confirmed");
  });
  it("keeps unavailable sources distinct, while retaining confirmed evidence", () => {
    expect(priorZcg(proposal, { payments: null, approvals: [] })).toEqual({ status: "unavailable" });
    expect(priorZcg(proposal, { payments: [payment], approvals: null }).status).toBe("confirmed");
  });
  it("does not link to unsafe application URLs", () => {
    expect(priorZcg(proposal, { payments: [], approvals: [{ ...approval, platformLink: "javascript:alert(1)" }] })).toEqual({ status: "unconfirmed" });
  });
});
