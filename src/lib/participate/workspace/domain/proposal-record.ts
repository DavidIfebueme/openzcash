import type { buildArchiveProof } from "@/lib/participate/workspace/archive/proof";
import type { ProposalAbandonment } from "./proposal-submission";
import type { SourceCapture } from "@/lib/participate/workspace/archive/source-proposals";

/** Only public, verified record fields cross the lazy-reading boundary. */
export type ProposalRecord = {
  recordId: string;
  title: string;
  labels?: string[];
  revision: number;
  originalDecisionDate: string | null;
  submittedAt?: string;
  kind?: "HISTORICAL_SUMMARY" | "REVIEW_SNAPSHOT" | "NATIVE_PROPOSAL" | "SOURCE_PROPOSAL";
  application?: { applicant: string; requestedAmountUsd: string };
  sourceCapture?: SourceCapture;
  abandonment?: ProposalAbandonment | null;
  capturedAt: string;
  markdown: string;
  manifestHash: string;
  fileCount: number;
  revisions: { revision: number; publishedAt: string }[];
  network: string | null;
  proof: Pick<ReturnType<typeof buildArchiveProof>, "label" | "detail" | "verified" | "evidence"> & { hasReceipt: boolean };
};
