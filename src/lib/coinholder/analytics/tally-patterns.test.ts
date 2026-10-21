import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCoinholderDashboard, coinholderUnitsToZec, type CoinholderProposal } from "@/lib/coinholder/analytics/model";
import { formatInsightUnits, formatInsightZec } from "@/lib/coinholder/analytics/insights";
import { abstainBeyondMargin, formatTallyDistance, groupTallies, pairTallies, recurringAmounts, sameBallotCap, tallyDistance, voteRange } from "@/lib/coinholder/analytics/tally-patterns";

const fixture = (name: string) => JSON.parse(readFileSync(`data/coinholder/${name}.json`, "utf8"));
const { proposals } = buildCoinholderDashboard(fixture("q3-2026-summary"), fixture("q3-2026-metadata"), {
  state: "snapshot", checkedAt: "2026-10-09T06:00:00.000Z", snapshotFetchedAt: "2026-10-09T05:00:00.000Z",
  sha256: "fixture", url: "https://zvote.zfnd.org", metadataUrl: "/api/coinholders/verify?round=q3-2026&format=json", warning: null,
});
const ballot = (id: number) => proposals.find(proposal => proposal.ballot === id)!;
const zec = (units: bigint) => formatInsightZec(coinholderUnitsToZec(units));

function synthetic(id: number, units: [number, number, number, number]): CoinholderProposal {
  const ids = ["accept", "reject", "lower", "abstain"] as const;
  return {
    id: String(100 + id), ballot: id, title: `Synthetic ${id}`, description: "", applicant: null,
    publishedOutcome: "Rejected", computedOutcome: "REJECTED", quorumMet: true, acceptSharePercent: 0,
    githubUrl: "", verifyUrl: "", correction: null, totalZec: "0",
    options: ids.map((option, index) => ({ id: option, label: option, weightUnits: String(units[index]), zec: "0", sharePercent: 0 })),
  };
}

