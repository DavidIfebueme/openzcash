import { z } from "zod";
import type { CoinholderRevealHistory } from "@/lib/coinholder/analytics/reveals";

export const COINHOLDER_ROUND_ID = "2cba66eb16c7581a1692cb0b033785da0131059f645a0d2fb4dc2a5131505e01";
export const COINHOLDER_ROUND_BASE64 = "LLpm6xbHWBoWkssLAzeF2gExBZ9kWg0vtNwqUTFQXgE=";
export const COINHOLDER_SUMMARY_SHA256 = "9b858326b8149de92ea6788314a714b521fb2f57215e3742ec9b35b67c6639b5";
export const COINHOLDER_SUMMARY_URLS = [
  `https://zvote.zfnd.org/shielded-vote/v1/vote-summary/${COINHOLDER_ROUND_ID}`,
  `https://prod.vote-chain-primary.valargroup.org/shielded-vote/v1/vote-summary/${COINHOLDER_ROUND_ID}`
] as const;
export const COINHOLDER_METADATA_URL = "/api/coinholders/verify?round=q3-2026&format=json";

export type CoinholderOptionId = "accept" | "reject" | "lower" | "abstain";
export type CoinholderActivityBucket = { at: string; count: number; cumulative: number };
export type CoinholderHistoryBucket = CoinholderActivityBucket;
export type CoinholderTransaction = {
  txHash: string; height: number; at: string; kind: string; typeUrl: string;
  proposalIds: number[]; castCount: number; txBytes: number; sourceUrl: string;
  messages?: Array<{ typeUrl: string; proposalId: number; commitment: string; anchorHeight: number; proofBytes: number }>;
};
export type CoinholderActivity = {
  schemaVersion: 1;
  roundId: string;
  chainId: string;
  fetchedAt: string;
  sourceUrls: string[];
  unit: string;
  complete: boolean;
  coverage: { fromHeight: number; toHeight: number; firstAt: string | null; lastAt: string | null; reason?: string | null };
  totals: { transactions: number; castMessages: number };
  minutes: CoinholderActivityBucket[];
  hours: CoinholderActivityBucket[];
  proposals: Array<{ id: number; transactions: number; castMessages: number; minutes: CoinholderActivityBucket[]; hours: CoinholderActivityBucket[] }>;
  recentTransactions: CoinholderTransaction[];
  transactions?: CoinholderTransaction[];
  evidence: Record<string, unknown>;
};
/** Chart-only projection; transaction evidence is validated and retained on the server. */
export type CoinholderActivitySeries = Omit<CoinholderActivity, "transactions" | "recentTransactions" | "evidence">;
export type CoinholderProposal = {
  id: string;
  ballot: number;
  title: string;
  description: string;
  applicant: string | null;
  publishedOutcome: "Funded" | "Rejected";
  computedOutcome: "FUNDED" | "REJECTED";
  quorumMet: boolean;
  acceptSharePercent: number;
  githubUrl: string;
  verifyUrl: string;
  correction: { text: string; url: string | null } | null;
  totalZec: string;
  options: Array<{ id: CoinholderOptionId; label: string; weightUnits: string; zec: string; sharePercent: number }>;
};
export type CoinholderDashboard = {
  round: { id: "q3-2026"; chainRoundId: string; label: string; title: string; status: "FINALIZED"; voteStartAt: string | null; voteEndAt: string; snapshotHeight: number };
  rules: { quorumZec: string; quorumCountsAbstain: true; approvalComparison: "STRICT_MAJORITY"; approvalDenominator: "ACCEPT_PLUS_BOTH_REJECT_OPTIONS"; href: string; clarificationUrl: string };
  source: { state: "verified" | "snapshot"; checkedAt: string; snapshotFetchedAt: string; sha256: string; url: string; metadataUrl: string; warning: string | null };
  summary: { proposalCount: number; fundedCount: number; rejectedCount: number; quorumMetCount: number; minVotingPowerZec: string; maxVotingPowerZec: string };
  proposals: CoinholderProposal[];
  activity: CoinholderActivitySeries | null;
  revealHistory: CoinholderRevealHistory | null;
};
export type CoinholderRefresh = Omit<CoinholderDashboard, "activity" | "revealHistory"> & { activityOmitted: true };

