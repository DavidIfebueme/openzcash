import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import registry from "@/data/ecosystem/registry.json";
import snapshot from "@/data/ecosystem/snapshot.json";
import type { Catalog } from "@/lib/ecosystem/types";
import { RequestedAmount } from "@/components/project-history/requested-amount";
import { buildProjectHistory } from "./build";
import { historyIdentities } from "./identities";
import type { ReviewedRequestedAmount } from "./requested-amounts";
import type { FinanceRecords, HistoryIdentity, ProposalRecord } from "./types";

const ledgerSource = { label: "Synthetic ledger source", url: "https://example.org/ledger/alpha", observedAt: "2026-10-01" };
const identity: HistoryIdentity = {
  id: "alpha-browser", name: "Alpha Browser", category: "Libraries & SDKs", description: "Fixture browser library", website: "https://example.org/alpha",
  communityId: null, recipientKeys: [], applicationTopics: [], reportTopics: [], repositories: [], checkedAt: "2026-09-08",
  project: { id: "alpha-browser", name: "Alpha Browser", category: "Libraries & SDKs", description: "Fixture browser library", website: "https://example.org/alpha", organizationId: null, tags: [], repositories: [], sources: [],
    funding: { label: "Scope reviewed", status: "approved", events: [{ title: "Alpha Browser Maintenance", program: "zcg", status: "approved", sourceUrl: "https://example.org/old-application" }] } },
};
const request: ReviewedRequestedAmount = {
  id: "alpha-request", projectId: identity.id, program: "zcg", grantTitle: "Alpha Browser Maintenance", amountUsdCents: "1250000", basis: "fixed",
  summary: "The applicant requests USD 12,500 for this scope.", sourceUrl: "https://example.org/reviewed-request", reviewedAt: "2026-10-04",
  reviewNote: "Read the application and checked the requested total for the exact project and grant.",
};
const proposal: ProposalRecord = {
  id: "alpha-proposal", program: "zcg", title: request.grantTitle, status: "approved", submittedDate: "2026-08-01", decisionDate: "2026-08-20", requestedUsdCents: null,
  platformLink: "https://example.org/old-application", forumLink: null, source: ledgerSource,
};
const finance: FinanceRecords = {
  proposals: [proposal], payments: [{ id: "paid-1", program: "zcg", project: request.grantTitle, recipientKey: "alpha", milestone: "1", deliverable: "Library release",
    isPaid: true, paidDate: "2026-09-20", budgetUsdCents: "500000", recordedZecZat: "123456789", source: ledgerSource }],
  proposalsAvailable: true, paymentsAvailable: true, importedAt: ledgerSource.observedAt,
};
function build(options: { current?: HistoryIdentity; records?: FinanceRecords; requests?: ReviewedRequestedAmount[]; day?: string } = {}) {
  const current = options.current ?? identity;
  return buildProjectHistory(current, [current], options.records ?? finance, "2026-10-04", [], new Date(`${options.day ?? "2026-10-04"}T12:00:00Z`), undefined, options.requests ?? [request]);
}
const render = (result: ReturnType<typeof build>) => renderToStaticMarkup(createElement(RequestedAmount, { grant: result.grants[0] }));

