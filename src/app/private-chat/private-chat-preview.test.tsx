// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  within,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatController } from "@/lib/private-chat/controller";
import { PrivateChatShell } from "@/components/private-chat-shell";
import { PrivateChatPreview } from "./private-chat-preview";
import { createDeviceIdentity } from "@/lib/private-chat/identity";
import { createLiveInvite, inviteToken } from "@/lib/private-chat/live-invite";
import type {
  NymTransport,
  TransportEvent,
} from "@/lib/private-chat/transport";
import { openRoom } from "@/lib/private-chat/discovery-room";
import { presenceCommand } from "@/lib/private-chat/presence";
import type { PresenceService } from "@/lib/private-chat/presence";
// The interface tests exercise Discover explicitly; the build hides it by default.
vi.mock("@/lib/private-chat/config", () => ({
  PRIVATE_CHAT_PREVIEW_ENABLED: true,
  PRIVATE_CHAT_ENABLED: true,
  PRIVATE_CHAT_DISCOVER_ENABLED: true,
}));
const address =
  "DguTcdkWWtDyUFLvQxRdcA8qZhardhE1ZXy1YCC7Zfmq.Dxreouj5RhQqMb3ZaAxgXFdGkmfbDKwk457FdeHGKmQQ@4kjgWmFU1tcGAZYRZR57yFuVAexjLbJ5M7jvo3X5Hkcf";
