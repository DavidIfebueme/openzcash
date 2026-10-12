import { z } from "zod/v3";
import { ARCHIVE_SCHEMA, SOURCE_ARCHIVE_SCOPE, canonicalJson, sha256, utf8, decodeFile, verifyArchivePackage, digestSchema, type ArchiveManifest } from "./format";
import { ZCG_REVIEW_SOURCE, zcgReviewProposalSchema } from "@/lib/participate/workspace/domain/zcg-review";
import { classifyZcgSectors, zcgSourceMetadataSchema } from "@/lib/participate/workspace/domain/zcg-source-metadata";
import { proposalTagsSchema } from "@/lib/participate/workspace/domain/proposal-tags";
import { fingerprintSourceObservation, sourceEvidenceSchema, sourceIssueSchema, sourceObservationOutcome, sourceOutcomeSchema, validateSourceEvidence, type SourceEvidence } from "./source-updates";

export { fingerprintSourceObservation, sourceObservationOutcome, type SourceEvidence } from "./source-updates";

const sourceSchema = zcgSourceMetadataSchema.innerType().shape.proposals.element;
const issueSchema = z.object({
  number: z.number().int().positive(), html_url: z.string().url(), title: z.string().min(1).max(300),
  body: z.string().min(1).max(500_000), state: z.literal("open"), created_at: z.string().datetime(), updated_at: z.string().datetime(),
  user: z.object({ login: z.string().min(1).max(100) }), pull_request: z.never().optional(),
  labels: z.array(z.object({ name: z.string().min(1).max(100), color: z.string().regex(/^[a-fA-F0-9]{6}$/), description: z.string().max(1000).nullable() })).max(100)
});
const sourceCaptureV1Schema = z.object({
  schema: z.literal("PARTICIPATE_SOURCE_CAPTURE_V1"), checkedAt: z.string().datetime(),
  proposal: zcgReviewProposalSchema, source: sourceSchema
}).strict().superRefine((value, ctx) => {
  const { proposal, source } = value;
  if (proposal.id !== source.recordId || proposal.issueNumber !== source.issueNumber || proposal.proposalUrl !== source.url || proposal.title !== source.title || proposal.sourceUpdatedAt !== source.updatedAt || proposal.state !== source.state || canonicalJson(proposal.labels) !== canonicalJson(source.labels.map(label => label.name))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Source capture identity mismatch" });
  }
});
const sourceUpdateProposalSchema = z.object({
  id: z.string().regex(/^zcg-[a-z0-9-]+$/).max(96), issueNumber: z.number().int().positive().safe(),
  title: z.string().min(1).max(300), applicant: z.string().min(1).max(100),
  outcome: sourceOutcomeSchema, state: z.enum(["open", "closed"]),
  submittedAt: z.string().datetime(), sourceUpdatedAt: z.string().datetime(),
  requestedUsd: z.number().finite().nonnegative().max(100_000_000).nullable(), tags: proposalTagsSchema,
  labels: z.array(z.string().min(1).max(100)).max(100), proposalUrl: z.string().url()
}).strict();
export const SOURCE_EVIDENCE_SCOPE = "Official repository status events and repository-associated comments. Repository association is not a committee membership or cryptographic signature; no individual votes are inferred.";
const sourceCaptureV2Schema = z.object({
  schema: z.literal("PARTICIPATE_SOURCE_CAPTURE_V2"), checkedAt: z.string().datetime(),
  proposal: sourceUpdateProposalSchema, source: sourceSchema,
  sourceStateReason: z.enum(["completed", "not_planned", "reopened", "duplicate"]).nullable(),
  evidence: sourceEvidenceSchema, evidenceScope: z.literal(SOURCE_EVIDENCE_SCOPE), observationHash: digestSchema
}).strict().superRefine((value, ctx) => {
  const { proposal, source } = value;
  if (proposal.id !== source.recordId || proposal.issueNumber !== source.issueNumber || proposal.proposalUrl !== source.url || proposal.title !== source.title || proposal.sourceUpdatedAt !== source.updatedAt || proposal.state !== source.state || canonicalJson(proposal.labels) !== canonicalJson(source.labels.map(label => label.name)) || proposal.outcome !== sourceObservationOutcome(source.state, proposal.labels))
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Source update identity or outcome mismatch" });
  if (Date.parse(proposal.submittedAt) > Date.parse(source.updatedAt) || Date.parse(source.updatedAt) > Date.parse(value.checkedAt))
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Source update timestamps mismatch" });
  try { validateSourceEvidence(value.evidence, source.issueNumber, value.checkedAt, proposal.submittedAt); }
  catch { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Source evidence identity or timestamp mismatch" }); }
});
export const sourceCaptureSchema = z.union([sourceCaptureV1Schema, sourceCaptureV2Schema]);
export type SourceCapture = z.infer<typeof sourceCaptureSchema>;

/** Preserve the exact body. A conservative intake only accepts officially pending applications. */
export async function buildSourceProposal(input: unknown, issueNumber: number, capturedAt: string, revision = 1, previousManifestHash: string | null = null) {
  const issue = issueSchema.parse(input);
  if (issue.number !== issueNumber || issue.html_url !== `${ZCG_REVIEW_SOURCE}/${issueNumber}` || new Date(issue.updated_at) > new Date(capturedAt) || new Date(issue.created_at) > new Date(issue.updated_at)) throw new Error("Source identity or timestamp mismatch");
  const category = issue.body.match(/^###\s+Proposal Category\s*\r?\n\s*\r?\n([^\r\n]+)/im)?.[1]?.trim() || null;
  // Never guess money from prose. Source Markdown retains the full submitted budget.
  const source = sourceSchema.parse({ recordId: `zcg-github-${issue.number}`, issueNumber: issue.number, url: issue.html_url, title: issue.title, state: issue.state,
    updatedAt: issue.updated_at, category, labels: issue.labels.map(label => ({ ...label, color: label.color.toLowerCase(), description: label.description ?? "" })) });
  const proposal = zcgReviewProposalSchema.parse({ id: source.recordId, issueNumber: issue.number, title: issue.title, applicant: issue.user.login, outcome: "under_review", state: issue.state,
    submittedAt: issue.created_at, sourceUpdatedAt: issue.updated_at, requestedUsd: null, tags: classifyZcgSectors(issue.title, category, []), labels: source.labels.map(label => label.name), proposalUrl: issue.html_url });
  const capture = sourceCaptureSchema.parse({ schema: "PARTICIPATE_SOURCE_CAPTURE_V1", checkedAt: capturedAt, proposal, source });
  const inputs = [{ path: "proposal.md", mediaType: "text/markdown" as const, text: issue.body }, { path: "source.json", mediaType: "application/json" as const, text: canonicalJson(capture) }];
  const files = await Promise.all(inputs.map(async file => ({ path: file.path, mediaType: file.mediaType, bytes: utf8(file.text).length, sha256: await sha256(utf8(file.text)) })));
  const manifest: ArchiveManifest = { schema: ARCHIVE_SCHEMA, recordId: proposal.id, revision, previousManifestHash, title: proposal.title, capturedAt, kind: "SOURCE_PROPOSAL", originalDecisionDate: null, submittedAt: proposal.submittedAt, scope: SOURCE_ARCHIVE_SCOPE, sources: [proposal.proposalUrl], files };
  const bundle = { schema: ARCHIVE_SCHEMA, manifest: canonicalJson(manifest), files: inputs.map(file => ({ path: file.path, encoding: "base64" as const, data: Buffer.from(file.text).toString("base64") })) };
  return verifySourceProposal(bundle, await sha256(utf8(bundle.manifest)));
}

/** Append an observed official update; previous files and committee-signed decisions remain untouched. */
export async function buildSourceUpdate(input: unknown, issueNumber: number, capturedAt: string,
  previous: { recordId: string; revision: number; manifestHash: string } | null, inputEvidence: SourceEvidence) {
  const issue = sourceIssueSchema.parse(input);
  z.string().datetime().parse(capturedAt);
  if (issue.number !== issueNumber || Date.parse(issue.updated_at) > Date.parse(capturedAt)) throw new Error("Source identity or timestamp mismatch");
  if (previous) {
    z.string().regex(/^zcg-[a-z0-9-]+$/).max(96).parse(previous.recordId);
    z.number().int().min(1).max(9999).parse(previous.revision); digestSchema.parse(previous.manifestHash);
  }
  const evidence = validateSourceEvidence(inputEvidence, issueNumber, capturedAt, issue.created_at);
  const recordId = previous?.recordId ?? `zcg-github-${issueNumber}`;
  const category = issue.body.match(/^###\s+Proposal Category\s*\r?\n\s*\r?\n([^\r\n]+)/im)?.[1]?.trim() || null;
  const source = sourceSchema.parse({ recordId, issueNumber, url: issue.html_url, title: issue.title, state: issue.state,
    updatedAt: issue.updated_at, category,
    labels: issue.labels.map(label => ({ ...label, color: label.color.toLowerCase(), description: label.description ?? "" })) });
  const proposal = sourceUpdateProposalSchema.parse({ id: recordId, issueNumber, title: issue.title, applicant: issue.user.login,
    outcome: sourceObservationOutcome(issue.state, source.labels.map(label => label.name)), state: issue.state,
    submittedAt: issue.created_at, sourceUpdatedAt: issue.updated_at, requestedUsd: null,
    tags: classifyZcgSectors(issue.title, category, []), labels: source.labels.map(label => label.name), proposalUrl: issue.html_url });
  const capture = sourceCaptureV2Schema.parse({ schema: "PARTICIPATE_SOURCE_CAPTURE_V2", checkedAt: capturedAt, proposal, source,
    sourceStateReason: issue.state_reason ?? null, evidence, evidenceScope: SOURCE_EVIDENCE_SCOPE,
    observationHash: await fingerprintSourceObservation(issue, evidence) });
  const inputs = [{ path: "proposal.md", mediaType: "text/markdown" as const, text: issue.body },
    { path: "source.json", mediaType: "application/json" as const, text: canonicalJson(capture) }];
  const files = await Promise.all(inputs.map(async file => ({ path: file.path, mediaType: file.mediaType, bytes: utf8(file.text).length, sha256: await sha256(utf8(file.text)) })));
  const manifest: ArchiveManifest = { schema: ARCHIVE_SCHEMA, recordId, revision: (previous?.revision ?? 0) + 1,
    previousManifestHash: previous?.manifestHash ?? null, title: proposal.title, capturedAt, kind: "SOURCE_PROPOSAL",
    originalDecisionDate: null, submittedAt: proposal.submittedAt, scope: SOURCE_ARCHIVE_SCOPE, sources: [proposal.proposalUrl], files };
  const bundle = { schema: ARCHIVE_SCHEMA, manifest: canonicalJson(manifest), files: inputs.map(file => ({ path: file.path, encoding: "base64" as const, data: Buffer.from(file.text).toString("base64") })) };
  return verifySourceProposal(bundle, await sha256(utf8(bundle.manifest)));
}

export async function verifySourceProposal(input: unknown, expectedHash: string) {
  const checked = await verifyArchivePackage(input, expectedHash);
  if (checked.manifest.kind !== "SOURCE_PROPOSAL") throw new Error("Not a complete source proposal");
  const source = checked.bundle.files.find(file => file.path === "source.json"), markdown = checked.bundle.files.find(file => file.path === "proposal.md");
  if (!source || !markdown || checked.bundle.files.length !== 2) throw new Error("Missing source capture files");
  const capture = sourceCaptureSchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decodeFile(source))));
  if (capture.proposal.id !== checked.manifest.recordId || capture.proposal.title !== checked.manifest.title || capture.proposal.submittedAt !== checked.manifest.submittedAt || capture.checkedAt !== checked.manifest.capturedAt || checked.manifest.sources.length !== 1 || checked.manifest.sources[0] !== capture.proposal.proposalUrl) throw new Error("Source does not match the preserved manifest");
  if (capture.schema === "PARTICIPATE_SOURCE_CAPTURE_V2") {
    const observationHash = await fingerprintSourceObservation({ number: capture.source.issueNumber, html_url: capture.source.url,
      title: capture.source.title, body: new TextDecoder("utf-8", { fatal: true }).decode(decodeFile(markdown)), state: capture.source.state,
      state_reason: capture.sourceStateReason, created_at: capture.proposal.submittedAt, updated_at: capture.source.updatedAt,
      user: { login: capture.proposal.applicant }, labels: capture.source.labels }, capture.evidence);
    if (observationHash !== capture.observationHash) throw new Error("Source observation does not match its fingerprint");
  }
  return { ...checked, capture };
}
