import type { DiscussionParticipation } from "@/components/participate/workspace/proposal-discussion";
import type { ProposalAbandonment } from "./proposal-submission";
import type { SourceCapture } from "@/lib/participate/workspace/archive/source-proposals";

export type ProposalParticipation = {
  recordId: string;
  title: string;
  labels?: string[];
  commentCount: number;
  likes: number;
  likedByMe: boolean;
  chargedBefore: boolean;
  abandonment?: ProposalAbandonment | null;
  sourceCapture?: Pick<SourceCapture, "schema" | "checkedAt" | "proposal" | "source">;
};
export type ProposalParticipationBoard = {
  proposals: ProposalParticipation[];
  participation: DiscussionParticipation | null;
  canParticipate: boolean;
};