describe("Coinholder tally patterns", () => {
  it("measures the ZEC that must change option between two tallies without rounding", () => {
    expect(tallyDistance(ballot(32), ballot(33))).toBe(25_284n);
    expect(tallyDistance(ballot(33), ballot(32))).toBe(25_284n);
    expect(tallyDistance(ballot(14), ballot(14))).toBe(0n);
    expect(formatTallyDistance(25_284n)).toBe("1,580.25");
    expect(formatTallyDistance(9_244_767n)).toBe("577,797.9375");
    expect(formatTallyDistance(0n)).toBe("0");
  });

  it("compares every pair once and finds the closest pair", () => {
    const pairs = pairTallies(proposals);
    expect(pairs).toHaveLength(666);
    const closest = pairs.reduce((best, pair) => pair.distance < best.distance ? pair : best);
    expect([closest.a, closest.b]).toEqual([32, 33]);
    expect(closest.sharePercent?.toFixed(4)).toBe("0.0725");
  });

  it("reports that every proposal drew about the same ZEC", () => {
    const range = voteRange(proposals);
    expect(zec(range.min)).toBe("2,179,029.875");
    expect(zec(range.max)).toBe("2,181,452.875");
  });

  it("groups proposals whose tallies sit within 2% of the vote", () => {
    const result = groupTallies(proposals);
    expect(result.groups.map(group => [group.letter, group.ballots])).toEqual([
      ["A", [27, 28, 29, 32, 33, 34, 35, 36]], ["B", [6, 7, 8, 19]], ["C", [10, 12, 15, 18]], ["D", [3, 5, 9]],
      ["E", [11, 16, 20]], ["F", [1, 24]], ["G", [2, 21]],
    ]);
    expect(result.ungrouped).toEqual([4, 13, 14, 17, 22, 23, 25, 26, 30, 31, 37]);
    expect(result.order).toHaveLength(37);
    expect(new Set(result.order).size).toBe(37);
    expect(result.groupOf.get(33)).toBe("A");
    expect(result.groupOf.has(14)).toBe(false);
    expect(result.groups[0]).toMatchObject({ outcome: "Funded", nearUnanimous: true });
    expect(result.groups[2]).toMatchObject({ outcome: "Rejected", nearUnanimous: false, runnerUp: "abstain" });
    expect(zec(result.groups[2].runnerUpMeanUnits)).toBe("283,531.375");
    expect(result.groups[3].runnerUp).toBe("accept");
    expect(result.groups[4].runnerUp).toBe("lower");
  });

  it("finds each proposal's nearest tally", () => {
    const { nearest } = groupTallies(proposals);
    expect(nearest.get(14)).toMatchObject({ ballot: 23, distance: 10_873_170n });
    expect(formatTallyDistance(nearest.get(14)!.distance)).toBe("679,573.125");
    expect(nearest.get(14)?.sharePercent?.toFixed(2)).toBe("31.18");
    expect(nearest.get(2)).toMatchObject({ ballot: 21, distance: 79_696n });
    expect(nearest.get(26)?.ballot).toBe(31);
    expect(nearest.get(37)?.sharePercent?.toFixed(2)).toBe("14.68");
  });

  it("treats the 2% limit as inclusive and exact", () => {
    const base = synthetic(1, [0, 1_000_000, 0, 0]);
    const atLimit = synthetic(2, [20_000, 980_000, 0, 0]);
    const over = synthetic(3, [20_001, 979_999, 0, 0]);
    expect(groupTallies([base, atLimit]).groups.map(group => group.ballots)).toEqual([[1, 2]]);
    expect(groupTallies([base, over]).groups).toEqual([]);
    expect(groupTallies([base, over]).ungrouped).toEqual([1, 3]);
  });

  it("finds Abstain and lower-amount totals that recur across proposals", () => {
    const abstain = recurringAmounts(proposals, "abstain");
    expect(abstain.filter(amount => amount.repeat).map(amount => ({ ballots: amount.ballots, from: zec(amount.from), to: zec(amount.to) }))).toEqual([
      { ballots: [3, 5, 6, 7, 8, 9, 11, 16, 17, 19, 20, 25, 31], from: "104,432.375", to: "113,478.375" },
      { ballots: [10, 12, 15, 18], from: "281,303.875", to: "285,739.625" },
      { ballots: [4, 13, 23], from: "601,603.875", to: "610,683.25" },
      { ballots: [1, 22, 24], from: "703,090.75", to: "710,283.375" },
    ]);
    // Totals near zero mean almost nobody chose the option; they are not a recurring amount.
    expect(abstain[0]).toMatchObject({ repeat: false, ballots: [2, 21, 27, 28, 29, 30, 32, 33, 34, 35, 36, 37] });
    expect(abstain.reduce((sum, amount) => sum + amount.ballots.length, 0)).toBe(37);
    expect(recurringAmounts(proposals, "lower").filter(amount => amount.repeat).map(amount => amount.ballots)).toEqual([[11, 14, 16, 20]]);
  });

  it("keeps totals exactly 25,000 ZEC apart as separate amounts", () => {
    const amounts = recurringAmounts([synthetic(1, [0, 0, 0, 400_000]), synthetic(2, [0, 0, 0, 600_000]), synthetic(3, [0, 0, 0, 799_999])], "abstain");
    expect(amounts.map(amount => [amount.ballots, amount.repeat])).toEqual([[[1], false], [[2, 3], true]]);
  });

  it("formats vote-chain units the same way on the client as on the server", () => {
    for (const units of [0n, 1n, 25_284n, 8_311_386n, 17_451_623n]) expect(formatInsightUnits(units)).toBe(zec(units));
    expect(() => formatInsightUnits(-1n)).toThrow("Invalid ZEC amount");
  });

  it("bounds any block of ZEC that voted the same way on every proposal", () => {
    const cap = sameBallotCap(proposals);
    expect(cap).toMatchObject({ ballot: 14, option: "abstain", units: 8_311_386n });
    expect(zec(cap!.units)).toBe("1,038,923.25");
    expect(cap?.sharePercent?.toFixed(2)).toBe("47.67");
    expect(sameBallotCap([])).toBeNull();
  });

  it("lists proposals whose Abstain outweighed the winning margin", () => {
    expect(abstainBeyondMargin(proposals)).toEqual([14]);
    // A funded proposal flips when Abstain equals its margin; a rejected one needs more.
    expect(abstainBeyondMargin([synthetic(1, [300, 100, 0, 200]), synthetic(2, [100, 300, 0, 200]), synthetic(3, [100, 300, 0, 201])])).toEqual([1, 3]);
  });
});