const factory = (listener: (event: TransportEvent) => void): NymTransport => ({
  connect() {
    listener({ type: "status", status: "connected", address });
  },
  send(input) {
    if (input.recipient === address)
      queueMicrotask(() => listener({ type: "bytes", bytes: input.bytes }));
  },
  disconnect() {},
});
function directory(
  entries: Awaited<ReturnType<PresenceService["list"]>> = [],
): PresenceService {
  return {
    list: vi.fn(async () => entries),
    publish: vi.fn(async () => undefined),
  };
}
async function enter() {
  fireEvent.change(screen.getByLabelText("Your alias"), {
    target: { value: "Alice" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await waitFor(() =>
    expect(
      screen.getByRole("switch", { name: "Nym connection" }),
    ).toBeEnabled(),
  );
}
beforeEach(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } },
  });
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/private-chat");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("Private Chat interface", () => {
  it("keeps a session until the user confirms leaving through the portal menu", async () => {
    const parent = { postMessage: vi.fn() } as unknown as Window;
    vi.stubGlobal("parent", parent);
    render(<PrivateChatPreview createTransport={factory} directory={directory()} parentOrigin="https://openzcash.org" portalShell />);
    await enter();
    const request = (id: string, origin = "https://openzcash.org") => act(() => {
      window.dispatchEvent(new MessageEvent("message", { origin, source: parent, data: { type: "openzcash-chat-leave-request-v1", id } }));
    });
    request("forged", "https://evil.example");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    request("cancelled");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(parent.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ approved: true }), expect.anything());
    fireEvent.click(screen.getByRole("button", { name: "Keep chatting" }));
    expect(parent.postMessage).toHaveBeenLastCalledWith({ type: "openzcash-chat-leave-result-v1", id: "cancelled", approved: false }, "https://openzcash.org");
    expect(screen.getByText("Alice")).toBeInTheDocument();
    request("confirmed");
    fireEvent.click(screen.getByRole("button", { name: "Leave & clear" }));
    expect(parent.postMessage).toHaveBeenLastCalledWith({ type: "openzcash-chat-leave-result-v1", id: "confirmed", approved: true }, "https://openzcash.org");
    expect(screen.getByLabelText("Your alias")).toHaveValue("");
    expect(parent.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ alias: expect.anything() }), expect.anything());
  });
  it("keeps generated invitations on the branded parent address", async () => {
    render(<PrivateChatPreview createTransport={factory} directory={directory()} parentOrigin="https://openzcash.org" />);
    await enter();
    fireEvent.click(screen.getByRole("switch", { name: "Nym connection" }));
    await screen.findByText("Connected via Nym");
    fireEvent.click(screen.getByRole("button", { name: "Create invite" }));
    const link = await screen.findByLabelText("Invite link") as HTMLInputElement;
    expect(link.value).toMatch(/^https:\/\/openzcash\.org\/private-chat#invite=/);
  });
  it("starts unlisted and sends no directory request before Discover or explicit availability", async () => {
    const service = directory();
    render(
      <PrivateChatPreview createTransport={factory} directory={service} />,
    );
    expect(screen.queryByRole("switch", { name: "Available to chat" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create invite" })).not.toBeInTheDocument();
    await enter();
    expect(screen.queryByRole("switch", { name: "Available to chat" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "Nym connection" }));
    await screen.findByText("Connected via Nym");
    expect(screen.queryByRole("switch", { name: "Available to chat" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Discover" }));
    expect(
      screen.getByRole("heading", { name: "Find your people" }),
    ).toBeInTheDocument();
    expect(service.list).not.toHaveBeenCalled();
    expect(service.publish).not.toHaveBeenCalled();
  });
  it("shows real verified directory entries and requires connection before requesting a chat", async () => {
    const person = await createDeviceIdentity();
    const invite = await createLiveInvite(person, "Bruno", address);
    const room = (await openRoom())!;
    const owner = await createDeviceIdentity();
    const service = directory([
      {
        ...(await presenceCommand(owner, room, invite, "upsert", 1, person)),
        onlineUntil: Date.now() + 45_000,
      },
    ]);
    window.history.replaceState(null, "", `/private-chat#room=${room.token}`);
    render(
      <PrivateChatPreview createTransport={factory} directory={service} />,
    );
    await waitFor(() => expect(window.location.hash).toBe(""));
    expect(screen.getByText("Room invitation received")).toBeInTheDocument();
    expect(screen.queryByLabelText("Already have a room link?")).not.toBeInTheDocument();
    expect(service.list).not.toHaveBeenCalled();
    await enter();
    expect(service.list).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Connect to Nym" }));
    await screen.findByText("Connected via Nym");
    expect(service.list).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Join room" }));
    expect(
      await screen.findByRole("heading", { name: "Bruno" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request chat" })).toBeEnabled();
    expect(screen.getByText(/Aliases are not verified/)).toBeInTheDocument();
  });
  it("consumes the direct invite URL after sending a request and displays the full safety code", async () => {
    const person = await createDeviceIdentity();
    const invite = await createLiveInvite(person, "Bruno", address);
    window.history.replaceState(
      null,
      "",
      `/private-chat#invite=${inviteToken(invite)}`,
    );
    render(
      <PrivateChatPreview createTransport={factory} directory={directory()} />,
    );
    await waitFor(() => expect(window.location.hash).toBe(""));
    expect(screen.getByText("Chat invitation received")).toBeInTheDocument();
    expect(screen.queryByLabelText("Chat invite")).not.toBeInTheDocument();
    await enter();
    fireEvent.click(screen.getByRole("switch", { name: "Nym connection" }));
    await screen.findByText("Connected via Nym");
    fireEvent.click(screen.getByRole("button", { name: "Request chat" }));
    const safety = (await screen.findByText("Safety code")).closest("summary")!;
    expect(safety.querySelector("code")?.textContent).toMatch(
      /^(?:[A-Z0-9]+\s+){4}[A-Z0-9]+$/,
    );
    expect(screen.getByText("Waiting for Bruno")).toBeInTheDocument();
  });
  it("clears the ephemeral session on pagehide and stays off after a BFCache return", async () => {
    const connections = vi.fn();
    const transport: typeof factory = (listener) => {
      const instance = factory(listener);
      return {
        ...instance,
        connect(credentials) {
          connections();
          instance.connect(credentials);
        },
      };
    };
    render(
      <PrivateChatPreview createTransport={transport} directory={directory()} />,
    );
    await enter();
    fireEvent.click(screen.getByRole("switch", { name: "Nym connection" }));
    await screen.findByText("Connected via Nym");
    window.history.replaceState(null, "", "/private-chat#invite=consumed");
    fireEvent(window, new Event("pagehide"));
    expect(window.location.hash).toBe("");
    expect(screen.getByLabelText("Your alias")).toHaveValue("");
    expect(screen.getByRole("switch", { name: "Nym connection" })).toBeDisabled();
    const restored = new Event("pageshow") as PageTransitionEvent;
    Object.defineProperty(restored, "persisted", { value: true });
    fireEvent(window, restored);
    expect(screen.getByRole("switch", { name: "Nym connection" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(connections).toHaveBeenCalledTimes(1);
  });
  it("explains alias continuity and offers an explicit new identity", async () => {
    render(<PrivateChatPreview directory={directory()} />);
    await enter();
    fireEvent.click(screen.getByRole("button", { name: "Edit alias" }));
    expect(
      screen.getByText(/Your current contact may still see your old alias/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start a new identity" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Start a new identity" }));
    expect(screen.getByLabelText("Your alias")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });
  it("distinguishes an empty directory from a failed directory", async () => {
    const service = directory();
    vi.mocked(service.list).mockRejectedValue(new Error("offline"));
    render(
      <PrivateChatPreview createTransport={factory} directory={service} />,
    );
    await enter();
    fireEvent.click(screen.getByRole("switch", { name: "Nym connection" }));
    await screen.findByText("Connected via Nym");
    fireEvent.click(screen.getByRole("tab", { name: "Discover" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Create private room" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Room unavailable" }),
    ).toBeInTheDocument();
    vi.mocked(service.list).mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(
      await screen.findByRole("heading", { name: "Waiting for your people" }),
    ).toBeInTheDocument();
  });
  it("publishes only on opt-in and removes availability when disconnected", async () => {
    const service = directory();
    render(
      <PrivateChatPreview createTransport={factory} directory={service} />,
    );
    await enter();
    fireEvent.click(screen.getByRole("switch", { name: "Nym connection" }));
    await screen.findByText("Connected via Nym");
    fireEvent.click(screen.getByRole("tab", { name: "Discover" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Create private room" }),
    );
    await screen.findByRole("heading", { name: "Private room" });
    fireEvent.click(screen.getByRole("switch", { name: "Available to chat" }));
    await waitFor(() =>
      expect(screen.getByText(/Listed ·/)).toBeInTheDocument(),
    );
    expect(service.publish).toHaveBeenCalledWith(
      expect.objectContaining({ op: "upsert" }),
    );
    fireEvent.click(screen.getByRole("switch", { name: "Nym connection" }));
    expect(
      screen.getByRole("switch", { name: "Available to chat" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("heading", { name: "Discover paused" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Nym connection" }),
    ).toHaveAttribute("aria-checked", "false");
  });
  it("shows invite expiration and revokes the shareable link", async () => {
    render(
      <PrivateChatPreview createTransport={factory} directory={directory()} />,
    );
    await enter();
    fireEvent.click(screen.getByRole("switch", { name: "Nym connection" }));
    await screen.findByText("Connected via Nym");
    fireEvent.click(screen.getByRole("button", { name: "Create invite" }));
    expect(
      ((await screen.findByLabelText("Invite link")) as HTMLInputElement).value,
    ).toContain("#invite=ozc3.");
    expect(screen.getByText(/Expires in/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    expect(screen.queryByLabelText("Invite link")).not.toBeInTheDocument();
  });
  it("rejects invalid aliases and clears identity on Leave", async () => {
    render(<PrivateChatPreview directory={directory()} />);
    fireEvent.change(screen.getByLabelText("Your alias"), {
      target: { value: "a" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Use 2–24");
    await enter();
    fireEvent.click(
      screen.getByRole("button", { name: "Leave & clear session" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Leave this session?" });
    expect(screen.getByRole("heading", { name: "Alice" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Leave & clear" }));
    expect(screen.getByLabelText("Your alias")).toHaveValue("");
    expect(screen.queryByRole("switch", { name: "Available to chat" })).not.toBeInTheDocument();
  });
  it("keeps the guide discreet and opens tutorial and privacy answers in place", async () => {
    const service = directory();
    render(<PrivateChatPreview directory={service} />);
    const guide = screen.getByText("Quick guide & FAQ").closest("details")!;
    expect(guide).not.toHaveAttribute("open");
    expect(
      screen.getByRole("switch", { name: "Nym connection" }),
    ).toBeDisabled();
    fireEvent.click(guide.querySelector("summary")!);
    expect(guide).toHaveAttribute("open");
    expect(
      screen.getByRole("heading", { name: "Getting started" }),
    ).toBeVisible();
    fireEvent.click(screen.getByText("How private is it?"));
    expect(
      screen.getByText(/site host and Nym entry gateway can see your IP/),
    ).toBeVisible();
    expect(service.list).not.toHaveBeenCalled();
    expect(service.publish).not.toHaveBeenCalled();
  });
  it("navigates between Chat and Discover with the keyboard", async () => {
    render(<PrivateChatPreview directory={directory()} />);
    await enter();
    const chats = screen.getByRole("tab", { name: "Conversations" });
    chats.focus();
    fireEvent.keyDown(chats, { key: "ArrowRight" });
    const discover = screen.getByRole("tab", { name: "Discover" });
    expect(discover).toHaveFocus();
    expect(discover).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(discover, { key: "Home" });
    expect(chats).toHaveFocus();
    expect(chats).toHaveAttribute("aria-selected", "true");
  });
});

it("lets the user cancel Nym while offline and does not silently reconnect", async () => {
  render(
    <PrivateChatPreview createTransport={factory} directory={directory()} />,
  );
  await enter();
  const toggle = screen.getByRole("switch", { name: "Nym connection" });
  fireEvent.click(toggle);
  await screen.findByText("Connected via Nym");
  fireEvent(window, new Event("offline"));
  expect(toggle).toHaveAttribute("aria-checked", "true");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-checked", "false");
  fireEvent(window, new Event("online"));
  expect(toggle).toHaveAttribute("aria-checked", "false");
  expect(screen.queryByText("Connected via Nym")).not.toBeInTheDocument();
});


it("keeps the session when cancelling exit from the shell", async () => {
  render(<PrivateChatShell><PrivateChatPreview createTransport={factory} directory={directory()} /></PrivateChatShell>);
  await enter();
  fireEvent.click(screen.getByRole("link", { name: "Exit chat and clear session" }));
  const dialog = screen.getByRole("dialog", { name: "Leave this session?" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Keep chatting" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Alice" })).toBeInTheDocument();
});

it("preserves history reading, signals new messages and offers a new conversation after remote closure", async () => {
  const routes = new Map<string, (event: TransportEvent) => void>();
  const makeTransport = (ownAddress: string) => (listener: (event: TransportEvent) => void): NymTransport => ({
    connect() { routes.set(ownAddress, listener); listener({ type: "status", status: "connected", address: ownAddress }); },
    send(input) {
      listener({ type: "submitted", id: input.id });
      queueMicrotask(() => routes.get(input.recipient)?.({ type: "bytes", bytes: input.bytes }));
    },
    disconnect() { routes.delete(ownAddress); },
  });
  const peer = new ChatController(makeTransport("E" + address.slice(1)), directory());
  try {
    await peer.enter("Bruno");
    peer.connect();
    await waitFor(() => expect(peer.getSnapshot().link).toBe("connected"));
    const invite = await peer.makeInvite();
    window.history.replaceState(null, "", `/private-chat#invite=${inviteToken(invite!)}`);
    render(<PrivateChatPreview createTransport={makeTransport(address)} directory={directory()} />);
    await enter();
    fireEvent.click(screen.getByRole("button", { name: "Connect to Nym" }));
    await screen.findByText("Connected via Nym");
    fireEvent.click(screen.getByRole("button", { name: "Request chat" }));
    await waitFor(() => expect(peer.getSnapshot().requests).toHaveLength(1));
    await act(async () => { await peer.acceptRequest(peer.getSnapshot().requests[0].packet.id); });
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Message" })).toBeEnabled());
    await act(async () => { await peer.send("First message"); });
    await within(screen.getByRole("list", { name: "Messages" })).findByText("First message");
    const messages = screen.getByRole("list", { name: "Messages" });
    Object.defineProperties(messages, { scrollHeight: { configurable: true, value: 1200 }, clientHeight: { configurable: true, value: 400 } });
    messages.scrollTop = 100;
    fireEvent.scroll(messages);
    await act(async () => { await peer.send("Another message"); });
    await within(screen.getByRole("list", { name: "Messages" })).findByText("Another message");
    expect(messages.scrollTop).toBe(100);
    fireEvent.click(await screen.findByRole("button", { name: "↓ New messages" }));
    expect(messages.scrollTop).toBe(1200);
    expect(screen.queryByRole("button", { name: "↓ New messages" })).not.toBeInTheDocument();
    await act(async () => { peer.endConversation(); });
    const newChat = await screen.findByRole("button", { name: "New conversation" });
    expect(screen.queryByRole("button", { name: "End chat" })).not.toBeInTheDocument();
    fireEvent.click(newChat);
    const dialog = screen.getByRole("dialog", { name: "Start a new conversation?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "New conversation" }));
    expect(screen.getByRole("button", { name: "Create invite" })).toBeEnabled();
    expect(screen.getByRole("heading", { name: "Alice" })).toBeInTheDocument();
    expect(screen.queryByText("First message")).not.toBeInTheDocument();
  } finally { peer.dispose(); }
});


it("switches between people with independent drafts and unread messages", async () => {
  const routes = new Map<string, (event: TransportEvent) => void>();
  const transport = (ownAddress: string) => (listener: (event: TransportEvent) => void): NymTransport => ({
    connect() { routes.set(ownAddress, listener); listener({ type: "status", status: "connected", address: ownAddress }); },
    send(input) {
      listener({ type: "submitted", id: input.id });
      queueMicrotask(() => routes.get(input.recipient)?.({ type: "bytes", bytes: input.bytes }));
    },
    disconnect() { routes.delete(ownAddress); },
  });
  const bob = new ChatController(transport("E" + address.slice(1)), directory());
  const carol = new ChatController(transport("F" + address.slice(1)), directory());
  try {
    await bob.enter("Bob"); bob.connect();
    await carol.enter("Carol"); carol.connect();
    await waitFor(() => expect(bob.getSnapshot().link).toBe("connected"));
    await waitFor(() => expect(carol.getSnapshot().link).toBe("connected"));
    render(<PrivateChatPreview createTransport={transport(address)} directory={directory()} />);
    await enter();
    fireEvent.click(screen.getByRole("switch", { name: "Nym connection" }));
    await screen.findByText("Connected via Nym");
    for (const peer of [bob, carol]) {
      fireEvent.click(screen.getByRole("button", { name: "New chat" }));
      fireEvent.click(screen.getByRole("button", { name: "Create invite" }));
      const input = await screen.findByRole("textbox", { name: "Invite link" });
      await act(async () => { await peer.requestChat((input as HTMLInputElement).value); });
      const accept = await screen.findByRole("button", { name: "Accept" });
      fireEvent.click(accept);
      await waitFor(() => expect(screen.getByRole("textbox", { name: "Message" })).toBeEnabled());
    }
    fireEvent.change(screen.getByRole("textbox", { name: "Message" }), { target: { value: "Draft for Carol" } });
    fireEvent.click(screen.getByRole("button", { name: "Chat with Bob" }));
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("");
    fireEvent.change(screen.getByRole("textbox", { name: "Message" }), { target: { value: "Draft for Bob" } });
    await act(async () => { await carol.send("Carol in background"); });
    fireEvent.click(await screen.findByRole("button", { name: "Chat with Carol, 1 unread" }));
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("Draft for Carol");
    expect(within(screen.getByRole("list", { name: "Messages" })).getByText("Carol in background")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chat with Carol" })).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getByRole("button", { name: "Back to chats" }));
    expect(screen.getByRole("region", { name: "Conversations in this tab" }).closest("[data-chat-list]")).toHaveAttribute("data-chat-list", "true");
    fireEvent.click(screen.getByRole("button", { name: "Chat with Bob" }));
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("Draft for Bob");
    expect(within(screen.getByRole("list", { name: "Messages" })).queryByText("Carol in background")).not.toBeInTheDocument();
  } finally { bob.dispose(); carol.dispose(); }
});

function routedTransport() {
  const routes = new Map<string, (event: TransportEvent) => void>();
  return (ownAddress: string) => (listener: (event: TransportEvent) => void): NymTransport => ({
    connect() { routes.set(ownAddress, listener); listener({ type: "status", status: "connected", address: ownAddress }); },
    send(input) {
      listener({ type: "submitted", id: input.id });
      queueMicrotask(() => routes.get(input.recipient)?.({ type: "bytes", bytes: input.bytes }));
    },
    disconnect() { routes.delete(ownAddress); },
  });
}

it("lists pending requests beside the chats and answers each one separately", async () => {
  const transport = routedTransport();
  const bob = new ChatController(transport("E" + address.slice(1)), directory());
  const carol = new ChatController(transport("F" + address.slice(1)), directory());
  try {
    await bob.enter("Bob"); bob.connect();
    await carol.enter("Carol"); carol.connect();
    await waitFor(() => expect(bob.getSnapshot().link).toBe("connected"));
    await waitFor(() => expect(carol.getSnapshot().link).toBe("connected"));
    render(<PrivateChatPreview createTransport={transport(address)} directory={directory()} />);
    await enter();
    fireEvent.click(screen.getByRole("switch", { name: "Nym connection" }));
    await screen.findByText("Connected via Nym");
    fireEvent.click(screen.getByRole("button", { name: "Create invite" }));
    const link = (await screen.findByRole("textbox", { name: "Invite link" })) as HTMLInputElement;
    await act(async () => { await bob.requestChat(link.value); await carol.requestChat(link.value); });
    const requests = await screen.findByRole("group", { name: "Chat requests" });
    await waitFor(() => expect(within(requests).getAllByRole("button", { name: "Accept" })).toHaveLength(2));
    expect(screen.getByRole("tab", { name: "Conversations" })).toHaveTextContent("2");
    fireEvent.click(within(within(requests).getByLabelText("Chat request from Bob")).getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Message" })).toBeEnabled());
    // Carol is still waiting while Bob's chat is open, and the link still works.
    const carolRequest = within(screen.getByRole("group", { name: "Chat requests" })).getByLabelText("Chat request from Carol");
    expect(carolRequest).toBeInTheDocument();
    fireEvent.click(within(carolRequest).getByRole("button", { name: "Decline" }));
    await waitFor(() => expect(screen.queryByRole("group", { name: "Chat requests" })).not.toBeInTheDocument());
    await waitFor(() => expect(carol.getSnapshot().contact).toBeNull());
    expect(screen.getByRole("button", { name: "Chat with Bob" })).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    expect((screen.getByRole("textbox", { name: "Invite link" }) as HTMLInputElement).value).toBe(link.value);
  } finally { bob.dispose(); carol.dispose(); }
});

it("offers to accept, not request, when the link belongs to someone who already asked", async () => {
  const transport = routedTransport();
  const bob = new ChatController(transport("E" + address.slice(1)), directory());
  try {
    await bob.enter("Bob"); bob.connect();
    await waitFor(() => expect(bob.getSnapshot().link).toBe("connected"));
    render(<PrivateChatPreview createTransport={transport(address)} directory={directory()} />);
    await enter();
    fireEvent.click(screen.getByRole("switch", { name: "Nym connection" }));
    await screen.findByText("Connected via Nym");
    fireEvent.click(screen.getByRole("button", { name: "Create invite" }));
    const link = (await screen.findByRole("textbox", { name: "Invite link" })) as HTMLInputElement;
    await act(async () => { await bob.requestChat(link.value); });
    await screen.findByRole("group", { name: "Chat requests" });
    const fromBob = (await bob.makeInvite())!;
    fireEvent.click(screen.getByRole("button", { name: "Join with a link" }));
    fireEvent.change(screen.getByLabelText("Chat invite"), { target: { value: inviteToken(fromBob) } });
    expect(screen.queryByRole("button", { name: "Request chat" })).not.toBeInTheDocument();
    expect(screen.getByText("Bob already sent you a request.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Accept Bob" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Message" })).toBeEnabled());
    await waitFor(() => expect(bob.getSnapshot().contact?.ready).toBe(true));
    expect(screen.queryByText("Waiting for Bob")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Chat with Bob/ })).toHaveLength(1);
  } finally { bob.dispose(); }
});

it("hides Discover by default and turns a room link into a notice", async () => {
  window.history.replaceState(null, "", "/private-chat#room=ozroom2.not-a-real-room");
  render(<PrivateChatPreview createTransport={factory} directory={directory()} discover={false} />);
  await waitFor(() => expect(window.location.hash).toBe(""));
  expect(screen.getByText(/Private rooms are no longer available/)).toBeInTheDocument();
  await enter();
  expect(screen.queryByRole("tab", { name: "Discover" })).not.toBeInTheDocument();
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  expect(screen.queryByRole("switch", { name: "Available to chat" })).not.toBeInTheDocument();
  expect(screen.queryByText("Who can find me in Discover?")).not.toBeInTheDocument();
  expect(screen.getByText("Can I reply to one message or react to it?")).toBeInTheDocument();
});

it("replies with a quote and reacts from the message actions", async () => {
  const transport = routedTransport();
  const bob = new ChatController(transport("E" + address.slice(1)), directory());
  try {
    await bob.enter("Bob"); bob.connect();
    await waitFor(() => expect(bob.getSnapshot().link).toBe("connected"));
    render(<PrivateChatPreview createTransport={transport(address)} directory={directory()} />);
    await enter();
    fireEvent.click(screen.getByRole("switch", { name: "Nym connection" }));
    await screen.findByText("Connected via Nym");
    fireEvent.click(screen.getByRole("button", { name: "Create invite" }));
    const link = (await screen.findByRole("textbox", { name: "Invite link" })) as HTMLInputElement;
    await act(async () => { await bob.requestChat(link.value); });
    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Message" })).toBeEnabled());
    await act(async () => { await bob.send("Did it work?"); });
    const messages = screen.getByRole("list", { name: "Messages" });
    const bubble = (await within(messages).findByText("Did it work?")).closest("li")!;
    fireEvent.click(within(bubble).getByRole("button", { name: "Reply" }));
    expect(screen.getByText("Replying to Bob")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Message" }), { target: { value: "Yes, it did" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    const reply = (await within(messages).findByText("Yes, it did")).closest("li")!;
    const quote = within(reply).getByRole("button", { name: /^Replying to Bob: Did it work\?/ });
    expect(screen.queryByText("Replying to Bob")).not.toBeInTheDocument();
    await waitFor(() => expect(bob.getSnapshot().lines.at(-1)).toMatchObject({ body: "Yes, it did", replyTo: bob.getSnapshot().lines[0].id }));
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    fireEvent.click(quote);
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(bubble).toHaveAttribute("data-flash", "true");
    fireEvent.click(within(bubble).getByRole("button", { name: "React" }));
    fireEvent.click(within(bubble).getByRole("button", { name: "Thumbs up" }));
    expect(within(bubble).getByRole("button", { name: "Thumbs up, 1, including yours" })).toHaveAttribute("aria-pressed", "true");
    expect(within(bubble).queryByRole("group", { name: "Choose a reaction" })).not.toBeInTheDocument();
    await waitFor(() => expect(bob.getSnapshot().lines[0].reactions).toEqual({ theirs: "👍" }));
    await act(async () => { await bob.react(bob.getSnapshot().lines[0].id, "👍"); });
    fireEvent.click(await within(bubble).findByRole("button", { name: "Thumbs up, 2, including yours" }));
    await within(bubble).findByRole("button", { name: "Thumbs up, 1" });
    await waitFor(() => expect(bob.getSnapshot().lines[0].reactions).toEqual({ mine: "👍" }));
  } finally { bob.dispose(); }
});
