import { describe, expect, it } from "vitest";
import { projectInsights, historyLinksForGrant } from "./insights";
import { buildProjectHistory, prepareHistoryBindings } from "./build";
import { evidenceSchema } from "./evidence";
import type { FinanceRecords, HistoryIdentity } from "./types";

const source = { label: "Fixture", url: "https://example.org/ledger", observedAt: "2026-10-01" };
const identity: HistoryIdentity = { id: "alpha", name: "Alpha", description: "Fixture", category: "Community", communityId: "alpha", website: "https://example.org", project: null, recipientKeys: ["alpha"], applicationTopics: [], reportTopics: [], repositories: [], checkedAt: "2026-10-01" };
const payment = { id: "row-1", project: "Alpha 2026", program: "zcg" as const, recipientKey: "alpha", milestone: "1", deliverable: null, isPaid: true, paidDate: "2026-09-01", budgetUsdCents: "500000", recordedZecZat: "100000000", source };
const finance: FinanceRecords = { proposals: [], payments: [payment], proposalsAvailable: true, paymentsAvailable: true, importedAt: "2026-10-01" };
const record = (data: Partial<FinanceRecords> = {}) => buildProjectHistory(identity, [identity], { ...finance, ...data }, "2026-09-08");
const release = { id: "release", projectId: "alpha", kind: "published_artifact" as const, title: "Release published", summary: "A published artifact, not acceptance.", date: "2026-09-20", sourceUrl: "https://example.org/releases/1", reviewedAt: "2026-10-01", reviewNote: "Inspected the published release and its event date.", milestoneIds: [], supersedes: null };

describe("source-led project insights", () => {
  it("does not promote a removed publication as the latest current work", () => {
    const history = record();
    history.timeline.unshift({ id: "removed", kind: "release", title: "Removed beta", date: "2026-10-01", detail: "No longer listed", sourceState: "unlisted", evidence: "published_artifact", source, grantId: null });
    expect(projectInsights(history).latestWork).toBeNull();
    expect(projectInsights(history).latestEvent?.id).not.toBe("removed");
    expect(projectInsights(history).publishedArtifacts).toBe(1);
  });
  it("does not turn a paid row or published release into acceptance or adoption", () => {
    const history = buildProjectHistory(identity, [identity], finance, "2026-09-08", [release]);
    expect(projectInsights(history)).toMatchObject({ paidEntries: 1, publishedArtifacts: 1, acceptedEntries: 0, acceptanceGaps: 1, integrations: 0, usageObservations: 0 });
    expect(projectInsights(history).latestWork?.source.url).toBe(release.sourceUrl);
  });
  it("keeps unavailable payments unknown and does not create an acceptance-gap verdict", () => {
    const facts = projectInsights(record({ paymentsAvailable: false, payments: [] }));
    expect(facts.paidEntries).toBeNull(); expect(facts.acceptanceGaps).toBeNull();
    expect(facts.checks[0].title).toBe("Restore financial source coverage");
    expect(facts.checks.some(check => check.title === "Link milestone acceptance")).toBe(false);
  });
  it("counts repeated ledger IDs once across shared context", () => {
    const history = record(); history.grants.push({ ...history.grants[0], id: "shared-view" });
    expect(projectInsights(history).paidEntries).toBe(1);
    expect(projectInsights(history)).not.toHaveProperty("totalFunding");
  });
  it("retains superseded evidence visibly but excludes it from current insights", () => {
    const correction = { ...release, id: "correction", kind: "team_reported" as const, supersedes: release.id, reviewedAt: "2026-10-02" };
    const history = buildProjectHistory(identity, [identity], finance, "2026-09-08", [release, correction], new Date("2026-10-02"));
    expect(history.reviews[0]).toMatchObject({ supersededBy: "correction", linked: false });
    expect(projectInsights(history).publishedArtifacts).toBe(0);
    expect(history.timeline.some(event => event.id === "review-release")).toBe(false);
  });
  it("retains an orphaned acceptance review without asserting milestone delivery", () => {
    const acceptance = { ...release, kind: "reviewed_delivery" as const, milestoneIds: ["stale-row-id"] };
    const history = buildProjectHistory(identity, [identity], finance, "2026-09-08", [acceptance]);
    expect(history.reviews[0].linked).toBe(false);
    expect(projectInsights(history).acceptedEntries).toBe(0);
    expect(history.gaps.join(" ")).toContain("exact re-link");
    const partiallyOrphaned = buildProjectHistory(identity, [identity], finance, "2026-09-08", [{ ...acceptance, milestoneIds: [payment.id, "stale-row-id"] }]);
    expect(projectInsights(partiallyOrphaned).acceptedEntries).toBe(0);
  });
  it("uses the same reviewed associations when preparing the directory in one pass", () => {
    const prepared = prepareHistoryBindings([identity], finance);
    const now = new Date("2026-10-02");
    expect(buildProjectHistory(identity, [identity], finance, "2026-09-08", [], now, prepared)).toEqual(buildProjectHistory(identity, [identity], finance, "2026-09-08", [], now));
  });
  it("does not create a grant navigation link from a similar recipient name", () => {
    expect(historyLinksForGrant([identity], { title: "Alpha 2026", program: "zcg", recipientKey: "alpha other" })).toEqual([]);
    expect(historyLinksForGrant([identity], { title: "Alpha 2026", program: "zcg", recipientKey: "alpha" })[0].href).toBe("/ecosystem/history/alpha?section=funding");
  });
  it("surfaces community reports without treating them as releases or inventing event dates", () => {
    const community = { ...identity, reportTopics: [{ id: 123, title: "Community report" }] };
    const history = buildProjectHistory(community, [community], finance, "2026-09-08");
    expect(projectInsights(history)).toMatchObject({ reportSources: 1, publicWorkSources: 1, publishedArtifacts: 0, latestWork: null });
    expect(history.timeline.find(event => event.kind === "report")).toMatchObject({ date: null, evidence: "team_reported" });
  });
  it("requires measured-use context and keeps it distinct from acceptance", () => {
    const usage = { ...release, kind: "usage_observation", measurement: { metric: "Requests", value: "120", unit: "requests", periodStart: "2026-09-01", periodEnd: "2026-09-19", population: "Public endpoint A only", methodology: "Server-side request counter; includes repeated clients." } };
    expect(evidenceSchema.safeParse({ schemaVersion: 1, entries: [usage] }).success).toBe(true);
    for (const patch of [{ measurement: undefined }, { measurement: { ...usage.measurement, periodEnd: "2026-10-01" } }, { milestoneIds: ["row-1"] }]) {
      expect(evidenceSchema.safeParse({ schemaVersion: 1, entries: [{ ...usage, ...patch }] }).success).toBe(false);
    }
  });
});
