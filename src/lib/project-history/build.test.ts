import { describe, expect, it } from "vitest";
import { buildProjectHistory, eventsInMonth, sumAmounts } from "./build";
import { evidenceSchema, type ReviewedEvidence } from "./evidence";
import { historyAmount } from "./format";
import type { FinanceRecords, HistoryIdentity, ProposalRecord, PaymentRecord } from "./types";
import type { Repository } from "@/lib/ecosystem/types";

const source = { label: "Synthetic ledger fixture", url: "https://example.org/grants/alpha", observedAt: "2026-10-01T00:00:00Z" };
const identity: HistoryIdentity = { id: "alpha", name: "Alpha", description: "Test identity", category: "Infrastructure", website: "https://example.org",
  communityId: null, recipientKeys: [], applicationTopics: [], reportTopics: [], repositories: [], checkedAt: "2026-09-08",
  project: { id: "alpha", name: "Alpha", description: "Test identity", category: "Infrastructure", website: "https://example.org", organizationId: null,
    tags: [], repositories: [], sources: [], funding: { label: "ZCG", status: "approved", events: [{ title: "Alpha infrastructure", status: "approved", program: "zcg", date: "2026-08-01", sourceUrl: source.url }] } },
};
const proposal: ProposalRecord = { id: "proposal-a", program: "zcg", title: "Alpha infrastructure", status: "approved", submittedDate: "2026-07-01", decisionDate: "2026-08-01", requestedUsdCents: "1000000", platformLink: source.url, forumLink: null, source };
const payment: PaymentRecord = { id: "payment-a", program: "zcg", project: "Alpha infrastructure", recipientKey: "alpha team", milestone: "Milestone 1", deliverable: "Ship the indexer", isPaid: true, paidDate: "2026-09-03", budgetUsdCents: "500000", recordedZecZat: "100000000", source };
const finance: FinanceRecords = { proposals: [proposal], payments: [payment], proposalsAvailable: true, paymentsAvailable: true, importedAt: source.observedAt };
const make = (options: Partial<FinanceRecords> = {}, current = identity, all = [current], reviews: ReviewedEvidence[] = []) => buildProjectHistory(current, all, { ...finance, ...options }, "2026-09-08", reviews, new Date("2026-10-02"));
const review: ReviewedEvidence = { id: "acceptance-a", projectId: "alpha", kind: "reviewed_delivery", title: "Indexer accepted", summary: "Acceptance statement identifies this milestone.", date: "2026-09-20", sourceUrl: "https://example.org/acceptance", reviewedAt: "2026-09-21", reviewNote: "Read the acceptance and checked the exact milestone identity.", milestoneIds: [payment.id], supersedes: null };

