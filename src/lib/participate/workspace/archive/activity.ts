import { z } from "zod/v3";
import { archiveIdSchema, archiveNetworkSchema, canonicalJson, digestSchema, sha256, utf8, type ArchiveNetwork } from "./format";
import { merkleProofSchema, verifyArchiveMerkleProof } from "./merkle";
import { ballotSchema, decisionHash, roundSchema, tallyDecisions } from "@/lib/participate/workspace/decisions/format";
import { abandonmentReasonSchema } from "@/lib/participate/workspace/domain/proposal-submission";

const id = z.string().min(1).max(128);
const labelSnapshot = z.object({ id: z.string().regex(/^\d{1,32}$/), name: z.string().min(1).max(100), color: z.string().regex(/^[0-9a-f]{6}$/) }).strict();
const labelsAction = z.object({ kind: z.literal("PROPOSAL_LABELS_SET"), authority: z.literal("COMMITTEE_ACCOUNT"),
  labelsVersion: z.number().int().positive(), catalogHash: digestSchema,
  previousLabels: z.array(z.string().regex(/^\d{1,32}$/)).max(100), labels: z.array(labelSnapshot).max(100) }).strict();
const reviewAction = z.object({ kind: z.literal("REVIEW_DECIDED"), authority: z.literal("INDEPENDENT_PILOT_REVIEW"),
  roundId: z.string().uuid(), roundHash: digestSchema, receiptHash: digestSchema, reviewedManifestHash: digestSchema,
  revision: z.number().int().positive(), outcome: z.enum(["APPROVED", "REJECTED"]), signed: z.literal(5),
  approve: z.number().int().min(0).max(5), reject: z.number().int().min(0).max(5), abstain: z.number().int().min(0).max(5) }).strict();
const base = z.object({
  schema: z.literal("PARTICIPATE_EVENT_V1"), id: z.string().uuid(),
  communityId: id, recordId: archiveIdSchema, proposalManifestHash: digestSchema,
  sequence: z.number().int().positive().max(2147483647), previousEventHash: digestSchema.nullable(),
  actor: z.union([z.string().uuid(), z.literal("SOURCE_OBSERVER")]), occurredAt: z.string().datetime(), recordedAt: z.string().datetime(),
  origin: z.enum(["LIVE", "IMPORTED"])
}).strict();

export const activityEventSchema = z.discriminatedUnion("kind", [
  base.extend({ kind: z.literal("COMMENT_POSTED"), commentId: id, parentId: id.nullable(), bodyHash: digestSchema }),
  base.extend({ kind: z.literal("COMMENT_EDITED"), commentId: id, version: z.number().int().min(2).max(50), bodyHash: digestSchema, previousBodyHash: digestSchema }),
  base.extend({ kind: z.literal("COMMENT_WITHDRAWN"), commentId: id, version: z.number().int().min(1).max(50), bodyHash: digestSchema }),
  base.extend({ kind: z.literal("DISCUSSION_CLOSED"), authority: z.literal("OFFICIAL_SOURCE"), snapshotHash: digestSchema, status: z.enum(["APPROVED", "REJECTED", "ABANDONED", "CLOSED"]), sourceUpdatedAt: z.string().datetime() }),
  base.extend({ kind: z.literal("COMMENT_HIDDEN"), commentId: id, reason: z.string().min(1).max(500) }),
  base.extend({ kind: z.literal("PROPOSAL_LIKE_SET"), liked: z.boolean() }),
  base.extend({ kind: z.literal("PROPOSAL_ABANDONED"), reason: abandonmentReasonSchema, authority: z.literal("AUTHOR_ACCOUNT") }),
  base.merge(labelsAction),
  base.merge(reviewAction),
  base.extend({ kind: z.literal("COMMENT_LIKE_SET"), commentId: id, version: z.number().int().min(1).max(50).optional(), liked: z.boolean() })
]).superRefine((event, context) => {
  if ((event.kind === "DISCUSSION_CLOSED") !== (event.actor === "SOURCE_OBSERVER")) context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid event authority" });
  if (event.kind === "REVIEW_DECIDED" && (event.approve + event.reject + event.abstain !== 5 || (event.approve >= 3) !== (event.outcome === "APPROVED"))) context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid completed review" });
  if ((event.sequence === 1) !== (event.previousEventHash === null)) context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid event sequence" });
  if (Date.parse(event.occurredAt) > Date.parse(event.recordedAt)) context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid event time" });
});
export type ActivityEvent = z.infer<typeof activityEventSchema>;
export type ActivityAction =
  | { kind: "COMMENT_POSTED"; commentId: string; parentId: string | null; bodyHash: string }
  | { kind: "COMMENT_EDITED"; commentId: string; version: number; bodyHash: string; previousBodyHash: string }
  | { kind: "COMMENT_WITHDRAWN"; commentId: string; version: number; bodyHash: string }
  | { kind: "DISCUSSION_CLOSED"; authority: "OFFICIAL_SOURCE"; snapshotHash: string; status: "APPROVED" | "REJECTED" | "ABANDONED" | "CLOSED"; sourceUpdatedAt: string }
  | { kind: "COMMENT_HIDDEN"; commentId: string; reason: string }
  | { kind: "PROPOSAL_LIKE_SET"; liked: boolean }
  | { kind: "PROPOSAL_ABANDONED"; reason: string; authority: "AUTHOR_ACCOUNT" }
  | z.infer<typeof labelsAction>
  | z.infer<typeof reviewAction>
  | { kind: "COMMENT_LIKE_SET"; commentId: string; version?: number; liked: boolean };

