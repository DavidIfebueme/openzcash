import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { invalidate } from "@/lib/cache/memo";
import { observePublication, proposalVerdict, publishedValue } from "@/lib/zcg/publication-policy";
import { readDecisionHistory } from "./decision-history";

vi.mock("server-only", () => ({}));
const source = vi.hoisted(() => ({ listProposals: vi.fn() }));
vi.mock("@/lib/zcg/proposals-repo", () => ({ listProposals: source.listProposals }));
vi.mock("@/lib/zcg/governance-repo", () => ({ getMeetings: async () => [] }));
vi.mock("@/lib/zcg/grants-repo", () => ({ listGrants: async () => [] }));

beforeEach(() => {
  invalidate();
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
});
afterEach(() => {
  invalidate();
  vi.useRealTimers();
});

it("shows newly eligible approvals and rejections at Brasilia midnight despite a warm history cache", async () => {
  const observedAt = new Date("2026-10-12T18:00:00Z");
  const proposals = [
    { id: "approved", title: "Approved application", status: "approved" },
    { id: "rejected", title: "Rejected application", status: "rejected" },
  ].map(proposal => ({
    ...proposal,
    program: "zcg",
    decisionDate: "2026-10-12",
    applicantsRaw: "Applicant",
    requestedUsdCents: null,
    platformLink: null,
    publication: observePublication(undefined,
      proposalVerdict({ status: proposal.status, decisionDate: "2026-10-12" }),
      proposalVerdict({ status: "under_review" }), observedAt),
  }));
  // Model the repository's published projection with the actual D-1 policy.
  // Leave cached() real so this exercises visible results across the cutoff.
  source.listProposals.mockImplementation(async () => proposals.map(({ publication, ...proposal }) => ({
    ...proposal, ...publishedValue(publication),
  })));

  vi.setSystemTime(new Date("2026-10-13T02:59:00Z"));
  expect(await readDecisionHistory()).toEqual([]);
  vi.setSystemTime(new Date("2026-10-13T02:59:59Z"));
  expect(await readDecisionHistory()).toEqual([]);
  expect(source.listProposals).toHaveBeenCalledTimes(1);

  vi.setSystemTime(new Date("2026-10-13T03:00:00Z"));
  const published = await readDecisionHistory();
  expect(published.map(row => ({ outcome: row.outcome, date: row.date }))).toEqual([
    { outcome: "Approved", date: "2026-10-12" },
    { outcome: "Rejected", date: "2026-10-12" },
  ]);
  expect(source.listProposals).toHaveBeenCalledTimes(2);

  vi.setSystemTime(new Date("2026-10-13T03:01:00Z"));
  expect(await readDecisionHistory()).toEqual(published);
  expect(source.listProposals).toHaveBeenCalledTimes(2);
});
