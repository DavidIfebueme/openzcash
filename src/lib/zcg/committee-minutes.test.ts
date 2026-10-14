import { describe, expect, it } from "vitest";
import { PUBLISHED_COMMITTEE_DECISIONS, publishedDecisionForIssue } from "./committee-minutes";
import { applyPublishedMinutes, mergeMinutesHistory } from "./committee-minutes-projection";
import { proposalDecisions } from "@/lib/governance/decisions";
import type { ProposalTableRow } from "@/app/zcg/proposals/proposals-table";
import { historyResponseSchema } from "@/lib/participate/workspace/domain/participate-history";

const now = Date.parse("2026-10-14T14:00:00Z");
const issueUrl = (n: number) => `https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/${n}`;
const row = (n: number, status = "under_review"): ProposalTableRow => ({ id: `sheet-${n}`, program: "zcg", title: "Same title", platformLink: issueUrl(n), applicant: "Applicant", submitted: "2026-09-29", status, statusLabel: status });

describe("October 12 source cross-reference", () => {
  it("includes all 21 verdicts and excludes the proposal that was too early to vote", () => {
    expect(PUBLISHED_COMMITTEE_DECISIONS).toHaveLength(21);
    expect(PUBLISHED_COMMITTEE_DECISIONS.filter(d => d.outcome === "approved").map(d => d.issueNumber)).toEqual([447, 449, 454]);
    expect(PUBLISHED_COMMITTEE_DECISIONS.filter(d => d.outcome === "rejected")).toHaveLength(18);
    expect(new Set(PUBLISHED_COMMITTEE_DECISIONS.map(d => d.issueNumber)).size).toBe(21);
    expect(publishedDecisionForIssue(issueUrl(479), now)).toBeNull();
  });
  it("uses the unanimous record without inventing individual feedback", () => {
    const ramp = publishedDecisionForIssue(issueUrl(454), now)!;
    expect(ramp.requestedUsd).toBe(45000);
    expect(ramp.votes.map(v => v.vote)).toEqual(Array(5).fill("approve"));
    expect(ramp.votes.filter(v => v.basis === "individual").map(v => v.memberId)).toEqual(["artkor", "gguy", "zerodartz"]);
    for (const id of ["paul", "hanh"]) expect(ramp.votes.find(v => v.memberId === id)).toMatchObject({ basis: "unanimous", summary: expect.stringContaining("No individual comment published") });
    for (const d of PUBLISHED_COMMITTEE_DECISIONS) {
      expect(new Set(d.votes.map(v => v.memberId)).size).toBe(5);
      expect(d.voteEvidenceUrl).toContain("58182/1");
      expect(d.votes.every(v => v.vote === (d.outcome === "approved" ? "approve" : "reject"))).toBe(true);
    }
  });
  it("keeps asynchronous decision dates distinct from the meeting date and part-two sources", () => {
    expect(publishedDecisionForIssue(issueUrl(447), now)).toMatchObject({ decisionDate: "2026-10-02", meetingDate: "2026-10-12", decisionMode: "async" });
    expect(publishedDecisionForIssue(issueUrl(449), now)?.decisionDate).toBe("2026-10-09");
    expect(publishedDecisionForIssue(issueUrl(441), now)?.decisionDate).toBe("2026-10-02");
    expect(publishedDecisionForIssue(issueUrl(477), now)?.minutesUrl).toContain("58182/2");
  });
  it("cannot attach a revision's votes to an old application, another repository, a spoofed URL or an unpublished date", () => {
    for (const url of [issueUrl(408), issueUrl(443), issueUrl(489), `https://example.com/?url=${issueUrl(454)}`, issueUrl(454).replace("ZcashCommunityGrants/", "Other/"), "zcg-github-454"]) expect(publishedDecisionForIssue(url, now)).toBeNull();
    expect(publishedDecisionForIssue(issueUrl(454), Date.parse("2026-10-13T15:00:00Z"))).toBeNull();
    expect(publishedDecisionForIssue(`${issueUrl(386)}#issuecomment-5750121540`, now)?.requestedUsd).toBe(5000);
  });
});

describe("published minutes and the shared proposal queue", () => {
  it("settles only undecided exact matches without changing originals or making a requested amount an approved budget", () => {
    const input = [row(477), row(454), row(479), row(408, "rejected"), row(489, "filtered"), row(439, "withdrawn")];
    const before = structuredClone(input);
    const result = applyPublishedMinutes(input, now);
    expect(result.rows.map(r => r.status)).toEqual(["rejected", "approved", "under_review", "rejected", "filtered", "withdrawn"]);
    expect(result.minutesDecided).toBe(2);
    expect(result.rows[0]).toMatchObject({ source: "minutes", amountUsd: 48000, statusSourceUrl: expect.stringContaining("58182/2") });
    expect(input).toEqual(before);
  });
  it("does not replace another program, explicit later decisions, withdrawals or later applications on the same issue", () => {
    const input = [{ ...row(454), program: "coinholder" }, row(454, "rejected"), row(454, "withdrawn"), { ...row(454), decisionDate: "2026-10-20" }, { ...row(454), submitted: "2026-10-20" }];
    expect(applyPublishedMinutes(input, now).rows).toEqual(input);
  });
});

describe("decision history from minutes", () => {
  const proposals = [447, 449, 454, 477, 479, 408].map(n => ({ id: `sheet-${n}`, program: "zcg", title: "Same title", platformLink: issueUrl(n), applicantsRaw: "Applicant", requestedUsdCents: null,
    status: n === 408 ? "rejected" : n === 454 ? "approved" : "under_review", decisionDate: n === 408 ? "2026-09-14" : n === 454 ? "2026-10-12" : null }));
  it("adds missing verdicts, enriches existing sources, retains async dates and is idempotent", () => {
    const existing = proposalDecisions(proposals, [], []);
    const result = mergeMinutesHistory(existing, proposals, now);
    expect(result).toHaveLength(5);
    expect(result.filter(r => r.sources.some(s => s.href === issueUrl(454)))).toHaveLength(1);
    expect(result.find(r => r.sources.some(s => s.href === issueUrl(447)))?.date).toBe("2026-10-02");
    expect(result.find(r => r.sources.some(s => s.href === issueUrl(477)))?.outcome).toBe("Rejected");
    expect(result.find(r => r.sources.some(s => s.href === issueUrl(454)))?.sources).toContainEqual({ label: "Votes & feedback", href: "https://openzcash.org/zcg/participate?record=zcg-github-454" });
    expect(result.find(r => r.sources.some(s => s.href === issueUrl(408)))).toEqual(existing.find(r => r.id === "proposal-sheet-408"));
    expect(mergeMinutesHistory(result, proposals, now)).toEqual(result);
    expect(historyResponseSchema.safeParse({ version: 1, rows: result }).success).toBe(true);
    expect(mergeMinutesHistory(existing, proposals, Date.parse("2026-10-13T15:00:00Z"))).toEqual(existing);
  });
});