export function activityBatchMemo(root: string, count: number, network: ArchiveNetwork) {
  digestSchema.parse(root); archiveNetworkSchema.parse(network);
  if (!Number.isInteger(count) || count < 1 || count > 10000) throw new Error("Invalid activity batch size");
  return `PARTICIPATE|ACTIVITY|v1|${network}|count:${count}|sha256:${root}`;
}

export const activityInclusionSchema = z.object({
  pool: z.enum(["sapling", "ironwood"]).optional(), network: archiveNetworkSchema, memo: z.string().max(512), receiver: z.string().min(40).max(512), proof: merkleProofSchema
}).strict();
export const activityBundleSchema = z.object({
  schema: z.literal("PARTICIPATE_EVENT_RECEIPT_V1"), event: z.string().max(16000), eventHash: digestSchema,
  closure: z.string().max(8000000).optional(),
  reviewReceipt: z.string().max(8000000).optional(),
  body: z.string().max(4000).nullable(), inclusion: activityInclusionSchema.nullable(),
  // A saved observation is not a fresh independent chain verification.
  chain: z.unknown().nullable()
}).strict();
export type ActivityBundle = z.infer<typeof activityBundleSchema>;

export async function verifyActivityEvent(eventJson: string, expectedHash: string) {
  digestSchema.parse(expectedHash);
  const event = activityEventSchema.parse(JSON.parse(eventJson));
  if (canonicalJson(event) !== eventJson || await sha256(utf8(eventJson)) !== expectedHash) throw new Error("Event fingerprint mismatch");
  return event;
}

