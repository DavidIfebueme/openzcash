import "server-only";
import { ghHeaders } from "@/lib/zcg/github-headers";
import { githubCommentsSnapshotSchema, parseGitHubCommentPage, type GitHubCommentsSnapshot } from "./github-comments-model";

const TTL = 5 * 60_000;
type Entry = { snapshot?: GitHubCommentsSnapshot; retryAt?: number; pending?: Promise<GitHubCommentsSnapshot> };
const globalStore = globalThis as typeof globalThis & { __participateGitHubComments?: Map<number, Entry> };
const entries = globalStore.__participateGitHubComments ??= new Map<number, Entry>();

/** Fixed public repository, bounded complete pagination, shared requests and explicit stale fallback. */
export async function readGitHubComments(issueNumber: number, fetcher: typeof fetch = fetch): Promise<GitHubCommentsSnapshot> {
  if (!Number.isSafeInteger(issueNumber) || issueNumber < 1) throw new Error("INVALID_ISSUE");
  const entry = entries.get(issueNumber) ?? {};
  const previous = entry.snapshot;
  if (previous && Date.now() - Date.parse(previous.checkedAt) < TTL) return { ...previous, stale: false };
  if (entry.pending) return entry.pending;
  if (entry.retryAt && Date.now() < entry.retryAt) {
    if (previous) return { ...previous, stale: true };
    throw new Error("GITHUB_COMMENTS_UNAVAILABLE");
  }
  if (!entries.has(issueNumber) && entries.size >= 300) {
    const oldest = [...entries].find(([, value]) => !value.pending);
    if (oldest) entries.delete(oldest[0]);
    else throw new Error("GITHUB_COMMENTS_BUSY");
  }
  entries.set(issueNumber, entry);
  entry.pending = (async () => {
    try {
      const comments = new Map<number, GitHubCommentsSnapshot["comments"][number]>();
      let bytes = 0;
      const signal = AbortSignal.timeout(20_000);
      for (let page = 1; page <= 10; page++) {
        const response = await fetcher(`https://api.github.com/repos/ZcashCommunityGrants/zcashcommunitygrants/issues/${issueNumber}/comments?per_page=100&page=${page}`,
          { headers: { ...ghHeaders(), "X-GitHub-Api-Version": "2022-11-28" }, cache: "no-store", redirect: "error", signal });
        if (!response.ok) throw new Error(`GITHUB_HTTP_${response.status}`);
        const reader = response.body?.getReader();
        if (!reader) throw new Error("GITHUB_EMPTY_RESPONSE");
        const chunks: Uint8Array[] = [];
        try {
          for (;;) {
            const chunk = await reader.read(); if (chunk.done) break;
            bytes += chunk.value.byteLength;
            if (bytes > 8 * 1024 * 1024) throw new Error("GITHUB_RESPONSE_LIMIT");
            chunks.push(chunk.value);
          }
        } finally { void reader.cancel().catch(() => undefined); }
        const rows = parseGitHubCommentPage(issueNumber, JSON.parse(Buffer.concat(chunks).toString("utf8")));
        for (const row of rows) {
          const before = comments.get(row.id);
          if (before && JSON.stringify(before) !== JSON.stringify(row)) throw new Error("GITHUB_COMMENTS_CHANGED_DURING_READ");
          comments.set(row.id, row);
        }
        if (rows.length < 100) {
          const snapshot = githubCommentsSnapshotSchema.parse({ issueNumber, checkedAt: new Date().toISOString(), stale: false,
            comments: [...comments.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id) });
          entry.snapshot = snapshot; entry.retryAt = undefined;
          return snapshot;
        }
      }
      throw new Error("GITHUB_PAGINATION_LIMIT");
    } catch {
      entry.retryAt = Date.now() + 60_000;
      console.error(`[participate] GitHub comments unavailable for issue ${issueNumber}; cached=${Boolean(previous)}`);
      if (previous) return { ...previous, stale: true };
      throw new Error("GITHUB_COMMENTS_UNAVAILABLE");
    } finally { entry.pending = undefined; }
  })();
  return entry.pending;
}