const integerUnits = z.union([
  z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  z.string().regex(/^(0|[1-9][0-9]{0,30})$/)
]).transform((value) => BigInt(value));
const optionSchema = z.object({
  index: z.number().int().min(0).max(3).optional(),
  label: z.string().min(1).max(300),
  total_value: integerUnits.optional().default(0n)
});
const rawSummarySchema = z.object({
  vote_round_id: z.literal(COINHOLDER_ROUND_BASE64),
  status: z.literal(3),
  description: z.string().min(1).max(500),
  vote_end_time: z.number().int().positive().max(8_640_000_000_000),
  proposals: z.array(z.object({
    id: z.number().int().min(1).max(37),
    title: z.string().min(1).max(1000),
    description: z.string().max(20_000),
    options: z.array(optionSchema).length(4)
  })).length(37)
});
const zecValue = z.number().nonnegative().max(Number.MAX_SAFE_INTEGER / 8).refine((value) => Number.isSafeInteger(value * 8));
const metadataSchema = z.object({
  round: z.object({ id: z.literal("q3-2026"), label: z.string().min(1).max(100) }),
  rule: z.object({ quorumZec: z.literal(420000), quorumCountsAbstain: z.literal(true) }),
  rows: z.array(z.object({
    ballot: z.number().int().min(1).max(37),
    id: z.string().regex(/^[1-9][0-9]{0,8}$/),
    title: z.string().min(1).max(1000),
    applicant: z.string().max(500).nullable(),
    accept: zecValue, reject: zecValue, lower: zecValue, abstain: zecValue,
    total: zecValue,
    published: z.enum(["Funded", "Rejected"]),
    note: z.string().max(4000).nullable(),
    noteUrl: z.string().url().nullable()
  })).length(37)
});
const OPTIONS = [
  { id: "accept", label: "Accept", prefix: "Accept" },
  { id: "reject", label: "Reject", prefix: "Reject - Do Not Support" },
  { id: "lower", label: "Lower amount", prefix: "Reject - Would Reconsider" },
  { id: "abstain", label: "Abstain", prefix: "Abstain" }
] as const;

/** The Q3 vote-chain unit is exactly one eighth of one ZEC, not a person. */
export function coinholderUnitsToZec(units: bigint): string {
  if (units < 0n) throw new Error("Voting power cannot be negative");
  const fraction = ((units % 8n) * 125n).toString().padStart(3, "0");
  return `${units / 8n}.${fraction}`;
}

function percentage(numerator: bigint, denominator: bigint) {
  return denominator === 0n ? 0 : Number((numerator * 10_000n + denominator / 2n) / denominator) / 100;
}

export function calculateCoinholderOutcome(weights: { accept: bigint; reject: bigint; lower: bigint; abstain: bigint }) {
  if (Object.values(weights).some((weight) => weight < 0n)) throw new Error("Negative voting power");
  const total = weights.accept + weights.reject + weights.lower + weights.abstain;
  const majorityDenominator = weights.accept + weights.reject + weights.lower;
  const quorumMet = total >= 420_000n * 8n;
  return {
    total,
    quorumMet,
    acceptSharePercent: percentage(weights.accept, majorityDenominator),
    computedOutcome: quorumMet && weights.accept > weights.reject + weights.lower ? "FUNDED" as const : "REJECTED" as const
  };
}

