import { z } from "zod/v3";

export type ParticipationModeValue = "FREE" | "CREDITS";
export type CreditOperationKindValue = "PREVIEW_GRANT" | "ADMIN_DEMO_GRANT" | "COMMENT" | "REACTION" | "PURCHASE" | "PROPOSAL_SUBMISSION";
export const PREVIEW_CREDIT_GRANT = 25;
export const MAX_CREDIT_BALANCE = 1_000_000_000;
export const MAX_PARTICIPATION_COST = 100;

export type AccountCreditsView = {
  accounts: Array<{
    communityId: string;
    communityName: string;
    kind?: "DAO" | "COMMITTEE";
    balance: number;
    mode: ParticipationModeValue;
    commentCost: number;
    reactionCost: number;
    policyVersion: number;
    canManage: boolean;
    canClaimPreview: boolean;
    paymentReview?: boolean;
    fundingConfigured?: boolean;
    sandbox?: boolean;
  }>;
  sandbox: boolean;
  history: Array<{ id: string; communityId: string; kind: CreditOperationKindValue; delta: number; createdAt: string }>;
};

/** Fresh balance already read for the proposal board; full history loads on demand. */
export type AccountCreditSummary = {
  communityId: string;
  communityName: string;
  kind: "DAO" | "COMMITTEE";
  balance: number;
  mode: ParticipationModeValue;
  commentCost: number;
  reactionCost: number;
  sandbox: boolean;
  paymentReview: boolean;
};

export type ParticipationPolicyView = {
  communityId: string;
  mode: ParticipationModeValue;
  commentCost: number;
  reactionCost: number;
  version: number;
  canManage: boolean;
  sandbox: boolean;
  fundingConfigured: boolean;
  canActivateCredits: boolean;
};

export type ParticipationActor = { userId: string; accessId?: never } | { accessId: string; userId?: never };
export type ParticipationContext = {
  communityId: string;
  mode: ParticipationModeValue;
  commentCost: number;
  reactionCost: number;
  version: number;
  balance: number | null;
  sandbox: boolean;
  sponsored: boolean;
  effectiveCommentCost: number;
  effectiveReactionCost: number;
  paymentReview?: boolean;
};

export const participationPolicyInputSchema = z.object({
  mode: z.enum(["FREE", "CREDITS"]),
  commentCost: z.number().int().min(1).max(MAX_PARTICIPATION_COST),
  reactionCost: z.number().int().min(1).max(MAX_PARTICIPATION_COST),
  expectedVersion: z.number().int().min(1).max(2_147_483_646)
}).strict();
export const previewCreditInputSchema = z.object({ communityId: z.string().trim().min(1).max(128) }).strict();
export const participationDebitInputSchema = z.object({
  communityId: z.string().trim().min(1).max(128),
  userId: z.string().trim().min(1).max(128),
  cost: z.number().int().min(0).max(MAX_PARTICIPATION_COST),
  kind: z.enum(["COMMENT", "REACTION"]),
  requestKey: z.string().min(1).max(128).regex(/^[^\u0000-\u001f\u007f]+$/),
  payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
  targetId: z.string().trim().min(1).max(128),
  targetType: z.enum(["POLL", "POLL_COMMENT", "ARCHIVE", "ARCHIVE_COMMENT"]).optional(),
  policyVersion: z.number().int().min(1).max(2_147_483_647).optional()
}).strict();
export type ParticipationDebitInput = z.input<typeof participationDebitInputSchema>;
export type ParticipationDebitResult = { replayed: boolean; balance: number; operationId: string | null };
