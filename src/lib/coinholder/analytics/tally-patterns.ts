import type { CoinholderOptionId, CoinholderProposal } from "@/lib/coinholder/analytics/model";
import { formatInsightZec, insightPercent } from "@/lib/coinholder/analytics/insights";

const OPTION_IDS = ["accept", "reject", "lower", "abstain"] as const satisfies ReadonlyArray<CoinholderOptionId>;
/** Two proposals match when their tallies sit within this share of the vote, in basis points. */
export const TALLY_GROUP_LIMIT_BP = 200n;
/** Totals less than this apart count as one recurring amount: 25,000 ZEC in 1/8-ZEC units. */
export const RECURRING_GAP_UNITS = 25_000n * 8n;

type Weights = Record<CoinholderOptionId, bigint>;
export type TallyPair = { a: number; b: number; distance: bigint; voteUnits: bigint; sharePercent: number | null };
export type TallyNearest = { ballot: number; distance: bigint; sharePercent: number | null };
export type TallyGroup = {
  letter: string;
  ballots: number[];
  outcome: CoinholderProposal["publishedOutcome"] | "Mixed";
  runnerUp: CoinholderOptionId;
  runnerUpMeanUnits: bigint;
  nearUnanimous: boolean;
};
export type TallyGrouping = { groups: TallyGroup[]; ungrouped: number[]; order: number[]; groupOf: Map<number, string>; nearest: Map<number, TallyNearest> };
export type RecurringAmount = { option: CoinholderOptionId; from: bigint; to: bigint; ballots: number[]; repeat: boolean };
export type SameBallotCap = { ballot: number; option: CoinholderOptionId; units: bigint; totalUnits: bigint; sharePercent: number | null };

function weights(proposal: CoinholderProposal): Weights {
  const weight = (id: CoinholderOptionId) => BigInt(proposal.options.find(option => option.id === id)?.weightUnits ?? "0");
  return { accept: weight("accept"), reject: weight("reject"), lower: weight("lower"), abstain: weight("abstain") };
}
const total = (tally: Weights) => tally.accept + tally.reject + tally.lower + tally.abstain;
const magnitude = (value: bigint) => value < 0n ? -value : value;
const smaller = (left: bigint, right: bigint) => left < right ? left : right;
const byBallot = (left: CoinholderProposal, right: CoinholderProposal) => left.ballot - right.ballot;

/** Half the summed option differences between two final tallies, in 1/16 ZEC. */
export function tallyDistance(left: CoinholderProposal, right: CoinholderProposal): bigint {
  const a = weights(left);
  const b = weights(right);
  // Half the summed differences in 1/8-ZEC units is the same count of 1/16 ZEC.
  return OPTION_IDS.reduce((sum, id) => sum + magnitude(a[id] - b[id]), 0n);
}

/** Format a distance in 1/16 ZEC without converting it to floating point. */
export function formatTallyDistance(sixteenths: bigint): string {
  return formatInsightZec(`${sixteenths / 16n}.${((sixteenths % 16n) * 625n).toString().padStart(4, "0")}`);
}

export function voteRange(proposals: CoinholderProposal[]): { min: bigint; max: bigint } {
  const totals = proposals.map(proposal => total(weights(proposal)));
  return { min: totals.reduce(smaller), max: totals.reduce((left, right) => left > right ? left : right) };
}

/** Every pair once, in ballot order; shares divide by the smaller of the two votes. */
export function pairTallies(proposals: CoinholderProposal[]): TallyPair[] {
  const sorted = [...proposals].sort(byBallot);
  const totals = new Map(sorted.map(proposal => [proposal.ballot, total(weights(proposal))]));
  return sorted.flatMap((left, index) => sorted.slice(index + 1).map(right => {
    const distance = tallyDistance(left, right);
    const voteUnits = smaller(totals.get(left.ballot)!, totals.get(right.ballot)!);
    return { a: left.ballot, b: right.ballot, distance, voteUnits, sharePercent: insightPercent(distance, 2n * voteUnits) };
  }));
}

function describeGroup(members: CoinholderProposal[], letter: string, limitBp: bigint): TallyGroup {
  const tallies = members.map(weights);
  const sums = OPTION_IDS.map(id => ({ id, sum: tallies.reduce((sum, tally) => sum + tally[id], 0n) }));
  const [, runnerUp] = [...sums].sort((left, right) => left.sum === right.sum ? 0 : left.sum > right.sum ? -1 : 1);
  const smallestVote = tallies.map(total).reduce(smaller);
  const outcomes = new Set(members.map(member => member.publishedOutcome));
  return {
    letter,
    ballots: members.map(member => member.ballot),
    outcome: outcomes.size === 1 ? members[0].publishedOutcome : "Mixed",
    runnerUp: runnerUp.id,
    runnerUpMeanUnits: runnerUp.sum / BigInt(members.length),
    // A runner-up below the matching limit is too small to tell the group apart.
    nearUnanimous: runnerUp.sum * 10_000n < limitBp * smallestVote * BigInt(members.length),
  };
}

