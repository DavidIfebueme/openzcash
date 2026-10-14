// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ProposalDiscussion, type DiscussionComment, type DiscussionPolicy } from "./proposal-discussion";

const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});

afterAll(() => {
  if (originalScrollIntoView) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScrollIntoView);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

const comment: DiscussionComment = {
  id: "comment-a", parentId: null, authorLabel: "Alice", createdAt: "2026-10-08T10:00:00Z",
  body: "A question for the community.", hidden: false, moderation: null,
  reaction: { count: 2, likedByMe: false, chargedBefore: false }
};
const capabilities = { canPost: true, canReact: true, canModerate: false };
const commentsEndpoint = "/api/communities/community-a/archives/record-a/comments";
const policy: DiscussionPolicy = {
  visibility: "INVITED_PARTICIPANTS", immutable: true, maxLength: 4000, readOnly: false,
  participation: { communityId: "community-a", mode: "CREDITS", commentCost: 1, reactionCost: 1, version: 1, availableCredits: 25, sponsored: false, sandbox: true }
};

function response(value: unknown, ok = true) {
  return { ok, json: async () => value };
}

function renderDiscussion(fetchMock = vi.fn(), nextPolicy = policy, comments = [comment]) {
  vi.stubGlobal("fetch", fetchMock);
  return render(<ProposalDiscussion pollId="poll-a" commentsEndpoint={commentsEndpoint} embedded initialComments={comments} capabilities={capabilities} policy={nextPolicy} />);
}

function posts(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  navigation.refresh.mockClear();
});