describe("project history financial and evidence boundaries", () => {
  it("separates requested amounts, approved status, budgets and recorded settlement", () => {
    const grant = make().grants[0];
    expect(grant.requestedUsdCents).toBe("1000000");
    expect(grant.status).toBe("approved");
    expect(grant.approvedUsdCents).toBeNull();
    expect(grant.paidBudgetUsdCents.known).toBe("500000");
    expect(grant.recordedZecZat.known).toBe("100000000");
    expect(grant.milestones[0].deliveryEvidence).toEqual([]);
  });
  it("keeps grants, recipients and programs apart instead of fuzzy matching names", () => {
    const result = make({ payments: [payment, { ...payment, id: "b", project: "Alpha infrastructure II" }, { ...payment, id: "c", program: "coinholder" }, { ...payment, id: "d", project: "Other project", recipientKey: "alpha" }] });
    expect(result.grants[0].milestones.map(item => item.id)).toEqual([payment.id]);
  });
  it("includes all paid installments exactly once, preserves refunds, excludes unpaid amounts from paid totals", () => {
    const result = make({ payments: [payment, payment, { ...payment, id: "refund", budgetUsdCents: "-5000", recordedZecZat: "-1000000" }, { ...payment, id: "future", isPaid: false, budgetUsdCents: "200000" }] });
    expect(result.grants[0].budgetUsdCents.known).toBe("695000");
    expect(result.grants[0].paidBudgetUsdCents.known).toBe("495000");
    expect(result.grants[0].recordedZecZat.known).toBe("99000000");
    expect(result.timeline.filter(event => event.kind === "payment")).toHaveLength(2);
  });
  it("never turns an absent, unmatched or wholly unknown amount into zero", () => {
    expect(sumAmounts([])).toEqual({ known: null, records: 0, missing: 0 });
    expect(sumAmounts([null])).toEqual({ known: null, records: 1, missing: 1 });
    expect(sumAmounts(["0", null])).toEqual({ known: "0", records: 2, missing: 1 });
    expect(make({ payments: [] }).grants[0].paidBudgetUsdCents.known).toBeNull();
  });
  it("withholds proposal and payment associations when repeated titles make identity ambiguous", () => {
    const result = make({ proposals: [proposal, { ...proposal, id: "renewal", submittedDate: "2026-08-02", platformLink: "https://example.org/renewal" }] });
    expect(result.grants[0].status).toBe("identity-unresolved");
    expect(result.grants[0].requestedUsdCents).toBeNull();
    expect(result.grants[0].milestones).toEqual([]);
    expect(result.gaps.join(" ")).toMatch(/multiple proposals/);
  });
  it("uses the public verdict instead of resurrecting a stale catalog approval", () => {
    const result = make({ proposals: [{ ...proposal, status: "pending", decisionDate: null }] });
    expect(result.grants[0].status).toBe("pending");
    expect(result.timeline.filter(event => event.kind === "decision" || event.kind === "context")).toEqual([]);
  });
  it("exposes shared awards without creating a project allocation or cross-project total", () => {
    const other = { ...identity, id: "alpha-library", name: "Alpha library" };
    const result = make({}, identity, [identity, other]);
    expect(result.grants[0].sharedWith).toEqual([{ id: other.id, name: other.name }]);
    expect(result).not.toHaveProperty("totalFunding");
  });
  it("keeps organization funding as context without turning it into a grant", () => {
    const current = { ...identity, project: { ...identity.project!, funding: { label: "Org", status: "organization-level", events: [{ title: "Organization funding", status: "organization-level", sourceUrl: source.url }] } } };
    const result = make({}, current);
    expect(result.grants).toEqual([]);
    expect(result.timeline[0]).toMatchObject({ kind: "context", date: null, grantId: null });
  });
  it("uses curated community recipient keys and application topics, not generic team names", () => {
    const community = { ...identity, project: null, communityId: "alpha-community", recipientKeys: ["alpha team"], applicationTopics: [12345] };
    const result = make({ proposals: [proposal, { ...proposal, id: "new", title: "New community proposal", forumLink: "https://forum.zcashcommunity.com/t/application/12345/2" }] }, community);
    expect(result.grants.map(grant => grant.title)).toEqual(["Alpha infrastructure", "New community proposal"]);
  });
  it("resolves short Discourse topic URLs without confusing the post number with the topic", () => {
    const community = { ...identity, project: null, communityId: "alpha-community", recipientKeys: [], applicationTopics: [12345] };
    const result = make({ proposals: [{ ...proposal, forumLink: "https://forum.zcashcommunity.com/t/12345/2" }], payments: [] }, community);
    expect(result.grants.map(grant => grant.title)).toEqual([proposal.title]);
  });
  it("reports failed sources without claiming zero funding or a current decision", () => {
    const result = make({ proposals: [], payments: [], proposalsAvailable: false, paymentsAvailable: false });
    expect(result.coverage).toMatchObject({ proposalsAvailable: false, paymentsAvailable: false });
    expect(result.timeline[0].detail).toContain("current proposal status is not linked");
    expect(result.gaps.join(" ")).toMatch(/unavailable/);
  });
  it("deduplicates repository releases and never treats them as milestone acceptance", () => {
    const release = { tagName: "v1", name: "v1", publishedAt: "2026-09-10T15:00:00Z", url: "https://github.com/example/alpha/releases/tag/v1", isPrerelease: false };
    const repo = { fullName: "example/alpha", activity: { releases: [release, release], latestRelease: release, checkedAt: "2026-09-11" } } as Repository;
    const result = make({}, { ...identity, repositories: [repo] });
    expect(result.timeline.filter(event => event.kind === "release")).toHaveLength(1);
    expect(result.timeline.find(event => event.kind === "release")).toMatchObject({ evidence: "published_artifact", grantId: null });
    expect(result.grants[0].milestones[0].deliveryEvidence).toEqual([]);
  });
  it("retains older release evidence after the rolling activity window moves", () => {
    const older = { tagName: "v1.0.0", name: null, publishedAt: "2025-01-01T00:00:00Z", url: "https://github.com/example/alpha/releases/tag/v1", isPrerelease: false };
    const current = { ...older, tagName: "v2.0.0-rc.0", publishedAt: "2026-10-01T00:00:00Z", url: "https://github.com/example/alpha/releases/tag/v2-rc" };
    const repo = { fullName: "example/alpha", activity: { releases: [current], releaseHistory: [older, current], latestRelease: current, checkedAt: "2026-10-02" } } as Repository;
    const result = make({}, { ...identity, repositories: [repo] });
    const releases = result.timeline.filter(event => event.kind === "release");
    expect(releases).toHaveLength(2);
    expect(releases[0]).toMatchObject({ releaseChannel: "prerelease", date: current.publishedAt });
    expect(releases[0].detail).toContain("Prerelease");
    expect(releases[1].source.url).toBe(older.url);
    expect(eventsInMonth(result.timeline, "2025-01")).toHaveLength(1);
  });
  it("preserves a withdrawn publication with its original observation date", () => {
    const release = { tagName: "v2-beta", name: null, publishedAt: "2026-09-01T00:00:00Z", url: "https://github.com/example/alpha/releases/tag/v2-beta", isPrerelease: true,
      lastObservedAt: "2026-09-08T00:00:00Z", missingAsOf: "2026-10-04T00:00:00Z" };
    const repo = { fullName: "example/alpha", activity: { releases: [], releaseHistory: [], latestRelease: null, unlistedReleases: [release], checkedAt: release.missingAsOf } } as unknown as Repository;
    const result = make({}, { ...identity, repositories: [repo] });
    expect(result.timeline.find(event => event.kind === "release")).toMatchObject({ sourceState: "unlisted", source: { observedAt: release.lastObservedAt } });
    const reviewed = { ...review, kind: "published_artifact" as const, milestoneIds: [], id: "reviewed-release", sourceUrl: release.url, date: "2026-09-01", reviewedAt: "2026-09-08" };
    const enriched = make({}, { ...identity, repositories: [repo] }, undefined, [reviewed]);
    expect(enriched.timeline.find(event => event.kind === "release")).toMatchObject({ sourceState: "unlisted", releaseChannel: "prerelease" });
    expect(enriched.timeline.find(event => event.kind === "release")?.detail).toContain("no longer listed");
  });
  it("preserves unknown event dates instead of substituting import time", () => {
    const result = make({ proposals: [{ ...proposal, decisionDate: null }], payments: [{ ...payment, paidDate: "2026-02-30" }] });
    expect(result.timeline.find(event => event.kind === "decision")?.date).toBeNull();
    expect(result.timeline.find(event => event.kind === "payment")?.date).toBeNull();
    expect(result.grants[0].milestones[0].paidDate).toBeNull();
    expect(eventsInMonth(result.timeline, "2026-10")).toEqual([]);
    expect(() => eventsInMonth(result.timeline, "2026-13")).toThrow();
  });
  it("links acceptance only to the reviewed project and exact milestone", () => {
    expect(make({}, identity, [identity], [review]).grants[0].milestones[0].deliveryEvidence).toHaveLength(1);
    expect(make({}, identity, [identity], [{ ...review, projectId: "different-project" }]).grants[0].milestones[0].deliveryEvidence).toEqual([]);
    expect(make({}, identity, [identity], [{ ...review, milestoneIds: ["other"] }]).grants[0].milestones[0].deliveryEvidence).toEqual([]);
  });
  it("preserves corrections and does not activate a future review early", () => {
    const correction = { ...review, id: "correction", kind: "team_reported" as const, milestoneIds: [], reviewedAt: "2026-10-01", supersedes: review.id };
    expect(make({}, identity, [identity], [review, correction]).grants[0].milestones[0].deliveryEvidence).toEqual([]);
    expect(make({}, identity, [identity], [review, { ...correction, reviewedAt: "2026-11-01" }]).grants[0].milestones[0].deliveryEvidence).toHaveLength(1);
  });
  it("does not mistake an unextracted progress reference for a dated completion", () => {
    const current = structuredClone(identity);
    current.project!.funding.events[0].repositoryEvidenceKind = "maintainer-grant-progress";
    current.project!.funding.events[0].repositoryEvidenceUrl = "https://example.org/report";
    expect(make({}, current).timeline.find(event => event.kind === "report")).toMatchObject({ evidence: "team_reported", date: null, grantId: null });
  });
  it("formats exact large and negative financial integers without rounding", () => {
    expect(historyAmount("900719925474099301")).toBe("$9,007,199,254,740,993.01");
    expect(historyAmount("-1", "ZEC")).toBe("−0.00000001 ZEC");
    expect(historyAmount(null)).toBe("Not linked");
  });
});

describe("reviewed evidence admission", () => {
  it("requires a source, a review and exact milestones for an acceptance claim", () => {
    expect(evidenceSchema.safeParse({ schemaVersion: 1, entries: [review] }).success).toBe(true);
    for (const patch of [{ milestoneIds: [] }, { sourceUrl: "javascript:alert(1)" }, { reviewedAt: "2026-09-01" }, { reviewNote: "ok" }])
      expect(evidenceSchema.safeParse({ schemaVersion: 1, entries: [{ ...review, ...patch }] }).success).toBe(false);
  });
  it("rejects duplicate IDs, cycles and cross-project corrections", () => {
    for (const entry of [review, { ...review, id: "two", supersedes: "missing" }, { ...review, id: "two", supersedes: review.id, projectId: "other" }])
      expect(evidenceSchema.safeParse({ schemaVersion: 1, entries: [review, entry] }).success).toBe(false);
  });
});
