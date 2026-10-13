import { z } from "zod/v3";

export const ZCG_GITHUB_ISSUES = "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues";
export const githubCommentSchema = z.object({
  id: z.number().int().positive().safe(), url: z.string().url(),
  author: z.string().min(1).max(100), bot: z.boolean(), body: z.string().max(500_000),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
}).strict();
export const githubCommentsSnapshotSchema = z.object({
  issueNumber: z.number().int().positive().safe(), checkedAt: z.string().datetime(),
  stale: z.boolean(), comments: z.array(githubCommentSchema).max(1000),
}).strict().superRefine((value, context) => {
  if (new Set(value.comments.map(comment => comment.id)).size !== value.comments.length || value.comments.some(comment =>
    comment.url !== `${ZCG_GITHUB_ISSUES}/${value.issueNumber}#issuecomment-${comment.id}` ||
    Date.parse(comment.updatedAt) < Date.parse(comment.createdAt))) {
    context.addIssue({ code: "custom", message: "Invalid GitHub comment identity" });
  }
});
export type GitHubCommentsSnapshot = z.infer<typeof githubCommentsSnapshotSchema>;

/** Every public author is included. Repository association does not establish a committee role. */
export function parseGitHubCommentPage(issueNumber: number, input: unknown) {
  const rows = z.array(z.object({ id: z.number().int().positive().safe(), html_url: z.string(),
    body: z.string().max(500_000), created_at: z.string().datetime(), updated_at: z.string().datetime(),
    user: z.object({ login: z.string().min(1).max(100), type: z.string() }).nullable(),
  })).max(100).parse(input);
  const comments = rows.map(row => ({ id: row.id, url: row.html_url, body: row.body,
    createdAt: row.created_at, updatedAt: row.updated_at, author: row.user?.login ?? "deleted-user", bot: row.user?.type === "Bot" }));
  return githubCommentsSnapshotSchema.parse({ issueNumber, checkedAt: new Date().toISOString(), stale: false, comments }).comments;
}
