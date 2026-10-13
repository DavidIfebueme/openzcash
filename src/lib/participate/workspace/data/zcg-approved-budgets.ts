import { z } from "zod/v3";
import { zcgSourceMetadata } from "./zcg-source-metadata";

const sheetUrl = z.string().url().refine(value => {
  const url = new URL(value);
  return url.protocol === "https:" && url.hostname === "docs.google.com" &&
    url.pathname.startsWith("/spreadsheets/d/") && !url.username && !url.password;
});
const budgetSchema = z.object({
  usdCents: z.string().regex(/^[1-9]\d{0,15}$/),
  sourceUrl: sheetUrl,
  proposalSourceUrl: sheetUrl,
  sourceRows: z.array(z.number().int().positive()).min(1),
}).strict();
export const approvedBudgetSnapshotSchema = z.object({
  version: z.literal(1),
  budgets: z.record(z.string().regex(/^[1-9]\d*$/), budgetSchema),
  importedAt: z.string().datetime(),
}).strict();

/** Current official financial annotations, kept outside immutable proposal files. */
export type ZcgApprovedBudget = z.infer<typeof budgetSchema>;
export type ApprovedBudgetSnapshot = z.infer<typeof approvedBudgetSnapshotSchema>;
export type ApprovedBudgetMap = ApprovedBudgetSnapshot["budgets"];
export type ApprovedBudgetStatus = "loading" | "ready" | "unavailable";

/** Require an official source identity; a demo title or record ID cannot claim a grant. */
export function zcgApprovedBudget(budgets: ApprovedBudgetMap, recordId: string,
  source?: { issueNumber: number; url: string } | null): ZcgApprovedBudget | null {
  const identity = source ?? zcgSourceMetadata(recordId);
  if (!identity || !Number.isSafeInteger(identity.issueNumber) || identity.issueNumber <= 0) return null;
  const expected = `https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/${identity.issueNumber}`;
  if (identity.url !== expected) return null;
  const key = String(identity.issueNumber);
  return Object.hasOwn(budgets, key) ? budgets[key] : null;
}
