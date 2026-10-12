import { z } from "zod/v3";
import { canonicalJson, sha256, utf8 } from "./format";
import { ZCG_REVIEW_SOURCE } from "@/lib/participate/workspace/domain/zcg-review";

export const ZCG_ISSUES_API = "https://api.github.com/repos/ZcashCommunityGrants/zcashcommunitygrants/issues";
const identifier = z.number().int().positive().safe();
const timestamp = z.string().datetime();
const actorSchema = z.object({ id: identifier, login: z.string().min(1).max(100) }).strict();
const labelSchema = z.object({ name: z.string().min(1).max(100), color: z.string().regex(/^[a-fA-F0-9]{6}$/), description: z.string().max(1000).nullable() });

export const sourceIssueSchema = z.object({
  number: identifier, html_url: z.string().url(), title: z.string().min(1).max(300),
  body: z.string().min(1).max(500_000), state: z.enum(["open", "closed"]),
  state_reason: z.enum(["completed", "not_planned", "reopened", "duplicate"]).nullable().optional(),
  created_at: timestamp, updated_at: timestamp, user: z.object({ login: z.string().min(1).max(100) }),
  labels: z.array(labelSchema).max(100), pull_request: z.never().optional()
}).superRefine((issue, ctx) => {
  if (issue.html_url !== `${ZCG_REVIEW_SOURCE}/${issue.number}` || Date.parse(issue.created_at) > Date.parse(issue.updated_at))
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Source issue identity or timestamp mismatch" });
  if (new Set(issue.labels.map(label => label.name)).size !== issue.labels.length)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate source label" });
});

export const sourceStatusEventSchema = z.object({
  id: identifier, event: z.enum(["labeled", "unlabeled", "closed", "reopened"]), url: z.string().url(),
  createdAt: timestamp, actor: actorSchema.nullable(),
  label: z.object({ name: z.string().min(1).max(100), color: z.string().regex(/^[a-f0-9]{6}$/) }).strict().nullable()
}).strict().superRefine((event, ctx) => {
  if (event.url !== `${ZCG_ISSUES_API}/events/${event.id}` || (["labeled", "unlabeled"].includes(event.event) !== Boolean(event.label)))
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Source event identity mismatch" });
});
export const sourceCommentSchema = z.object({
  id: identifier, url: z.string().url(), createdAt: timestamp, updatedAt: timestamp,
  author: actorSchema, association: z.enum(["OWNER", "MEMBER", "COLLABORATOR"]),
  body: z.string().max(500_000)
}).strict().superRefine((comment, ctx) => {
  if (Date.parse(comment.createdAt) > Date.parse(comment.updatedAt))
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid source comment timestamps" });
});
export const sourceEvidenceSchema = z.object({
  events: z.array(sourceStatusEventSchema).max(1000), comments: z.array(sourceCommentSchema).max(1000)
}).strict().superRefine((evidence, ctx) => {
  if (new Set(evidence.events.map(event => event.id)).size !== evidence.events.length || new Set(evidence.comments.map(comment => comment.id)).size !== evidence.comments.length)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate source evidence" });
});
export type SourceEvidence = z.infer<typeof sourceEvidenceSchema>;
export type SourceStatusEvent = z.infer<typeof sourceStatusEventSchema>;
export type SourceComment = z.infer<typeof sourceCommentSchema>;

/** Repository association is provenance, never a committee membership or signature claim. */
export function validateSourceEvidence(input: unknown, issueNumber: number, capturedAt?: string, submittedAt?: string) {
  identifier.parse(issueNumber);
  const evidence = sourceEvidenceSchema.parse(input);
  const cutoff = capturedAt === undefined ? Infinity : Date.parse(timestamp.parse(capturedAt));
  const earliest = submittedAt === undefined ? -Infinity : Date.parse(timestamp.parse(submittedAt));
  for (const event of evidence.events) if (Date.parse(event.createdAt) > cutoff || Date.parse(event.createdAt) < earliest) throw new Error("Source event timestamp is outside the issue history");
  for (const comment of evidence.comments) {
    if (comment.url !== `${ZCG_REVIEW_SOURCE}/${issueNumber}#issuecomment-${comment.id}` || Date.parse(comment.updatedAt) > cutoff || Date.parse(comment.createdAt) < earliest)
      throw new Error("Source comment identity or timestamp mismatch");
  }
  return {
    events: [...evidence.events].sort((a, b) => a.id - b.id),
    comments: [...evidence.comments].sort((a, b) => a.id - b.id)
  };
}

