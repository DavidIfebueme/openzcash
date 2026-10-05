import type { Project, Repository } from "@/lib/ecosystem/types";
import type { ReviewedEvidence } from "./evidence";

export type Program = "zcg" | "coinholder";
export type HistoryIdentity = {
  id: string; name: string; description: string; category: string;
  website: string; project: Project | null; communityId: string | null;
  recipientKeys: string[]; applicationTopics: number[];
  reportTopics: { id: number; title: string }[];
  /** Reviewed public identity/reference links, not work evidence. */
  referenceSources?: Source[];
  /** Reviewed DAO proposal references only; no payment inference or mixed totals. */
  daoFundingSources?: { ref: string; title: string; url: string; createdAt: string; period: string; reviewedAt: string }[];
  repositories: Repository[]; checkedAt: string;
};
export type Source = { label: string; url: string; observedAt: string | null };
/** References establish source coverage, not publication, delivery or acceptance. */
export type HistorySource = Source & { kind: "website" | "repository" | "reference" | "funding" | "report" | "publication" };
export type HistoryRepository = {
  name: string; url: string; archived: boolean; lastPushedAt: string | null;
  source: Source; activityUrl: string | null;
};
export type ProposalRecord = {
  id: string; program: Program; title: string; status: string;
  submittedDate: string | null; decisionDate: string | null;
  requestedUsdCents: string | null; platformLink: string | null;
  forumLink: string | null; source: Source;
};
export type PaymentRecord = {
  id: string; program: Program; project: string; recipientKey: string;
  milestone: string | null; deliverable: string | null;
  isPaid: boolean; paidDate: string | null;
  budgetUsdCents: string | null; recordedZecZat: string | null; source: Source;
};
export type FinanceRecords = {
  proposals: ProposalRecord[]; payments: PaymentRecord[];
  proposalsAvailable: boolean; paymentsAvailable: boolean; importedAt: string | null;
};
export type HistoryEvent = {
  id: string; kind: "proposal" | "decision" | "payment" | "release" | "report" | "context" | "delivery" | "integration" | "usage";
  title: string; detail: string; date: string | null;
  evidence: "source_record" | "published_artifact" | "team_reported" | "reviewed_delivery" | "documented_integration" | "usage_observation";
  source: Source; grantId: string | null;
  sourceState?: "unlisted";
  releaseChannel?: "release" | "prerelease";
  budgetUsdCents?: string | null; recordedZecZat?: string | null;
};
export type Amount = { known: string | null; records: number; missing: number };
export type GrantHistory = {
  id: string; title: string; program: Program; status: string;
  statusBasis: "published_proposal" | "dated_catalog" | "ledger_only" | "ambiguous";
  sharedWith: { id: string; name: string }[];
  requestedUsdCents: string | null;
  requestedAmountReview?: { basis: "fixed" | "cap"; summary: string; source: Source };
  // A requested amount or ledger budget does not establish an approved award.
  approvedUsdCents: null;
  budgetUsdCents: Amount; paidBudgetUsdCents: Amount; recordedZecZat: Amount;
  source: Source; scopeUrl: string | null;
  milestones: { id: string; title: string; deliverable: string | null; paymentRecorded: boolean; paidDate: string | null; source: Source; deliveryEvidence: HistoryEvent[] }[];
};
export type ProjectHistory = {
  schemaVersion: 1; project: Pick<HistoryIdentity, "id" | "name" | "description" | "category" | "website" | "communityId">;
  assembledAt: string; registryCheckedAt: string; repositorySnapshotAt: string;
  ledgerImportedAt: string | null;
  coverage: { proposalsAvailable: boolean; paymentsAvailable: boolean; releasesComplete: false };
  grants: GrantHistory[]; timeline: HistoryEvent[]; gaps: string[];
  reviews: (ReviewedEvidence & { supersededBy: string | null; linked: boolean })[];
  reportLinks: { title: string; url: string }[];
  sources: HistorySource[]; repositories: HistoryRepository[];
  notes: string[];
};