/** Chains proposals through pairs within the limit, with exact integer comparisons. */
export function groupTallies(proposals: CoinholderProposal[], limitBp: bigint = TALLY_GROUP_LIMIT_BP): TallyGrouping {
  const sorted = [...proposals].sort(byBallot);
  const parent = new Map(sorted.map(proposal => [proposal.ballot, proposal.ballot]));
  const find = (ballot: number): number => {
    const up = parent.get(ballot)!;
    return up === ballot ? ballot : find(up);
  };
  const nearest = new Map<number, TallyNearest>();
  for (const pair of pairTallies(sorted)) {
    if (pair.distance * 10_000n <= limitBp * 2n * pair.voteUnits) parent.set(find(pair.a), find(pair.b));
    for (const [self, other] of [[pair.a, pair.b], [pair.b, pair.a]] as const) {
      const current = nearest.get(self);
      if (!current || pair.distance < current.distance) nearest.set(self, { ballot: other, distance: pair.distance, sharePercent: pair.sharePercent });
    }
  }
  const sets = [...sorted.reduce((byRoot, proposal) => {
    const root = find(proposal.ballot);
    return byRoot.set(root, [...(byRoot.get(root) ?? []), proposal]);
  }, new Map<number, CoinholderProposal[]>()).values()];
  const groups = sets.filter(set => set.length > 1)
    .sort((left, right) => right.length - left.length || left[0].ballot - right[0].ballot)
    .map((set, index) => describeGroup(set, String.fromCharCode(65 + index), limitBp));
  const ungrouped = sets.filter(set => set.length === 1).map(([proposal]) => proposal.ballot).sort((left, right) => left - right);
  return {
    groups,
    ungrouped,
    order: [...groups.flatMap(group => group.ballots), ...ungrouped],
    groupOf: new Map(groups.flatMap(group => group.ballots.map(ballot => [ballot, group.letter] as const))),
    nearest,
  };
}

/** Sorted totals for one option, split wherever the next total is more than the gap higher. */
export function recurringAmounts(proposals: CoinholderProposal[], option: CoinholderOptionId, gapUnits: bigint = RECURRING_GAP_UNITS): RecurringAmount[] {
  const values = proposals.map(proposal => ({ ballot: proposal.ballot, units: weights(proposal)[option] }))
    .sort((left, right) => left.units === right.units ? left.ballot - right.ballot : left.units < right.units ? -1 : 1);
  return values.reduce<RecurringAmount[]>((amounts, value) => {
    const last = amounts[amounts.length - 1];
    return last && value.units - last.to < gapUnits
      ? [...amounts.slice(0, -1), { ...last, to: value.units, ballots: [...last.ballots, value.ballot] }]
      : [...amounts, { option, from: value.units, to: value.units, ballots: [value.ballot], repeat: false }];
  }, []).map(amount => ({
    ...amount,
    ballots: [...amount.ballots].sort((left, right) => left - right),
    // Near-zero totals mean almost nobody chose the option; they are not a recurring amount.
    repeat: amount.ballots.length > 1 && amount.from >= gapUnits,
  }));
}

/** Any weight that chose one option everywhere fits inside each proposal's largest option. */
export function sameBallotCap(proposals: CoinholderProposal[]): SameBallotCap | null {
  return proposals.map(proposal => {
    const tally = weights(proposal);
    const option = OPTION_IDS.reduce<CoinholderOptionId>((best, id) => tally[id] > tally[best] ? id : best, "accept");
    return { ballot: proposal.ballot, option, units: tally[option], totalUnits: total(tally), sharePercent: insightPercent(tally[option], total(tally)) };
  }).reduce<SameBallotCap | null>((cap, candidate) => !cap || candidate.units < cap.units ? candidate : cap, null);
}

/** Ballots whose Abstain alone could have reversed the outcome under the strict-majority rule. */
export function abstainBeyondMargin(proposals: CoinholderProposal[]): number[] {
  return proposals.filter(proposal => {
    const tally = weights(proposal);
    const margin = tally.accept - tally.reject - tally.lower;
    return margin > 0n ? tally.abstain >= margin : tally.abstain > -margin;
  }).map(proposal => proposal.ballot).sort((left, right) => left - right);
}
