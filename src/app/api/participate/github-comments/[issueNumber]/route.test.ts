import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ known: vi.fn(), comments: vi.fn() }));
vi.mock("@/lib/participate/official-proposals", () => ({ readOfficialProposals: mocks.known }));
vi.mock("@/lib/participate/github-comments", () => ({ readGitHubComments: mocks.comments }));
import { GET } from "./route";
const get = (issueNumber: string) => GET(new Request("https://openzcash.org/api/participate/github-comments/454"), { params: Promise.resolve({ issueNumber }) });
beforeEach(() => vi.resetAllMocks());
it("reads only an official published issue without requiring a user session", async () => {
  mocks.known.mockResolvedValue({ proposals: [{ issueNumber: 454 }] });
  const snapshot = { issueNumber: 454, comments: [], stale: false, checkedAt: "2026-10-13T05:00:00Z" };
  mocks.comments.mockResolvedValue(snapshot);
  const response = await get("454");
  expect(response.status).toBe(200); expect(await response.json()).toEqual(snapshot);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(mocks.comments).toHaveBeenCalledWith(454);
});
it("rejects invalid and unknown issues before reaching GitHub", async () => {
  expect((await get("../454")).status).toBe(400);
  mocks.known.mockResolvedValue({ proposals: [] });
  expect((await get("999")).status).toBe(404);
  expect(mocks.comments).not.toHaveBeenCalled();
});
it("reports outages with a safe error instead of an empty comment count", async () => {
  mocks.known.mockRejectedValue(new Error("private source details"));
  const response = await get("99902");
  expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: "GITHUB_COMMENTS_UNAVAILABLE" });
});
