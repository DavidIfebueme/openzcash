import { z } from "zod";

const date = z.iso.date();
const normalized = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
const scopedGrantKey = (projectId: string, program: string, title: string) =>
  JSON.stringify([normalized(projectId), normalized(program), normalized(title)]);
const publicUrl = z.url().refine(value => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}, "Requested-amount evidence must use an HTTPS URL without credentials");

/** Applicant requests and ceilings; never approval, a budget or a payment. */
export const requestedAmountEntrySchema = z.object({
  id: z.string().trim().min(1).max(100),
  projectId: z.string().trim().min(1).max(160),
  program: z.enum(["zcg", "coinholder"]),
  grantTitle: z.string().trim().min(1).max(400),
  amountUsdCents: z.string().regex(/^[1-9]\d*$/, "Use a positive integer number of USD cents"),
  basis: z.enum(["fixed", "cap"]),
  summary: z.string().trim().min(1).max(1200),
  sourceUrl: publicUrl,
  reviewedAt: date,
  reviewNote: z.string().trim().min(20).max(1200),
}).strict();

export const requestedAmountsSchema = z.object({
  schemaVersion: z.literal(1),
  entries: z.array(requestedAmountEntrySchema).superRefine((entries, context) => {
    const ids = new Set<string>();
    const keys = new Set<string>();
    entries.forEach((entry, index) => {
      if (ids.has(entry.id)) context.addIssue({ code: "custom", path: [index, "id"], message: "Requested-amount IDs must be unique" });
      ids.add(entry.id);
      const key = scopedGrantKey(entry.projectId, entry.program, entry.grantTitle);
      if (keys.has(key)) context.addIssue({ code: "custom", path: [index, "grantTitle"], message: "A project/program/grant title must have one reviewed requested amount" });
      keys.add(key);
    });
  }),
}).strict();

export type ReviewedRequestedAmount = z.infer<typeof requestedAmountEntrySchema>;

/** Only an exact scoped request is eligible; search similarity cannot assign money. */
export function findReviewedRequestedAmount(
  grant: { projectId: string; program: "zcg" | "coinholder"; title: string },
  asOfDay: string,
  entries: readonly ReviewedRequestedAmount[],
): ReviewedRequestedAmount | null {
  date.parse(asOfDay);
  const key = scopedGrantKey(grant.projectId, grant.program, grant.title);
  const matches = entries.filter(entry => entry.reviewedAt <= asOfDay &&
    scopedGrantKey(entry.projectId, entry.program, entry.grantTitle) === key);
  // The schema rejects duplicate keys; fail closed if an unchecked caller bypasses it.
  return matches.length === 1 ? matches[0] : null;
}