/** Validates the published metadata against every option in the exact Q3 summary. */
export function buildCoinholderDashboard(raw: unknown, metadata: unknown, source: CoinholderDashboard["source"], activity: CoinholderActivitySeries | null = null, revealHistory: CoinholderRevealHistory | null = null): CoinholderDashboard {
  const summary = rawSummarySchema.parse(raw);
  const meta = metadataSchema.parse(metadata);
  if (new Set(summary.proposals.map((proposal) => proposal.id)).size !== 37 || new Set(meta.rows.map((row) => row.ballot)).size !== 37 || new Set(meta.rows.map((row) => row.id)).size !== 37) {
    throw new Error("Incomplete or duplicate proposal mapping");
  }
  const totals: bigint[] = [];
  const proposals = [...summary.proposals].sort((a, b) => a.id - b.id).map((proposal): CoinholderProposal => {
    const row = meta.rows.find((item) => item.ballot === proposal.id)!;
    const options = [...proposal.options].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    if (options.some((option, index) => (option.index ?? 0) !== index || !option.label.startsWith(OPTIONS[index].prefix))) {
      throw new Error("Unexpected ballot option mapping");
    }
    const weights = { accept: options[0].total_value, reject: options[1].total_value, lower: options[2].total_value, abstain: options[3].total_value };
    const outcome = calculateCoinholderOutcome(weights);
    if (OPTIONS.some(({ id }, index) => BigInt(row[id] * 8) !== options[index].total_value) || BigInt(row.total * 8) !== outcome.total) {
      throw new Error("Published option totals do not match the vote chain");
    }
    if (row.published.toUpperCase() !== outcome.computedOutcome) throw new Error("Published outcome does not match the Q3 counting rule");
    totals.push(outcome.total);
    return {
      id: row.id, ballot: proposal.id, title: row.title, description: proposal.description, applicant: row.applicant,
      publishedOutcome: row.published, computedOutcome: outcome.computedOutcome, quorumMet: outcome.quorumMet, acceptSharePercent: outcome.acceptSharePercent,
      githubUrl: `https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/${row.id}`,
      verifyUrl: `/coinholders/verify/q3-2026/${row.id}`,
      correction: row.note ? { text: row.note, url: row.noteUrl && /^https:\/\/forum\.zcashcommunity\.com\//.test(row.noteUrl) ? row.noteUrl : null } : null,
      totalZec: coinholderUnitsToZec(outcome.total),
      options: OPTIONS.map(({ id, label }, index) => ({ id, label, weightUnits: options[index].total_value.toString(), zec: coinholderUnitsToZec(options[index].total_value), sharePercent: percentage(options[index].total_value, outcome.total) }))
    };
  });
  return {
    round: { id: "q3-2026", chainRoundId: COINHOLDER_ROUND_ID, label: meta.round.label, title: summary.description, status: "FINALIZED", voteStartAt: null, voteEndAt: new Date(summary.vote_end_time * 1000).toISOString(), snapshotHeight: 3_485_940 },
    rules: { quorumZec: "420000", quorumCountsAbstain: true, approvalComparison: "STRICT_MAJORITY", approvalDenominator: "ACCEPT_PLUS_BOTH_REJECT_OPTIONS", href: "https://zips.z.cash/zip-1016", clarificationUrl: "https://forum.zcashcommunity.com/t/q3-coinholder-directed-retroactive-grants-program-results/57909/19" },
    source,
    summary: { proposalCount: proposals.length, fundedCount: proposals.filter((proposal) => proposal.computedOutcome === "FUNDED").length, rejectedCount: proposals.filter((proposal) => proposal.computedOutcome === "REJECTED").length, quorumMetCount: proposals.filter((proposal) => proposal.quorumMet).length, minVotingPowerZec: coinholderUnitsToZec(totals.reduce((a, b) => a < b ? a : b)), maxVotingPowerZec: coinholderUnitsToZec(totals.reduce((a, b) => a > b ? a : b)) },
    proposals, activity, revealHistory
  };
}

const safeCount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const atSchema = z.string().datetime();
const activityBucketSchema = z.object({ at: atSchema, count: safeCount, cumulative: safeCount });
const castKind = z.enum(["MsgCastVote", "MsgCastVoteBatch", "MsgDelegateAndCastVoteBatch"]);
const castType = z.enum(["/svote.v1.MsgCastVote", "/svote.v1.MsgCastVoteBatch", "/svote.v1.MsgDelegateAndCastVoteBatch"]);
const publicSourceUrl = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.origin === "https://zvote.zfnd.org" && !url.username && !url.password;
});
const transactionSchema = z.object({
  txHash: z.string().regex(/^[0-9A-F]{64}$/), height: safeCount, at: atSchema,
  kind: castKind, typeUrl: castType,
  proposalIds: z.array(z.number().int().min(1).max(37)).min(1).max(100_000),
  castCount: safeCount.refine((value) => value > 0), txBytes: safeCount, sourceUrl: publicSourceUrl,
  messages: z.array(z.object({ typeUrl: z.literal("/svote.v1.MsgCastVote"), proposalId: z.number().int().min(1).max(37), commitment: z.string().regex(/^[0-9a-f]{64}$/), anchorHeight: safeCount, proofBytes: safeCount })).max(100_000).optional()
});
const activitySchema = z.object({
  schemaVersion: z.literal(1), roundId: z.literal(COINHOLDER_ROUND_ID), chainId: z.literal("zvote-1"),
  fetchedAt: atSchema, sourceUrls: z.array(publicSourceUrl).min(1).max(100), unit: z.literal("Encrypted vote commitments"), complete: z.boolean(),
  coverage: z.object({ fromHeight: safeCount, toHeight: safeCount, firstAt: atSchema.nullable(), lastAt: atSchema.nullable(), reason: z.string().max(4000).nullish() }),
  totals: z.object({ transactions: safeCount, castMessages: safeCount }),
  minutes: z.array(activityBucketSchema).max(100_000), hours: z.array(activityBucketSchema).max(10_000),
  proposals: z.array(z.object({ id: z.number().int().min(1).max(37), transactions: safeCount, castMessages: safeCount, minutes: z.array(activityBucketSchema).max(100_000), hours: z.array(activityBucketSchema).max(10_000) })).max(37),
  recentTransactions: z.array(transactionSchema).max(100),
  evidence: z.record(z.string(), z.unknown())
});

