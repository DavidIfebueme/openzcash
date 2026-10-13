import { z } from "zod/v3";
import { MAX_PROPOSAL_TAGS, PROPOSAL_TAGS, type ProposalTagId } from "@/lib/participate/workspace/domain/proposal-tags";
import { ZCG_REVIEW_SOURCE } from "@/lib/participate/workspace/domain/zcg-review";

export const zcgSourceMetadataSchema = z.object({
  source: z.literal("https://github.com/ZcashCommunityGrants/zcashcommunitygrants"),
  checkedAt: z.string().datetime(),
  proposals: z.array(z.object({
    recordId: z.string().regex(/^zcg-[a-z0-9-]+$/), issueNumber: z.number().int().positive(),
    url: z.string().url(), title: z.string().min(1).max(300), state: z.enum(["open", "closed"]),
    updatedAt: z.string().datetime(), category: z.string().min(1).max(200).nullable(),
    labels: z.array(z.object({ name: z.string().min(1).max(100), color: z.string().regex(/^[a-f0-9]{6}$/), description: z.string().max(1000) }).strict()).max(100)
  }).strict().superRefine((entry, ctx) => {
    if (entry.url !== `${ZCG_REVIEW_SOURCE}/${entry.issueNumber}` || (entry.recordId.startsWith("zcg-github-") && entry.recordId !== `zcg-github-${entry.issueNumber}`)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "GitHub source identity mismatch" });
    }
    if (new Set(entry.labels.map(label => label.name)).size !== entry.labels.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate GitHub label" });
  }))
}).strict().superRefine((value, ctx) => {
  if (new Set(value.proposals.map(entry => entry.recordId)).size !== value.proposals.length || new Set(value.proposals.map(entry => entry.issueNumber)).size !== value.proposals.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate GitHub proposal mapping" });
  }
});
export type ZcgSourceMetadata = z.infer<typeof zcgSourceMetadataSchema>["proposals"][number];

/** Read the applicant's category from either official template heading, never from another section. */
export function readZcgSourceCategory(markdown: string | null | undefined): string | null {
  if (!markdown) return null;
  const lines = markdown.split(/\r?\n/);
  let fence: { character: string; length: number } | null = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (marker) {
      if (!fence) fence = { character: marker[1][0], length: marker[1].length };
      else if (marker[1][0] === fence.character && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      continue;
    }
    if (fence || !/^ {0,3}###[ \t]+(?:Proposal[ \t]+)?Category[ \t]*$/i.test(line)) continue;
    let valueIndex = index + 1;
    while (valueIndex < lines.length && !lines[valueIndex].trim()) valueIndex++;
    const value = lines[valueIndex]?.trim();
    if (!value || value.length > 200 || /^(?:#{1,6}(?:\s|$)|`{3,}|~{3,})/.test(value) || /^_?No response_?$/i.test(value)) return null;
    return value;
  }
  return null;
}

const categories = new Map<string, ProposalTagId>([
  ...PROPOSAL_TAGS.map(tag => [tag.label.toLowerCase(), tag.id] as [string, ProposalTagId]),
  ["non-wallet applications", "applications"], ["non wallet applications", "applications"], ["research and development", "research"]
]);
export function sourceCategoryTag(category: string | null | undefined): ProposalTagId | undefined {
  return category ? categories.get(category.trim().toLowerCase()) : undefined;
}

/** Applicant category first; curated topics next, with conservative title-based enrichment. */
export function classifyZcgSectors(title: string, category: string | null | undefined, curated: readonly string[]): ProposalTagId[] {
  const signals: [ProposalTagId, RegExp][] = [
    ["events", /\b(devcon|conference|meetup|event|travel support)\b/i],
    ["wallets", /\b(wallets?|seedsigner|signer)\b/i],
    ["education", /\b(education|course|documentation|workshops?)\b/i],
    ["security", /\b(security|audit|privacy checkup)\b/i],
    ["research", /\b(research|formal verification|recomputation)\b/i]
  ];
  const known = new Set(PROPOSAL_TAGS.map(tag => tag.id as string));
  return [...new Set([sourceCategoryTag(category), ...curated, ...signals.filter(([, rule]) => rule.test(title)).map(([id]) => id)])]
    .filter((id): id is ProposalTagId => Boolean(id && known.has(id))).slice(0, MAX_PROPOSAL_TAGS);
}

/** Terminal source labels take precedence over a leftover Ready For ZCG Review label. */
export function githubProposalOutcome(source: ZcgSourceMetadata): "under_review" | "approved" | "rejected" | "abandoned" | "closed" {
  const labels = source.labels.map(label => label.name).join("\n");
  if (/withdrawn|cancelled|canceled/i.test(labels)) return "abandoned";
  if (/grant declined|grant rejected|does not meet criteria|vetoed|did not follow process/i.test(labels)) return "rejected";
  if (/grant approved|grant complete|startup payment completed|milestone \d+ complete/i.test(labels)) return "approved";
  return source.state === "closed" ? "closed" : "under_review";
}

/** Pick one official current-state label; keep workflow history available separately. */
export function zcgCurrentStatusLabel(source: ZcgSourceMetadata | null | undefined, outcome: ReturnType<typeof githubProposalOutcome>) {
  const matchers = {
    approved: [/grant approved/i, /grant complete/i],
    rejected: [/grant declined|grant rejected/i, /does not meet criteria|vetoed|did not follow process/i],
    abandoned: [/withdrawn|cancelled|canceled/i],
    under_review: [/ready for zcg review/i],
    closed: []
  }[outcome];
  for (const matcher of matchers) {
    const label = source?.labels.find(label => matcher.test(label.name));
    if (label) return label;
  }
  return null;
}