export async function verifyActivityBundle(input: unknown, expectedHash: string) {
  const bundle = activityBundleSchema.parse(input);
  if (bundle.eventHash !== expectedHash) throw new Error("Receipt fingerprint mismatch");
  const event = await verifyActivityEvent(bundle.event, expectedHash);
  if (bundle.body !== null && (!["COMMENT_POSTED", "COMMENT_EDITED"].includes(event.kind) || !("bodyHash" in event) || await sha256(utf8(bundle.body)) !== event.bodyHash)) throw new Error("Comment contents mismatch");
  if (bundle.closure !== undefined) {
    const snapshot = JSON.parse(bundle.closure);
    if (event.kind !== "DISCUSSION_CLOSED" || await sha256(utf8(bundle.closure)) !== event.snapshotHash || canonicalJson(snapshot) !== bundle.closure
      || snapshot.schema !== "PARTICIPATE_DISCUSSION_CLOSURE_V1" || snapshot.communityId !== event.communityId || snapshot.recordId !== event.recordId
      || snapshot.proposalManifestHash !== event.proposalManifestHash || snapshot.throughSequence !== event.sequence - 1 || snapshot.throughEventHash !== event.previousEventHash
      || snapshot.closedAt !== event.occurredAt || snapshot.status !== event.status || snapshot.sourceUpdatedAt !== event.sourceUpdatedAt) throw new Error("Closing record mismatch");
  }
  if (event.kind === "REVIEW_DECIDED") {
    if (!bundle.reviewReceipt || await sha256(utf8(bundle.reviewReceipt)) !== event.receiptHash) throw new Error("Review receipt fingerprint mismatch");
    const receipt = JSON.parse(bundle.reviewReceipt);
    if (canonicalJson(receipt) !== bundle.reviewReceipt || receipt.schema !== "PARTICIPATE_DECISION_RECEIPT_V1" || receipt.round?.id !== event.roundId
      || receipt.roundHash !== event.roundHash || receipt.round?.proposal?.manifestHash !== event.reviewedManifestHash
      || receipt.round?.proposal?.recordId !== event.recordId || receipt.round?.proposal?.revision !== event.revision
      || receipt.asOf !== event.occurredAt) throw new Error("Review publication binding mismatch");
    const round = roundSchema.parse(receipt.round), ballots = z.array(ballotSchema).length(5).parse(receipt.ballots);
    if (round.schema !== "PARTICIPATE_DECISION_ROUND_V4" || await decisionHash(round) !== event.roundHash
      || new Set(ballots.map(b => b.envelope.voterId)).size !== 5
      || ballots.some(b => b.envelope.schema !== "PARTICIPATE_DECISION_SIGNATURE_V2" || b.envelope.roundHash !== event.roundHash || !round.members.some(m => m.id === b.envelope.voterId && m.keyHashes.includes(b.keyHash)))
      || new Date(Math.max(...ballots.map(b => Date.parse(b.recordedAt)))).toISOString() !== receipt.asOf) throw new Error("Review roster binding mismatch");
    const tally = tallyDecisions(round, ballots, false);
    if (tally.outcome !== event.outcome || tally.approve !== event.approve || tally.reject !== event.reject || tally.abstain !== event.abstain) throw new Error("Review tally mismatch");
  } else if (bundle.reviewReceipt !== undefined) throw new Error("Unexpected review receipt");
  if (bundle.inclusion) {
    const { network, receiver, memo, pool = "sapling" } = bundle.inclusion;
    const proof = verifyArchiveMerkleProof(expectedHash, bundle.inclusion.proof);
    if (memo !== activityBatchMemo(proof.root, proof.leafCount, network) || !receiver.startsWith(pool === "ironwood" ? (network === "mainnet" ? "u1" : "utest1") : (network === "mainnet" ? "zs1" : "ztestsapling1"))) throw new Error("Activity commitment mismatch");
  }
  return { event, bundle };
}

export const activityLabel = (event: ActivityEvent) => event.kind === "COMMENT_POSTED" ? "Comment published"
  : event.kind === "COMMENT_EDITED" ? `Comment edited · Version ${event.version}`
  : event.kind === "COMMENT_WITHDRAWN" ? "Comment withdrawn by author"
  : event.kind === "DISCUSSION_CLOSED" ? "Discussion snapshot closed"
  : event.kind === "REVIEW_DECIDED" ? "Signed pilot review published"
  : event.kind === "COMMENT_HIDDEN" ? "Comment hidden"
  : event.kind === "PROPOSAL_ABANDONED" ? "Proposal abandoned by author"
  : event.kind === "PROPOSAL_LABELS_SET" ? "Committee labels updated"
  : event.kind === "PROPOSAL_LIKE_SET" ? (event.liked ? "Proposal liked" : "Proposal like removed")
  : event.liked ? "Comment liked" : "Comment like removed";