describe("reviewed requested amounts through project histories", () => {
  it.each(["fixed", "cap"] as const)("preserves the %s request basis and its dated primary source", basis => {
    const result = build({ requests: [{ ...request, basis }] });
    expect(result.grants[0]).toMatchObject({ requestedUsdCents: "1250000", requestedAmountReview: {
      basis, summary: request.summary, source: { url: request.sourceUrl, observedAt: request.reviewedAt },
    } });
    expect(result.grants[0].source).toEqual(ledgerSource);
    expect(result.sources).toContainEqual(expect.objectContaining({ kind: "funding", url: request.sourceUrl, observedAt: "2026-10-04" }));
    const html = render(result);
    expect(html).toContain(basis === "cap" ? "Requested cap" : "Requested");
    if (basis === "fixed") expect(html).not.toContain("Requested cap");
    expect(html).toContain("$12,500.00");
    expect(html).toContain(request.sourceUrl);
    expect(html).toContain("Request basis");
  });
  it.each(["0", "2500000"])("preserves a real ledger request of %s cents over the reviewed fallback", requestedUsdCents => {
    const result = build({ records: { ...finance, proposals: [{ ...proposal, requestedUsdCents }] } });
    expect(result.grants[0].requestedUsdCents).toBe(requestedUsdCents);
    expect(result.grants[0].requestedAmountReview).toBeUndefined();
    expect(result.sources.some(source => source.url === request.sourceUrl)).toBe(false);
    expect(render(result)).not.toContain("Request basis");
    if (requestedUsdCents === "0") expect(render(result)).toContain("$0.00");
  });
  it("withholds future review amounts and provenance from both the API shape and rendered request", () => {
    const result = build({ day: "2026-10-03" });
    expect(result.grants[0].requestedUsdCents).toBeNull();
    expect(result.grants[0].requestedAmountReview).toBeUndefined();
    expect(result.sources.some(source => source.url === request.sourceUrl)).toBe(false);
    expect(render(result)).toContain("Not in ledger");
    expect(render(result)).not.toContain("$12,500.00");
  });
  it("never fills an ambiguous repeated grant title even with an exact reviewed amount", () => {
    const result = build({ records: { ...finance, proposals: [proposal, { ...proposal, id: "renewal", title: "  ALPHA   Browser Maintenance ", requestedUsdCents: "700000" }] } });
    expect(result.grants[0]).toMatchObject({ statusBasis: "ambiguous", requestedUsdCents: null, approvedUsdCents: null, milestones: [] });
    expect(result.grants[0].requestedAmountReview).toBeUndefined();
    expect(render(result)).toContain("Needs review");
    expect(result.sources.some(source => source.url === request.sourceUrl)).toBe(false);
  });
  it("does not borrow a request from another project or program that uses the same title", () => {
    const otherProject = { ...identity, id: "alpha-wallet", project: { ...identity.project!, id: "alpha-wallet" } };
    expect(build({ current: otherProject }).grants[0].requestedUsdCents).toBeNull();
    expect(build({ requests: [{ ...request, program: "coinholder" }] }).grants[0].requestedUsdCents).toBeNull();
    expect(build({ requests: [{ ...request, grantTitle: "Alpha Browser Maintenance II" }] }).grants[0].requestedUsdCents).toBeNull();
  });
  it("changes only requested-amount fields while payments, budgets, approved amounts and decisions stay unchanged", () => {
    const before = build({ requests: [] }), after = build();
    const { requestedUsdCents: beforeAmount, requestedAmountReview: beforeReview, ...beforeGrant } = before.grants[0];
    const { requestedUsdCents: afterAmount, requestedAmountReview: afterReview, ...afterGrant } = after.grants[0];
    expect(beforeAmount).toBeNull(); expect(beforeReview).toBeUndefined();
    expect(afterAmount).toBe(request.amountUsdCents); expect(afterReview?.basis).toBe("fixed");
    expect(afterGrant).toEqual(beforeGrant);
    expect(afterGrant).toMatchObject({ approvedUsdCents: null, status: "approved", paidBudgetUsdCents: { known: "500000" }, recordedZecZat: { known: "123456789" } });
    expect(after.timeline).toEqual(before.timeline);
  });
  it("can document a request while the ledger is unavailable without manufacturing financial confirmation", () => {
    const result = build({ records: { proposals: [], payments: [], proposalsAvailable: false, paymentsAvailable: false, importedAt: null } });
    expect(result.grants[0]).toMatchObject({ statusBasis: "dated_catalog", requestedUsdCents: request.amountUsdCents, approvedUsdCents: null, paidBudgetUsdCents: { known: null }, recordedZecZat: { known: null } });
    expect(result.coverage).toMatchObject({ proposalsAvailable: false, paymentsAvailable: false });
    expect(result.timeline.some(event => event.kind === "payment")).toBe(false);
    expect(result.gaps.some(gap => gap.includes("proposal source is unavailable"))).toBe(true);
  });
  it("loads the three real WebZjs scopes without treating the rejected renewal cap as an approval", () => {
    const identities = historyIdentities({ registry, snapshot } as unknown as Catalog);
    const webzjs = identities.find(item => item.id === "webzjs")!;
    const result = buildProjectHistory(webzjs, identities, { ...finance, proposals: [], payments: [] }, snapshot.collectedAt, [], new Date("2026-10-04T12:00:00Z"));
    const original = result.grants.find(grant => grant.title === "WebZjs - ZCash Browser Wallet Library")!;
    const maintenance = result.grants.find(grant => grant.title === "Chainsafe Systems")!;
    const renewal = result.grants.find(grant => grant.title === "ChainSafe #3 - Zcash Metamask Snap and Webzjs maintenance renewal")!;
    expect(original).toMatchObject({ requestedUsdCents: "15000000", requestedAmountReview: { basis: "fixed" }, approvedUsdCents: null });
    expect(maintenance).toMatchObject({ requestedUsdCents: "16800000", requestedAmountReview: { basis: "cap" }, approvedUsdCents: null });
    expect(renewal).toMatchObject({ requestedUsdCents: "16800000", requestedAmountReview: { basis: "cap" }, status: "declined", approvedUsdCents: null, milestones: [] });
  });
});