it("edits its own version, sends the version with likes and preserves the new draft after a lost reply", async () => {
  const own = { ...comment, version: 1, canEdit: true, canWithdraw: true };
  const fetchMock = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValue(response({ comment: { ...own, body: "An updated view", version: 2, reaction: { count: 0, likedByMe: false, chargedBefore: false } } }));
  renderDiscussion(fetchMock, { ...policy, versioned: true }, [own]);
  fireEvent.click(screen.getByRole("button", { name: "Comment actions" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit comment" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Edit comment" }), { target: { value: "An updated view" } });
  fireEvent.click(screen.getByRole("button", { name: "Save edit" }));
  await screen.findByText(/Connection interrupted. Your draft is here/);
  expect(screen.getByRole("textbox", { name: "Edit comment" })).toHaveValue("An updated view");
  fireEvent.click(screen.getByRole("button", { name: "Save edit" }));
  await screen.findByText("An updated view");
  const calls = posts(fetchMock);
  expect(calls[0][0]).toBe(`${commentsEndpoint}/${own.id}/edit`);
  expect(calls[0][1].body).toBe(calls[1][1].body);
  expect(JSON.parse(calls[0][1].body)).toMatchObject({ version: 1, body: "An updated view" });
  expect(screen.getByRole("button", { name: /Edited · v2 · View history/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Like Alice’s comment. 0 likes. 1 Zcred" }));
  await waitFor(() => expect(posts(fetchMock)).toHaveLength(3));
  expect(JSON.parse(posts(fetchMock)[2][1].body).version).toBe(2);
});

it("withdraws with an explicit inline explanation and keeps reply text and version history accessible", async () => {
  const own = { ...comment, version: 1, canEdit: true, canWithdraw: true };
  const reply = { ...comment, id: "reply", parentId: own.id, authorLabel: "Bob", body: "Reply remains" };
  const fetchMock = vi.fn().mockResolvedValueOnce(response({ comment: { ...own, body: null, withdrawn: true, canEdit: false, canWithdraw: false } }))
    .mockResolvedValueOnce(response({ versions: [{ version: 1, body: own.body, createdAt: own.createdAt, likes: 2 }] }));
  renderDiscussion(fetchMock, { ...policy, versioned: true }, [own, reply]);
  fireEvent.click(screen.getByRole("button", { name: "Comment actions" }));
  fireEvent.click(screen.getByRole("button", { name: "Withdraw comment" }));
  expect(screen.getByText(/Existing blockchain proofs cannot be erased/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Withdraw comment" }));
  await screen.findByText("Comment withdrawn by author");
  expect(posts(fetchMock)[0][0]).toBe(`${commentsEndpoint}/${own.id}/withdraw`);
  expect(JSON.parse(posts(fetchMock)[0][1].body).version).toBe(1);
  expect(screen.getByText("Reply remains")).toBeVisible();
  expect(screen.queryByText(own.body!)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View history" }));
  await screen.findByText(own.body!);
  expect(screen.getByText("Version 1 · Withdrawn")).toBeVisible();
  expect(screen.queryByText("Version 1 · Current")).not.toBeInTheDocument();
});

it("shows the versioned policy and keeps other authors' edit actions unavailable", () => {
  renderDiscussion(vi.fn(), { ...policy, versioned: true }, [{ ...comment, version: 2, canEdit: false, canWithdraw: false }]);
  expect(screen.getByText("Public · Edits stay in history.")).toBeVisible();
  expect(screen.queryByText(/Cannot be edited/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Comment actions" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Edited · v2 · View history/ })).toBeVisible();
});

it("keeps unversioned discussions immutable", () => {
  renderDiscussion();
  expect(screen.getByText("Public · Cannot be edited after publishing.")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Comment actions" })).not.toBeInTheDocument();
});

it("reopens the withdrawn shield and earlier reply text through the production history contract", async () => {
  const shield = { ...comment, id: "shield", body: null, version: 1, withdrawn: true };
  const reply = { ...comment, id: "edited-reply", parentId: "shield", body: "Hi ᙇ", version: 2 };
  const fetchMock = vi.fn().mockImplementation(async (url: string) => response({ versions: url.includes("/shield/")
    ? [{ version: 1, body: "🛡️", createdAt: comment.createdAt, likes: 2 }]
    : [{ version: 2, body: "Hi ᙇ", createdAt: comment.createdAt, likes: 0 }, { version: 1, body: "ᙇ", createdAt: comment.createdAt, likes: 1 }] }));
  renderDiscussion(fetchMock, { ...policy, versioned: true }, [shield, reply]);
  const withdrawn = within(document.getElementById("comment-shield")!);
  expect(withdrawn.getByText("Comment withdrawn by author")).toBeVisible();
  expect(withdrawn.queryByRole("button", { name: /Reply|Like|Comment actions/ })).not.toBeInTheDocument();
  fireEvent.click(withdrawn.getByRole("button", { name: "View history" }));
  await screen.findByText("🛡️");
  expect(fetchMock).toHaveBeenCalledWith(`${commentsEndpoint}/shield/history`, { cache: "no-store" });
  expect(withdrawn.getByText("Version 1 · Withdrawn")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /Edited · v2 · View history/ }));
  await screen.findByText("ᙇ");
  expect(screen.getByText("Version 2 · Current")).toBeVisible();
  expect(screen.getByText("Version 1", { exact: true })).toBeVisible();
  expect(screen.getAllByText("Hi ᙇ")).toHaveLength(2);
});

it("refreshes a newer version before the user can retry a stale like", async () => {
  const old = { ...comment, version: 1 };
  const latest = { ...comment, version: 2, body: "The revised question" };
  const fetchMock = vi.fn().mockResolvedValueOnce(response({ error: "COMMENT_VERSION_CHANGED" }, false))
    .mockResolvedValueOnce(response({ comments: [latest], capabilities, policy: { ...policy, versioned: true } }))
    .mockResolvedValueOnce(response({ comment: { ...latest, reaction: { count: 3, likedByMe: true, chargedBefore: true } } }));
  renderDiscussion(fetchMock, { ...policy, versioned: true }, [old]);
  fireEvent.click(screen.getByRole("button", { name: /Like Alice’s comment/ }));
  await screen.findByText("The revised question");
  expect(screen.getByText(/This comment has a newer version/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /Like Alice’s comment/ }));
  await screen.findByRole("button", { name: /Remove like from Alice/ });
  const calls = posts(fetchMock).map(([, init]) => JSON.parse(init.body));
  expect(calls.map(call => call.version)).toEqual([1, 2]);
  expect(calls[0].requestKey).not.toBe(calls[1].requestKey);
});

it("lets a failed history read be retried without mutating the discussion", async () => {
  const fetchMock = vi.fn().mockRejectedValueOnce(new Error("network"))
    .mockResolvedValue(response({ versions: [{ version: 1, body: "Earlier text", createdAt: comment.createdAt, likes: 1 }] }));
  renderDiscussion(fetchMock, { ...policy, versioned: true }, [{ ...comment, version: 2 }]);
  fireEvent.click(screen.getByRole("button", { name: /View history/ }));
  await screen.findByText("History could not be loaded. Try again.");
  fireEvent.click(screen.getByRole("button", { name: /View history/ }));
  await screen.findByText("Earlier text");
  expect(posts(fetchMock)).toHaveLength(0);
});

it("keeps author actions in a keyboard-accessible menu and restores focus on Escape", () => {
  renderDiscussion(vi.fn(), { ...policy, versioned: true }, [{ ...comment, version: 1, canEdit: true, canWithdraw: true }]);
  const actions = screen.getByRole("button", { name: "Comment actions" });
  expect(screen.queryByRole("button", { name: "Edit comment" })).not.toBeInTheDocument();
  fireEvent.click(actions);
  expect(screen.getByRole("button", { name: "Edit comment" })).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(actions).toHaveFocus();
  expect(actions).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(actions);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("button", { name: "Withdraw comment" })).not.toBeInTheDocument();
});