function validateBuckets(buckets: CoinholderActivityBucket[], expectedCount: number, interval: number) {
  let total = 0;
  let previousAt = -Infinity;
  for (const bucket of buckets) {
    const at = Date.parse(bucket.at);
    total += bucket.count;
    if (at % interval !== 0 || at <= previousAt || bucket.cumulative !== total || !Number.isSafeInteger(total)) throw new Error("Invalid activity bucket sequence");
    previousAt = at;
  }
  if (total !== expectedCount) throw new Error("Activity counts do not match bucket totals");
}

/** Chain history is a separate evidence stream; it never supplies weighted vote choices. */
export function parseCoinholderActivity(value: unknown, transactionData: unknown): CoinholderActivity {
  const activity = activitySchema.parse(value);
  const sidecar = z.object({ roundId: z.literal(COINHOLDER_ROUND_ID), chainId: z.literal("zvote-1"), complete: z.boolean(), transactions: z.array(transactionSchema).max(100_000) }).parse(transactionData);
  if (sidecar.complete !== activity.complete || sidecar.transactions.length !== activity.totals.transactions || activity.coverage.toHeight < activity.coverage.fromHeight) throw new Error("Activity coverage mismatch");
  if (new Set(activity.proposals.map((proposal) => proposal.id)).size !== activity.proposals.length) throw new Error("Duplicate proposal history");
  validateBuckets(activity.minutes, activity.totals.castMessages, 60_000);
  validateBuckets(activity.hours, activity.totals.castMessages, 3_600_000);
  let proposalTotal = 0;
  const combinedMinutes = new Map<string, number>();
  const combinedHours = new Map<string, number>();
  for (const proposal of activity.proposals) {
    validateBuckets(proposal.minutes, proposal.castMessages, 60_000);
    validateBuckets(proposal.hours, proposal.castMessages, 3_600_000);
    proposalTotal += proposal.castMessages;
    for (const bucket of proposal.minutes) combinedMinutes.set(bucket.at, (combinedMinutes.get(bucket.at) ?? 0) + bucket.count);
    for (const bucket of proposal.hours) combinedHours.set(bucket.at, (combinedHours.get(bucket.at) ?? 0) + bucket.count);
  }
  if (proposalTotal !== activity.totals.castMessages || activity.minutes.some((bucket) => combinedMinutes.get(bucket.at) !== bucket.count) || activity.hours.some((bucket) => combinedHours.get(bucket.at) !== bucket.count)) throw new Error("Proposal history totals do not match round history");
  const transactions = new Map<string, CoinholderTransaction>();
  const minutesFromTransactions = new Map<number, number>();
  const hoursFromTransactions = new Map<number, number>();
  const castsByProposal = new Map<number, number>();
  const transactionsByProposal = new Map<number, number>();
  const proposalMinutes = new Map<string, number>();
  const proposalHours = new Map<string, number>();
  let castTotal = 0;
  for (const transaction of sidecar.transactions) {
    if (transactions.has(transaction.txHash) || transaction.kind !== transaction.typeUrl.slice("/svote.v1.".length) || transaction.sourceUrl !== `https://zvote.zfnd.org/shielded-vote/v1/tx/${transaction.txHash}` || transaction.proposalIds.length !== transaction.castCount || transaction.height < activity.coverage.fromHeight || transaction.height > activity.coverage.toHeight) throw new Error("Invalid transaction evidence");
    transactions.set(transaction.txHash, transaction);
    castTotal += transaction.castCount;
    const minute = Math.floor(Date.parse(transaction.at) / 60_000) * 60_000;
    const hour = Math.floor(Date.parse(transaction.at) / 3_600_000) * 3_600_000;
    minutesFromTransactions.set(minute, (minutesFromTransactions.get(minute) ?? 0) + transaction.castCount);
    hoursFromTransactions.set(hour, (hoursFromTransactions.get(hour) ?? 0) + transaction.castCount);
    for (const id of new Set(transaction.proposalIds)) transactionsByProposal.set(id, (transactionsByProposal.get(id) ?? 0) + 1);
    for (const id of transaction.proposalIds) {
      castsByProposal.set(id, (castsByProposal.get(id) ?? 0) + 1);
      proposalMinutes.set(`${id}:${minute}`, (proposalMinutes.get(`${id}:${minute}`) ?? 0) + 1);
      proposalHours.set(`${id}:${hour}`, (proposalHours.get(`${id}:${hour}`) ?? 0) + 1);
    }
  }
  if (castTotal !== activity.totals.castMessages) throw new Error("Transaction casts do not match history");
  if (activity.minutes.some((bucket) => minutesFromTransactions.get(Date.parse(bucket.at)) !== bucket.count) || activity.hours.some((bucket) => hoursFromTransactions.get(Date.parse(bucket.at)) !== bucket.count) || activity.proposals.some((proposal) => (castsByProposal.get(proposal.id) ?? 0) !== proposal.castMessages || (transactionsByProposal.get(proposal.id) ?? 0) !== proposal.transactions || proposal.minutes.some((bucket) => proposalMinutes.get(`${proposal.id}:${Date.parse(bucket.at)}`) !== bucket.count) || proposal.hours.some((bucket) => proposalHours.get(`${proposal.id}:${Date.parse(bucket.at)}`) !== bucket.count))) throw new Error("Transaction times or proposals do not match history");
  const times = sidecar.transactions.map((transaction) => Date.parse(transaction.at));
  const firstAt = times.reduce((previous, value) => Math.min(previous, value), Infinity);
  const lastAt = times.reduce((previous, value) => Math.max(previous, value), -Infinity);
  if (times.length ? Date.parse(activity.coverage.firstAt ?? "") !== firstAt || Date.parse(activity.coverage.lastAt ?? "") !== lastAt : activity.coverage.firstAt !== null || activity.coverage.lastAt !== null) throw new Error("Activity time coverage does not match records");
  const seenRecent = new Set<string>();
  for (const transaction of activity.recentTransactions) {
    const recorded = transactions.get(transaction.txHash);
    if (seenRecent.has(transaction.txHash) || !recorded || recorded.castCount !== transaction.castCount || recorded.height !== transaction.height || recorded.at !== transaction.at || recorded.sourceUrl !== transaction.sourceUrl || recorded.kind !== transaction.kind || recorded.typeUrl !== transaction.typeUrl || recorded.txBytes !== transaction.txBytes || JSON.stringify(recorded.proposalIds) !== JSON.stringify(transaction.proposalIds) || transaction.messages && transaction.messages.length !== transaction.castCount) throw new Error("Recent transaction evidence mismatch");
    if (transaction.messages?.some((message, index) => transaction.proposalIds[index] !== message.proposalId)) throw new Error("Cast input belongs to another proposal");
    seenRecent.add(transaction.txHash);
  }
  return { ...activity, transactions: [...transactions.values()].sort((a, b) => b.height - a.height || b.txHash.localeCompare(a.txHash)) };
}
