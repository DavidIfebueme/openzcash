import type { DiscussionParticipation } from "@/components/participate/workspace/proposal-discussion";
import type { ProposalAbandonment } from "./proposal-submission";
import type { SourceCapture } from "@/lib/participate/workspace/archive/source-proposals";

export type SignedReviewSummary = {
  roundId: string; revision: number; signed: number; eligible: number; state: "COLLECTING" | "PUBLISHED";
  outcome?: string; publishedAt?: string; approve?: number; reject?: number; abstain?: number;
  positions?: { name: string; choice: "APPROVE" | "REJECT" | "ABSTAIN"; rationale: string }[];
};
export type ProposalParticipation = {
  review?: SignedReviewSummary | null;
  recordId: string;
  title: string;
  application?: { applicant: string; requestedAmountUsd: string; submittedAt: string; publication: "PILOT_DEMO" | "COMMUNITY_PUBLICATION" };
  labels?: string[];
  commentCount: number;
  likes: number;
  likedByMe: boolean;
  chargedBefore: boolean;
  abandonment?: ProposalAbandonment | null;
  sourceCapture?: Pick<SourceCapture, "schema" | "checkedAt" | "proposal" | "source">;
  /** Display-only category recovered from the verified proposal, separate from the immutable capture. */
  sourceCategory?: string | null;
  /** Requested USD from the verified applicant field; never an approved award. */
  sourceRequestedUsd?: number | null;
};
export type ProposalParticipationBoard = {
  publicationMode?: "production" | "demo";
  proposals: ProposalParticipation[];
  participation: DiscussionParticipation | null;
  canParticipate: boolean;
};
