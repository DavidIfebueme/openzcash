// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/private-chat");
  vi.restoreAllMocks();
});
describe("Private Chat interface", () => {
  it("starts unlisted and sends no directory request before Discover or explicit availability", async () => {
    const service = directory();
    render(
      <PrivateChatPreview createTransport={factory} directory={service} />,
    );
    expect(
      screen.getByRole("switch", { name: "Available to chat" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Create invite" }),
    ).toBeDisabled();
    await enter();
    expect(
      screen.getByRole("switch", { name: "Available to chat" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("switch", { name: "Nym connection" }));
    expect(
      screen.getByRole("switch", { name: "Available to chat" }),
    ).toHaveAttribute("aria-checked", "false");
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
    fireEvent.click(screen.getByRole("tab", { name: "Discover" }));
    expect(service.list).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Join room" }));
    expect(
      await screen.findByRole("heading", { name: "Discover paused" }),
    ).toBeInTheDocument();
    expect(service.list).not.toHaveBeenCalled();
    await enter();
    fireEvent.click(screen.getByRole("switch", { name: "Nym connection" }));
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
    expect(screen.getByLabelText("Chat invite")).toHaveValue(inviteToken(invite));
    await enter();
    fireEvent.click(screen.getByRole("switch", { name: "Nym connection" }));
    await screen.findByText("Route verified");
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
    await screen.findByText("Route verified");
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
    await screen.findByText("Route verified");
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
    await screen.findByText("Route verified");
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
    await screen.findByText("Route verified");
    fireEvent.click(screen.getByRole("button", { name: "Create invite" }));
    expect(
      ((await screen.findByLabelText("Invite link")) as HTMLInputElement).value,
    ).toContain("#invite=ozchat3.");
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
    expect(screen.getByLabelText("Your alias")).toHaveValue("");
    expect(
      screen.getByRole("switch", { name: "Available to chat" }),
    ).toBeDisabled();
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
  it("navigates between Chat and Discover with the keyboard", () => {
    render(<PrivateChatPreview directory={directory()} />);
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
  await screen.findByText("Route verified");
  fireEvent(window, new Event("offline"));
  expect(toggle).toHaveAttribute("aria-checked", "true");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-checked", "false");
  fireEvent(window, new Event("online"));
  expect(toggle).toHaveAttribute("aria-checked", "false");
  expect(screen.queryByText("Route verified")).not.toBeInTheDocument();
});
