// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DiscussionNotifications } from "@/components/participate/workspace/discussion-notifications";
import { OPEN_COMMENT_EVENT, type DiscussionInbox } from "@/lib/participate/workspace/domain/discussion-notifications";
const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/components/participate/workspace/workspace-account", () => ({ AccountAvatar: () => <span aria-hidden="true" /> }));
const inbox: DiscussionInbox = { unreadCount: 2, nextCursor: null, asOf: "2026-10-10T20:00:00.000Z", items: [
  { id: "n1", kind: "COMMENT_LIKED", actorLabel: "Alice", actorAvatarUrl: null, proposalTitle: "A public proposal", excerpt: "My original comment", recordId: "record-a", commentId: "comment-a", read: false, createdAt: "2026-10-10T19:00:00.000Z" },
  { id: "n2", kind: "COMMENT_REPLIED", actorLabel: "Bob", actorAvatarUrl: null, proposalTitle: "Another proposal", excerpt: "A helpful reply", recordId: "record-b", commentId: "reply-b", read: false, createdAt: "2026-10-10T18:00:00.000Z" }
] };
const response = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 503, json: async () => body });
beforeEach(() => mocks.push.mockReset());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });
async function open() {
  fireEvent.click(await screen.findByRole("button", { name: "Notifications, 2 unread" }));
  await screen.findByRole("button", { name: /Alice liked your comment/ });
  await waitFor(() => expect(screen.getByRole("button", { name: "Mark all as read" })).toBeEnabled());
}
it("shows a compact private inbox and does not mark messages merely by opening it", async () => {
  const fetcher = vi.fn().mockResolvedValue(response(inbox)); vi.stubGlobal("fetch", fetcher);
  render(<DiscussionNotifications communityId="host" />); await open();
  expect(screen.getByText("My original comment")).toBeVisible(); expect(screen.getByText("A helpful reply")).toBeVisible();
  expect(fetcher.mock.calls.every(([, options]) => options.method !== "PATCH")).toBe(true);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Notifications, 2 unread" })).toHaveFocus();
});
it("marks a single notification and opens the exact inline discussion", async () => {
  const fetcher = vi.fn().mockImplementation((_url, options) => Promise.resolve(response(options.method === "PATCH" ? { updated: 1 } : inbox)));
  vi.stubGlobal("fetch", fetcher); const destination = vi.fn((event: Event) => event.preventDefault());
  window.addEventListener(OPEN_COMMENT_EVENT, destination);
  try {
    render(<DiscussionNotifications communityId="host" />); await open();
    fireEvent.click(screen.getByRole("button", { name: /Alice liked your comment/ }));
    await waitFor(() => expect(destination).toHaveBeenCalledOnce());
    expect((destination.mock.calls[0][0] as CustomEvent).detail).toEqual({ communityId: "host", recordId: "record-a", commentId: "comment-a" });
    expect(mocks.push).not.toHaveBeenCalled(); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeVisible();
    expect(JSON.parse(fetcher.mock.calls.find(([, options]) => options.method === "PATCH")![1].body)).toEqual({ ids: ["n1"] });
  } finally { window.removeEventListener(OPEN_COMMENT_EVENT, destination); }
});
it("returns from other workspace views to a comment inside Participate", async () => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation((_url, options) => Promise.resolve(response(options.method === "PATCH" ? { updated: 1 } : inbox))));
  render(<DiscussionNotifications communityId="host" />); await open();
  fireEvent.click(screen.getByRole("button", { name: /Bob replied to your comment/ }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/zcg/participate?record=record-b&comment=reply-b"));
});
it("marks the displayed snapshot and does not fake success after a failed write", async () => {
  const fetcher = vi.fn().mockImplementation((_url, options) => Promise.resolve(response(options.method === "PATCH" ? {} : inbox, options.method !== "PATCH")));
  vi.stubGlobal("fetch", fetcher); render(<DiscussionNotifications communityId="host" />); await open();
  fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not mark notifications as read");
  expect(screen.getByRole("button", { name: "Notifications, 2 unread" })).toBeVisible();
  expect(JSON.parse(fetcher.mock.calls.find(([, options]) => options.method === "PATCH")![1].body)).toEqual({ through: inbox.asOf });
  fetcher.mockImplementation((_url, options) => Promise.resolve(response(options.method === "PATCH" ? { updated: 2 } : inbox)));
  fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Notifications" })).toBeVisible());
  expect(screen.queryByText("Unread")).not.toBeInTheDocument();
});
it("refreshes when returning to the tab and removes private data when authorization expires", async () => {
  const fetcher = vi.fn().mockResolvedValue(response(inbox)); vi.stubGlobal("fetch", fetcher);
  render(<DiscussionNotifications communityId="host" />); await open();
  fetcher.mockResolvedValue({ ...response({}, false), status: 401 });
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  await screen.findByRole("alert");
  expect(screen.queryByText("My original comment")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Notifications" })).toBeVisible();
});
it("shows a new proposal and opens its committee review, preserving comment routing", async () => {
  const arrivals: DiscussionInbox = { ...inbox, unreadCount: 1, items: [{ id: "arrival", kind: "PROPOSAL_ARRIVED", actorLabel: null, actorAvatarUrl: null, commentId: null, proposalTitle: "A new committee application", excerpt: "Open committee review", recordId: "new proposal/one", read: false, createdAt: inbox.asOf }] };
  const fetcher = vi.fn().mockImplementation((_url, options) => Promise.resolve(response(options.method === "PATCH" ? { updated: 1 } : arrivals)));
  vi.stubGlobal("fetch", fetcher);
  const discussionEvent = vi.fn(); window.addEventListener(OPEN_COMMENT_EVENT, discussionEvent);
  try {
    render(<DiscussionNotifications communityId="host" />);
    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 1 unread" }));
    const notification = await screen.findByRole("button", { name: /New proposal to review/ });
    expect(notification).toHaveTextContent("A new committee application");
    expect(screen.queryByText(/liked your comment|replied to your comment/)).not.toBeInTheDocument();
    fireEvent.click(notification);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/zcg/participate?view=committee&record=new%20proposal%2Fone"));
    expect(discussionEvent).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeVisible();
    expect(JSON.parse(fetcher.mock.calls.find(([, options]) => options.method === "PATCH")![1].body)).toEqual({ ids: ["arrival"] });
  } finally { window.removeEventListener(OPEN_COMMENT_EVENT, discussionEvent); }
});
it("keeps an arrival unread and does not navigate if acknowledging it fails", async () => {
  const arrivals: DiscussionInbox = { ...inbox, unreadCount: 1, items: [{ id: "arrival", kind: "PROPOSAL_ARRIVED", actorLabel: null, actorAvatarUrl: null, commentId: null, proposalTitle: "A new committee application", excerpt: "Open committee review", recordId: "record", read: false, createdAt: inbox.asOf }] };
  vi.stubGlobal("fetch", vi.fn().mockImplementation((_url, options) => Promise.resolve(response(options.method === "PATCH" ? {} : arrivals, options.method !== "PATCH"))));
  render(<DiscussionNotifications communityId="host" />);
  fireEvent.click(await screen.findByRole("button", { name: "Notifications, 1 unread" }));
  fireEvent.click(await screen.findByRole("button", { name: /New proposal to review/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not mark notifications as read");
  expect(mocks.push).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeVisible();
});
