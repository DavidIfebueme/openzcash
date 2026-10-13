import { z } from "zod/v3";
import { PROPOSAL_TAGS, MAX_PROPOSAL_TAGS } from "@/lib/participate/workspace/domain/proposal-tags";
import { parseProposalUsdCents } from "@/lib/participate/workspace/domain/proposal-funding";

export const SUBMISSION_PRICE = { version: 1, credits: 20, usdCents: 500, creditUsdCents: 25 } as const;
function isZcashForumTopic(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "forum.zcashcommunity.com" && !url.port &&
      !url.username && !url.password && /^\/t\/(?:[^/]+\/)?[1-9]\d*(?:\/[1-9]\d*)?\/?$/.test(url.pathname);
  } catch { return false; }
}
const publicLink = z.string().max(2048).refine(value => {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}, "Use a public HTTPS link.");
export const submissionDraftSchema = z.object({
  title: z.string().trim().max(200),
  applicant: z.string().trim().max(120),
  body: z.string().max(40000).refine(value => !value.includes("\0")),
  requestedAmountUsd: z.string().trim().max(20).refine(value => {
    if (!value) return true;
    try { parseProposalUsdCents(value); return true; } catch { return false; }
  }, "Enter a positive USD amount with up to two decimal places."),
  tags: z.array(z.string().refine(value => PROPOSAL_TAGS.some(tag => tag.id === value))).max(MAX_PROPOSAL_TAGS).refine(value => new Set(value).size === value.length),
  githubUrl: publicLink,
  forumUrl: publicLink
}).strict();
export const submissionPublishableSchema = submissionDraftSchema.superRefine((value, context) => {
  if (value.title.length < 12) context.addIssue({ code: z.ZodIssueCode.custom, path: ["title"], message: "Use a title of at least 12 characters." });
  if (value.applicant.length < 2) context.addIssue({ code: z.ZodIssueCode.custom, path: ["applicant"], message: "Add your public name or team." });
  if (value.body.trim().length < 80) context.addIssue({ code: z.ZodIssueCode.custom, path: ["body"], message: "Describe your proposal in at least 80 characters." });
  if (!value.requestedAmountUsd) context.addIssue({ code: z.ZodIssueCode.custom, path: ["requestedAmountUsd"], message: "Add the requested budget in USD." });
  if (!value.forumUrl.trim()) context.addIssue({ code: z.ZodIssueCode.custom, path: ["forumUrl"], message: "Add your forum discussion before submitting. You can save a draft without it." });
  else if (!isZcashForumTopic(value.forumUrl)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["forumUrl"], message: "Use a topic link from forum.zcashcommunity.com, starting with https://forum.zcashcommunity.com/t/." });
});
export const saveSubmissionSchema = z.object({
  id: z.string().uuid(), expectedVersion: z.number().int().min(0).max(2147483646), payload: submissionDraftSchema
}).strict();
export const publishSubmissionSchema = z.object({
  id: z.string().uuid(), expectedVersion: z.number().int().positive(), contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  priceVersion: z.number().int().positive(), requestKey: z.string().uuid(), consent: z.literal(true)
}).strict();
export const deleteSubmissionSchema = z.object({
  id: z.string().uuid(), expectedVersion: z.number().int().positive(), consent: z.literal(true)
}).strict();
export const abandonmentReasonSchema = z.string().trim().min(10).max(1000).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value), "Use a public explanation.");
export const abandonSubmissionSchema = z.object({
  id: z.string().uuid(), contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  reason: abandonmentReasonSchema, requestKey: z.string().uuid(), consent: z.literal(true)
}).strict();
export type ProposalAbandonment = { eventId: string; eventHash: string; reason: string; occurredAt: string };
export type SubmissionPayload = z.infer<typeof submissionDraftSchema>;
export type SubmissionDraft = {
  id: string; payload: SubmissionPayload; version: number; contentHash: string; state: "DRAFT" | "PUBLISHED" | "PUBLISHED_DEMO" | "ABANDONED";
  recordId: string | null; updatedAt: string;
  abandonment?: ProposalAbandonment | null;
};
export const EMPTY_SUBMISSION: SubmissionPayload = { title: "", applicant: "", body: "", requestedAmountUsd: "", tags: [], githubUrl: "", forumUrl: "" };

export const PARTICIPATE_TEMPLATE = `## Summary

[What will you deliver, and why does it matter to Zcash?]

## Applicant and team

[Public names, roles, relevant experience and links to previous work.]

## Problem and proposed solution

[Who benefits? Explain the scope, approach and dependencies.]

## Budget

| Cost | Amount (USD) | Basis |
| --- | ---: | --- |
| [Item] | [0.00] | [Hours, rate or deliverable] |
| Total | [0.00] | Must match the requested amount |

If funded, payments are denominated in USD and settled in ZEC at the payment-day rate.

## Milestones

| Milestone | Target date | Amount (USD) | Deliverable and acceptance evidence |
| --- | --- | ---: | --- |
| [Milestone] | [YYYY-MM-DD] | [0.00] | [Measurable output and how to verify it] |

## Success measures

[Measurable targets, evidence and where progress updates will be published.]

## Risks and disclosures

- Delivery risks and mitigation: [Details]
- Prior or other funding: [Details or None]
- Conflicts of interest: [Details or None]
- Duplicate funding prevention: [Details]

## Supporting links

[Public repository, documentation or supporting evidence.]
`;
