// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GitHubComments } from "./github-comments";
vi.mock("./proposal-markdown", () => ({ ProposalMarkdown: ({ children }: { children: React.ReactNode }) => <p>{children}</p> }));
const snapshot = { issueNumber: 454, checkedAt: "2026-10-13T05:00:00Z", stale: false, comments: [
  { id: 1, author: "alexgbo", bot: false, url: "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/454#issuecomment-1", body: "The proposal was approved.", createdAt: "2026-10-12T15:12:54Z", updatedAt: "2026-10-12T15:12:54Z" },
] };
beforeEach(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it("loads all authors in the source panel and clearly separates live data from the revision", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => snapshot }));
  await act(async () => { render(<GitHubComments issueNumber={454} visible />); });
  expect(screen.getByText("@alexgbo")).toBeTruthy();
  expect(screen.getByText("1 comment")).toBeTruthy();
  expect(screen.getByText(/Separate from this preserved revision/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Original comment ↗" }).getAttribute("href")).toBe(snapshot.comments[0].url);
});
it("does not invent a zero count on failure or fetch a closed panel", async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error("offline")); vi.stubGlobal("fetch", fetcher);
  const { rerender } = render(<GitHubComments issueNumber={454} visible={false} />);
  expect(fetcher).not.toHaveBeenCalled();
  await act(async () => { rerender(<GitHubComments issueNumber={454} visible />); });
  expect(screen.getByText(/GitHub is temporarily unavailable/)).toBeTruthy();
  expect(screen.queryByText("0 comments")).toBeNull();
});
it("refreshes every five minutes and retains comments if the next read fails", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => snapshot }).mockRejectedValue(new Error("offline")); vi.stubGlobal("fetch", fetcher);
  await act(async () => { render(<GitHubComments issueNumber={454} visible />); });
  await act(async () => { await vi.advanceTimersByTimeAsync(300_000); });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(screen.getByText("@alexgbo")).toBeTruthy();
  expect(screen.getByText(/Showing the last available comments/)).toBeTruthy();
});