/** Strip unrelated events/public replies; retain exact associated comment bytes. */
export function parseZcgSourceEvidence(issueNumber: number, rawEvents: unknown[], rawComments: unknown[]): SourceEvidence {
  const relevant = new Set(["labeled", "unlabeled", "closed", "reopened"]);
  const associations = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
  const events = rawEvents.flatMap(value => {
    const candidate = z.object({ event: z.string() }).passthrough().parse(value);
    if (!relevant.has(candidate.event)) return [];
    const raw = z.object({ id: identifier, event: z.enum(["labeled", "unlabeled", "closed", "reopened"]), url: z.string().url(),
      created_at: timestamp, actor: z.object({ id: identifier, login: z.string().min(1).max(100) }).nullable(),
      label: z.object({ name: z.string().min(1).max(100), color: z.string().regex(/^[a-fA-F0-9]{6}$/) }).optional()
    }).parse(value);
    return [{ id: raw.id, event: raw.event, url: raw.url, createdAt: raw.created_at, actor: raw.actor,
      label: raw.label ? { ...raw.label, color: raw.label.color.toLowerCase() } : null }];
  });
  const comments = rawComments.flatMap(value => {
    const candidate = z.object({ author_association: z.string() }).passthrough().parse(value);
    if (!associations.has(candidate.author_association)) return [];
    const raw = z.object({ id: identifier, html_url: z.string().url(), url: z.string().url(),
      created_at: timestamp, updated_at: timestamp, user: z.object({ id: identifier, login: z.string().min(1).max(100) }),
      author_association: z.enum(["OWNER", "MEMBER", "COLLABORATOR"]), body: z.string().max(500_000)
    }).parse(value);
    if (raw.url !== `${ZCG_ISSUES_API}/comments/${raw.id}`) throw new Error("Source comment API identity mismatch");
    return [{ id: raw.id, url: raw.html_url, createdAt: raw.created_at, updatedAt: raw.updated_at,
      author: raw.user, association: raw.author_association, body: raw.body }];
  });
  return validateSourceEvidence({ events, comments }, issueNumber);
}

export const sourceOutcomeSchema = z.enum(["under_review", "approved", "rejected", "abandoned", "closed"]);
export type SourceOutcome = z.infer<typeof sourceOutcomeSchema>;

/** Only explicit official workflow labels establish a source decision; closure alone does not. */
export function sourceObservationOutcome(state: "open" | "closed", labels: readonly string[]): SourceOutcome {
  const names = new Set(labels);
  const approved = names.has("✅ Grant Approved") || names.has("✔️ Grant Complete");
  const rejected = names.has("❌ Grant Declined") || names.has("❌ Grant Rejected");
  const abandoned = names.has("Grant Withdrawn by Submitter") || names.has("❌ Grant Cancelled Before Completion");
  if (approved && rejected) return "closed"; // Contradictory labels cannot establish a verdict.
  if (abandoned) return "abandoned";
  if (rejected) return "rejected";
  if (approved) return "approved";
  return state === "closed" ? "closed" : "under_review";
}

/** Compare only meaningful source observations; capture time and public noise cannot spend funds. */
export async function fingerprintSourceObservation(input: unknown, inputEvidence: SourceEvidence) {
  const issue = sourceIssueSchema.parse(input);
  const evidence = validateSourceEvidence(inputEvidence, issue.number, undefined, issue.created_at);
  const observation = { issueNumber: issue.number, url: issue.html_url, state: issue.state,
    stateReason: issue.state_reason ?? null,
    labels: issue.labels.map(label => ({ name: label.name, color: label.color.toLowerCase(), description: label.description ?? "" }))
      .sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    ...evidence };
  return sha256(utf8(canonicalJson(observation)));
}
