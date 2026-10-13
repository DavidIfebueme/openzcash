// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ProposalDiscussion, type DiscussionComment, type DiscussionPolicy } from "./proposal-discussion";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/components/participate/workspace/workspace-account", () => ({ AccountAvatar: () => <span /> }));
vi.mock("./comment-emoji-picker", () => ({ CommentEmojiPicker: () => null }));
const policy: DiscussionPolicy = { visibility: "PUBLIC", immutable: true, maxLength: 4000, readOnly: false };
const capabilities = { canPost: true, canReact: true, canModerate: false };
const item = (id: string, parentId: string | null = null, body = `Text ${id}`): DiscussionComment => ({
  id, parentId, body, authorLabel: `Member ${id}`, createdAt: "2026-10-13T00:00:00Z", hidden: false, moderation: null,
  reaction: { count: 0, likedByMe: false, chargedBefore: false }
});
const chain = (length: number) => Array.from({ length }, (_, i) => item(`c${i}`, i ? `c${i - 1}` : null));
const response = (comment: DiscussionComment) => ({ ok: true, json: async () => ({ comment }) });
const props = (initialComments: DiscussionComment[]) => ({ pollId: "thread-test", initialComments, capabilities, policy });
const commentElement = (id: string) => document.getElementById(`comment-${id}`)!;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  window.history.replaceState(null, "", "/");
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); window.history.replaceState(null, "", "/"); });

it("renders multiple levels and lets members reply directly to an emoji", async () => {
  const comments = [item("root"), item("emoji", "root", "🛡️"), item("nested", "emoji")];
  const fetchMock = vi.fn().mockResolvedValue(response(item("new", "emoji", "Thanks!")));
  vi.stubGlobal("fetch", fetchMock);
  render(<ProposalDiscussion {...props(comments)} />);
  expect(commentElement("nested").closest("li")!.parentElement!.closest("li")).toContainElement(commentElement("emoji"));
  fireEvent.click(within(commentElement("emoji")).getByRole("button", { name: "Reply to Member emoji" }));
  expect(screen.getByRole("textbox", { name: "Reply to Member emoji" })).toHaveFocus();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Thanks!" } });
  fireEvent.click(screen.getByRole("button", { name: "Publish reply" }));
  await screen.findByText("Thanks!");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ parentId: "emoji", body: "Thanks!" });
  expect(commentElement("new").closest("li")!.parentElement!.closest("li")).toContainElement(commentElement("emoji"));
});

it("keeps deep conversations compact and continues the selected branch", () => {
  render(<ProposalDiscussion {...props(chain(10))} />);
  expect(screen.getAllByRole("article")).toHaveLength(4);
  fireEvent.click(screen.getByRole("button", { name: /Continue thread.*6 replies/ }));
  expect(screen.queryByText("Text c0")).not.toBeInTheDocument();
  expect(screen.getByText("Text c6")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /Continue thread/ }));
  expect(screen.getByText("Text c9")).toBeVisible();
  expect(screen.getByRole("button", { name: "In reply to Member c5" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /All comments/ }));
  expect(screen.getByText("Text c0")).toBeVisible();
  expect(screen.queryByText("Text c9")).not.toBeInTheDocument();
});

it("opens deep notification targets after the comments arrive and preserves parent context", () => {
  const view = render(<ProposalDiscussion {...props([])} focusComment={{ id: "c8", request: 1 }} />);
  view.rerender(<ProposalDiscussion {...props(chain(10))} focusComment={{ id: "c8", request: 1 }} />);
  expect(commentElement("c8")).toHaveFocus();
  expect(screen.getByText("Text c7")).toBeVisible();
  view.rerender(<ProposalDiscussion {...props(chain(10))} focusComment={{ id: "c5", request: 2 }} />);
  expect(commentElement("c5")).toHaveFocus();
  expect(screen.getByText("Text c4")).toBeVisible();
});

it("opens a permanent link into a deep branch", () => {
  window.history.replaceState(null, "", "/#comment-c9");
  render(<ProposalDiscussion {...props(chain(12))} />);
  expect(commentElement("c9")).toHaveFocus();
  expect(screen.getByText("Text c8")).toBeVisible();
});

it("reveals a new reply below the visible depth without changing its parent", async () => {
  const fetchMock = vi.fn().mockResolvedValue(response(item("new", "c3", "A deeper reply")));
  vi.stubGlobal("fetch", fetchMock);
  render(<ProposalDiscussion {...props(chain(4))} />);
  fireEvent.click(screen.getByRole("button", { name: "Reply to Member c3" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "A deeper reply" } });
  fireEvent.click(screen.getByRole("button", { name: "Publish reply" }));
  await waitFor(() => expect(commentElement("new")).toHaveFocus());
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).parentId).toBe("c3");
  expect(screen.getByText("Text c3")).toBeVisible();
});

it("keeps descendants visible when a parent is moderated", () => {
  const comments = chain(3); comments[1] = { ...comments[1], body: null, hidden: true };
  render(<ProposalDiscussion {...props(comments)} />);
  expect(screen.getByText("Text c2")).toBeVisible();
  expect(within(commentElement("c1")).queryByRole("button", { name: /Reply/ })).not.toBeInTheDocument();
  expect(within(commentElement("c2")).getByRole("button", { name: /Reply/ })).toBeVisible();
});

it("returns to all comments when a new top-level comment is posted inside a branch", async () => {
  const fetchMock = vi.fn().mockResolvedValue(response(item("new-root", null, "A new perspective")));
  vi.stubGlobal("fetch", fetchMock);
  render(<ProposalDiscussion {...props(chain(6))} />);
  fireEvent.click(screen.getByRole("button", { name: /Continue thread/ }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "A new perspective" } });
  fireEvent.click(screen.getByRole("button", { name: "Publish comment" }));
  await waitFor(() => expect(commentElement("new-root")).toHaveFocus());
  expect(screen.getByText("Text c0")).toBeVisible();
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).parentId).toBeNull();
});

it("reveals the actual parent if the user navigates to another branch while drafting", async () => {
  const fetchMock = vi.fn().mockResolvedValue(response(item("new", "c1", "Reply after browsing")));
  vi.stubGlobal("fetch", fetchMock);
  render(<ProposalDiscussion {...props(chain(6))} />);
  fireEvent.click(screen.getByRole("button", { name: "Reply to Member c1" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Reply after browsing" } });
  fireEvent.click(screen.getByRole("button", { name: /Continue thread/ }));
  fireEvent.click(screen.getByRole("button", { name: "Publish reply" }));
  await waitFor(() => expect(commentElement("new")).toHaveFocus());
  expect(screen.getByText("Text c1")).toBeVisible();
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).parentId).toBe("c1");
});

it("keeps reply chronology and hierarchy when roots are sorted newest first", () => {
  const comments = [item("a"), item("b"), item("reply-a", "a"), item("reply-b", "a")];
  comments[1].createdAt = "2026-10-14T00:00:00Z";
  comments[3].createdAt = "2026-10-14T00:00:00Z";
  render(<ProposalDiscussion {...props(comments.reverse())} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Comment order" }), { target: { value: "newest" } });
  expect(screen.getAllByRole("article").map(node => node.id)).toEqual(["comment-b", "comment-a", "comment-reply-a", "comment-reply-b"]);
});

it("renders an incomplete parent snapshot without losing the reply", () => {
  render(<ProposalDiscussion {...props([item("orphan", "not-loaded")])} />);
  expect(screen.getByText("Text orphan")).toBeVisible();
});
