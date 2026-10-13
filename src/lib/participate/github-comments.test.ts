import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/zcg/github-headers", () => ({ ghHeaders: () => ({ accept: "application/vnd.github+json" }) }));
import { parseGitHubCommentPage } from "./github-comments-model";
import { readGitHubComments } from "./github-comments";

const row = (issue: number, id: number, association = "NONE") => ({ id, html_url: `https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/${issue}#issuecomment-${id}`,
  author_association: association, user: { login: `author-${id}`, type: "User" }, body: "Public source comment 🛡️", created_at: "2026-10-12T10:00:00Z", updated_at: "2026-10-12T10:00:00Z" });
afterEach(() => vi.useRealTimers());

describe("complete public GitHub discussion", () => {
  it("includes contributors, unaffiliated authors, repository members and bots", () => {
    const source = [row(454, 1, "NONE"), row(454, 2, "CONTRIBUTOR"), row(454, 3, "MEMBER"), { ...row(454, 4), user: { login: "github-actions[bot]", type: "Bot" } }];
    const comments = parseGitHubCommentPage(454, source);
    expect(comments).toHaveLength(4);
    expect(comments[3].bot).toBe(true);
    expect(comments.map(comment => comment.body)).toEqual(source.map(comment => comment.body));
  });
  it("retains a comment whose author account has been deleted", () => {
    expect(parseGitHubCommentPage(454, [{ ...row(454, 1), user: null }])[0].author).toBe("deleted-user");
  });
  it("rejects a wrong repository, issue, duplicate id or edited-before-created timestamp", () => {
    expect(() => parseGitHubCommentPage(454, [row(455, 1)])).toThrow();
    expect(() => parseGitHubCommentPage(454, [{ ...row(454, 1), html_url: "https://evil.invalid/#issuecomment-1" }])).toThrow();
    expect(() => parseGitHubCommentPage(454, [row(454, 1), row(454, 1)])).toThrow();
    expect(() => parseGitHubCommentPage(454, [{ ...row(454, 1), updated_at: "2026-10-11T00:00:00Z" }])).toThrow();
  });
  it("loads every page, coalesces simultaneous reads and caches for five minutes", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(Array.from({ length: 100 }, (_, i) => row(99101, i + 1))))
      .mockResolvedValueOnce(Response.json([row(99101, 101)]));
    const [first, second] = await Promise.all([readGitHubComments(99101, fetcher), readGitHubComments(99101, fetcher)]);
    expect(first.comments).toHaveLength(101); expect(first).toEqual(second);
    await readGitHubComments(99101, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toContain("page=2");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "error", cache: "no-store" });
  });
  it("never presents an upstream failure or incomplete scan as zero comments", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(Array.from({ length: 100 }, (_, i) => row(99102, i + 1))))
      .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }));
    await expect(readGitHubComments(99102, fetcher)).rejects.toThrow("GITHUB_COMMENTS_UNAVAILABLE");
    await expect(readGitHubComments(99102, fetcher)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("keeps last-good data explicitly stale during an outage and recovers later", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-13T10:00:00Z"));
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json([row(99103, 1)]))
      .mockResolvedValueOnce(new Response("rate limit", { status: 429 }))
      .mockResolvedValueOnce(Response.json([row(99103, 1), row(99103, 2)]));
    const first = await readGitHubComments(99103, fetcher);
    vi.setSystemTime(new Date("2026-10-13T10:05:01Z"));
    expect(await readGitHubComments(99103, fetcher)).toEqual({ ...first, stale: true });
    vi.setSystemTime(new Date("2026-10-13T10:06:02Z"));
    expect((await readGitHubComments(99103, fetcher)).comments).toHaveLength(2);
  });
  it("rejects a response larger than its bounded budget", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(" ".repeat(8 * 1024 * 1024 + 1)));
    await expect(readGitHubComments(99104, fetcher)).rejects.toThrow("GITHUB_COMMENTS_UNAVAILABLE");
  });
});
