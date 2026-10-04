import { describe, it, expect } from "vitest";
import { ROUNDS } from "./rounds";
import { verifyRound } from "./verify";
import { proposalDecision, proposalVerifyHref } from "./proposal-decision";

const q3 = ROUNDS.find(r => r.id === "q3-2026")!;
const q1 = ROUNDS.find(r => r.id === "q1-2026")!;

describe("proposal decision", () => {
  it("shows Connaugh's exact values, avoiding the rounded mockup's arithmetic drift", () => {
    const row = verifyRound(q3).rows.find(r => r.ballot === 14)!;
    const d = proposalDecision(q3, row)!;
    expect(proposalVerifyHref(q3.id, row.id)).toBe("/coinholders/verify/q3-2026/55");
    expect(d).toMatchObject({ total: 2179248.125, rejected: 383280.625,
      directional: 1140324.875, majorityCutoff: 570162.4375,
      majorityMet: true, quorumMet: true });
    expect((d.approveShare! * 100).toFixed(1)).toBe("66.4");
    expect(d.options.map(o => o.value)).toEqual([757044.25, 187236.625, 196044, 1038923.25]);
    expect(d.options.reduce((n, o) => n + o.size, 0)).toBeCloseTo(1);
  });

  it("uses the directional denominator for each option, excluding Abstain", () => {
    const row = verifyRound(q3).rows.find(r => r.ballot === 14)!;
    const d = proposalDecision(q3, row)!;
    expect(d.options.map(o => o.directionalShare === null ? null : (o.directionalShare * 100).toFixed(1)))
      .toEqual(["66.4", "16.4", "17.2", null]);
    expect(d.options.reduce((sum, o) => sum + (o.directionalShare ?? 0), 0)).toBeCloseTo(1);
    expect(d.options[0].share).not.toBe(d.options[0].directionalShare);
  });

  it.each([
    { approve: 0, reject: 0, rejectLower: 0, abstain: 420000 },
    { approve: 0, reject: 0, rejectLower: 0, abstain: 0 },
  ])("has no directional percentages when there are no directional votes", tally => {
    const round = { ...q3, proposals: [{ ...q3.proposals[0], tally }] };
    const d = proposalDecision(round, verifyRound(round).rows[0])!;
    expect(d.options.every(o => o.directionalShare === null)).toBe(true);
  });

  it("places the quorum above all votes when participation is short, without stretching the bar", () => {
    const base = q3.proposals[0];
    const round = { ...q3, proposals: [{ ...base, tally: { approve: 200000, reject: 10000, rejectLower: 10000, abstain: 10000 } }] };
    const d = proposalDecision(round, verifyRound(round).rows[0])!;
    expect(d.quorumMet).toBe(false);
    expect(d.majorityMet).toBe(true);
    expect(d.scaleMax).toBe(420000);
    expect(d.options.reduce((n, o) => n + o.size, 0)).toBeCloseTo(230000 / 420000);
  });

  it("does not pass a tie or an all-Abstain ballot even when participation qualifies", () => {
    for (const tally of [{ approve: 100000, reject: 70000, rejectLower: 30000, abstain: 220000 }, { approve: 0, reject: 0, rejectLower: 0, abstain: 420000 }]) {
      const round = { ...q3, proposals: [{ ...q3.proposals[0], tally }] };
      const row = verifyRound(round).rows[0];
      const d = proposalDecision(round, row)!;
      expect(d.quorumMet).toBe(true);
      expect(d.majorityMet).toBe(false);
      expect(row.rule).toBe("rejected");
    }
  });

  it("keeps a discarded question unknown and uses each historical ballot's actual options", () => {
    const discarded = verifyRound(q1).rows.find(r => r.published === "discarded")!;
    expect(proposalDecision(q1, discarded)).toBeNull();
    const q4 = ROUNDS.find(r => r.id === "q4-2025")!;
    const d = proposalDecision(q4, verifyRound(q4).rows[0])!;
    expect(d.options.map(o => o.key)).toEqual(["approve", "reject"]);
  });

  it("reconciles the graph and table for every recorded question", () => {
    for (const round of ROUNDS) for (const row of verifyRound(round).rows) {
      const d = proposalDecision(round, row);
      if (!d) { expect(row.total).toBeNull(); continue; }
      expect(d.options.reduce((n, o) => n + o.value, 0)).toBeCloseTo(d.total, 6);
      expect(d.quorumPosition).toBeGreaterThan(0);
      expect(d.quorumPosition).toBeLessThanOrEqual(1);
      expect(d.majorityPosition).toBeLessThanOrEqual(0.5);
    }
  });
});
