import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { COINHOLDER_ROUND_BASE64, COINHOLDER_ROUND_ID, COINHOLDER_SUMMARY_SHA256, COINHOLDER_SUMMARY_URLS } from "@/lib/coinholder/analytics/model";

export type CoinholderRevealCounts = { accept: number; reject: number; lower: number; abstain: number };
export type CoinholderRevealBucket = {
  at: string; until: string; counts: CoinholderRevealCounts; cumulative: CoinholderRevealCounts;
  total: number; cumulativeTotal: number;
};
export type CoinholderRevealHistory = {
  unit: "revealed shares"; interval: "day"; complete: true; fetchedAt: string;
  sourceUrl: string; sha256: string; days: CoinholderRevealBucket[];
  proposals: Array<{ id: number; days: CoinholderRevealBucket[] }>;
};

export const COINHOLDER_REVEALS_SHA256 = "7adf00dd1e382eba36ff8df593e5360d281f1d301464cc651564ffa371c48335";
export const COINHOLDER_REVEALS_RPC = "https://prod.explorer-rpc.valargroup.org";
const FIRST_DAY = Date.parse("2026-09-17T00:00:00Z");
const DAY_MS = 86_400_000;
const CREATION_HEIGHT = 7_201_411;
const PINNED_HEIGHT = 8_550_050;
const IDS = Array.from({ length: 37 }, (_, index) => String(index + 1));
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.string().datetime().refine(value => Number.isFinite(Date.parse(value)));
const options = z.array(count).length(4);
const counts = z.record(z.string(), options).refine(value => Object.keys(value).length === 37 && IDS.every(id => Object.hasOwn(value, id)), "Incomplete proposal counts");
const headerSchema = z.object({
  height: count, at: timestamp, blockHash: z.string().regex(/^[A-F0-9]{64}$/), appHash: z.string().regex(/^[A-F0-9]{64}$/),
  sourceUrl: z.string(), responseSha256: hash
});
const stateSchema = z.object({
  height: count, status: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  counts, total: count, sourceUrl: z.string(), responseSha256: hash, protobufSha256: hash,
  weights: z.record(z.string(), options.nullable()).optional()
});
const archiveSchema = z.object({
  schemaVersion: z.literal(1), roundId: z.literal(COINHOLDER_ROUND_ID), chainId: z.literal("zvote-1"),
  fetchedAt: timestamp, complete: z.literal(true), unit: z.literal("revealed shares"), interval: z.literal("UTC day"),
  optionIndices: z.tuple([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  optionLabels: z.tuple([z.literal("Accept"), z.literal("Reject"), z.literal("Reject with lower amount"), z.literal("Abstain")]),
  coverage: z.object({ from: timestamp, until: timestamp, pinnedHeight: z.literal(PINNED_HEIGHT), firstDayBeginsAtRoundCreation: z.literal(true) }),
  source: z.object({ rpc: z.literal(COINHOLDER_REVEALS_RPC), summaryUrl: z.literal(COINHOLDER_SUMMARY_URLS[0]), summarySha256: z.literal(COINHOLDER_SUMMARY_SHA256), sdkRevision: z.literal("4dbe05aad847513300e632ab1be48ae08662b240") }),
  baseline: z.object({ header: headerSchema, state: stateSchema }), final: z.object({ header: headerSchema, state: stateSchema }),
  boundaries: z.array(z.object({ boundaryAt: timestamp, before: headerSchema, after: headerSchema, state: stateSchema })).length(13),
  days: z.array(z.object({ at: timestamp, until: timestamp, counts, total: count, cumulative: counts, cumulativeTotal: count, snapshotHeight: count })).length(13)
});
const finalSummarySchema = z.object({
  vote_round_id: z.literal(COINHOLDER_ROUND_BASE64), status: z.literal(3),
  proposals: z.array(z.object({
    id: z.number().int().min(1).max(37),
    options: z.array(z.object({ index: z.number().int().min(0).max(3).optional(), ballot_count: count.optional(), total_value: count.optional() })).length(4)
  })).length(37)
});
type State = z.infer<typeof stateSchema>;
type Header = z.infer<typeof headerSchema>;

function safeSum(values: number[]): number {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(total)) throw new Error("Unsafe revealed-share total");
  return total;
}
function sameOptions(left: number[], right: number[]) {
  return left.every((value, index) => value === right[index]);
}
function namedOptions(values: number[]): CoinholderRevealCounts {
  return { accept: values[0], reject: values[1], lower: values[2], abstain: values[3] };
}
function aggregate(values: Record<string, number[]>) {
  return [0, 1, 2, 3].map(index => safeSum(IDS.map(id => values[id][index])));
}
function verifyHeader(header: Header) {
  if (header.sourceUrl !== `${COINHOLDER_REVEALS_RPC}/blockchain?minHeight=${header.height}&maxHeight=${header.height}`) throw new Error("Unexpected reveal header source");
}
function verifyState(state: State, expectedWeights: Record<string, number[]>) {
  const query = new URLSearchParams({ path: '"/svote.v1.Query/VoteSummary"', data: `0x0a20${COINHOLDER_ROUND_ID}`, height: String(state.height), prove: "false" });
  if (state.sourceUrl !== `${COINHOLDER_REVEALS_RPC}/abci_query?${query}`) throw new Error("Unexpected reveal state source");
  if (state.total !== safeSum(Object.values(state.counts).flat())) throw new Error("Revealed-share state total mismatch");
  if (state.weights) {
    if (Object.keys(state.weights).length !== 37 || IDS.some(id => !Object.hasOwn(state.weights!, id))) throw new Error("Incomplete reveal state weights");
    if (IDS.some(id => state.status === 3 ? !state.weights![id] || !sameOptions(state.weights![id]!, expectedWeights[id]) : state.weights![id] !== null)) throw new Error("Unpublished or mismatched reveal state weights");
  }
}

/** Server-side parser for the independently audited, fixed Q3 archive; never derives ZEC from shares. */
export function parseCoinholderRevealHistory(value: unknown, rawSummary: unknown): CoinholderRevealHistory {
  const archive = archiveSchema.parse(value);
  const summary = finalSummarySchema.parse(rawSummary);
  const expected: Record<string, number[]> = {};
  const expectedWeights: Record<string, number[]> = {};
  for (const proposal of summary.proposals) {
    if (expected[proposal.id]) throw new Error("Duplicate final revealed-share proposal");
    const ordered = [...proposal.options].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    if (ordered.some((option, index) => (option.index ?? 0) !== index)) throw new Error("Incomplete final revealed-share options");
    // Only the official protobuf JSON uses omitted scalar zero values. Every
    // archive proposal and option count must be explicitly present above.
    expected[proposal.id] = ordered.map(option => option.ballot_count ?? 0);
    expectedWeights[proposal.id] = ordered.map(option => option.total_value ?? 0);
  }
  for (const sample of [archive.baseline, archive.final]) {
    verifyHeader(sample.header);
    verifyState(sample.state, expectedWeights);
    if (sample.header.height !== sample.state.height) throw new Error("Reveal snapshot height mismatch");
  }
  if (archive.baseline.header.height !== CREATION_HEIGHT || archive.baseline.state.status !== 4 || archive.baseline.state.total !== 0 || archive.coverage.from !== archive.baseline.header.at) throw new Error("Invalid zero reveal baseline");
  if (archive.final.header.height !== PINNED_HEIGHT || archive.final.state.status !== 3 || Date.parse(archive.fetchedAt) < Date.parse(archive.final.header.at)) throw new Error("Invalid finalized reveal snapshot");
  if (IDS.some(id => !sameOptions(archive.final.state.counts[id], expected[id]))) throw new Error("Final revealed-share counts do not match official summary");

  const proposals = IDS.map(id => ({ id: Number(id), days: [] as CoinholderRevealBucket[] }));
  const days: CoinholderRevealBucket[] = [];
  let previous = archive.baseline.state;
  let previousHeight = archive.baseline.header.height;
  let previousAt = Date.parse(archive.baseline.header.at);
  for (const [index, day] of archive.days.entries()) {
    const boundary = archive.boundaries[index];
    const start = FIRST_DAY + index * DAY_MS;
    const end = start + DAY_MS;
    if (Date.parse(day.at) !== start || Date.parse(day.until) !== end || boundary.boundaryAt !== day.until) throw new Error("Nonconsecutive UTC reveal days");
    for (const header of [boundary.before, boundary.after]) verifyHeader(header);
    verifyState(boundary.state, expectedWeights);
    if (boundary.before.height <= previousHeight || boundary.after.height !== boundary.before.height + 1 || boundary.state.height !== boundary.before.height || day.snapshotHeight !== boundary.before.height || boundary.after.height >= PINNED_HEIGHT) throw new Error("Invalid reveal boundary heights");
    if (Date.parse(boundary.before.at) <= previousAt || Date.parse(boundary.before.at) >= end || Date.parse(boundary.after.at) < end || Date.parse(boundary.after.at) >= Date.parse(archive.final.header.at)) throw new Error("Invalid reveal UTC boundary bracket");
    if (boundary.state.status !== (index === 12 ? 3 : 1)) throw new Error("Unexpected historical reveal status");
    for (const [proposalIndex, id] of IDS.entries()) {
      const current = boundary.state.counts[id];
      const delta = current.map((value, option) => value - previous.counts[id][option]);
      if (delta.some(value => value < 0) || !sameOptions(day.counts[id], delta) || !sameOptions(day.cumulative[id], current)) throw new Error("Revealed-share delta or cumulative mismatch");
      proposals[proposalIndex].days.push({ at: day.at, until: day.until, counts: namedOptions(delta), cumulative: namedOptions(current), total: safeSum(delta), cumulativeTotal: safeSum(current) });
    }
    const dayCounts = aggregate(day.counts);
    const cumulative = aggregate(day.cumulative);
    if (safeSum(dayCounts) !== day.total || safeSum(cumulative) !== day.cumulativeTotal || day.cumulativeTotal !== boundary.state.total) throw new Error("Revealed-share daily total mismatch");
    days.push({ at: day.at, until: day.until, counts: namedOptions(dayCounts), cumulative: namedOptions(cumulative), total: day.total, cumulativeTotal: day.cumulativeTotal });
    previous = boundary.state;
    previousHeight = boundary.after.height;
    previousAt = Date.parse(boundary.after.at);
  }
  if (Date.parse(archive.baseline.header.at) < FIRST_DAY || Date.parse(archive.baseline.header.at) >= FIRST_DAY + DAY_MS || archive.coverage.until !== archive.days[12].until || IDS.some(id => !sameOptions(previous.counts[id], expected[id]))) throw new Error("Incomplete finalized reveal coverage");
  // The published artifact is compact JSON followed by one LF. Reproducing
  // those bytes also binds metadata not needed in the normalized UI contract.
  const sha256 = createHash("sha256").update(`${JSON.stringify(value)}\n`).digest("hex");
  if (sha256 !== COINHOLDER_REVEALS_SHA256) throw new Error("Historical reveal archive hash mismatch");
  return { unit: "revealed shares", interval: "day", complete: true, fetchedAt: archive.fetchedAt, sourceUrl: archive.final.state.sourceUrl, sha256, days, proposals };
}
