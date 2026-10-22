import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ChatController,
  ACK_TIMEOUT_MS,
  MAX_CONVERSATIONS,
  ROUTE_CHECK_INTERVAL_MS,
  ROUTE_CHECK_TIMEOUT_MS,
} from "./controller";
import { inviteToken, INVITE_TTL_MS } from "./live-invite";
import * as envelope from "./envelope";
import { PresenceStore } from "./presence-store";
import type { NymTransport, TransportEvent } from "./transport";
import type { PresenceService } from "./presence";
const base =
  "DguTcdkWWtDyUFLvQxRdcA8qZhardhE1ZXy1YCC7Zfmq.Dxreouj5RhQqMb3ZaAxgXFdGkmfbDKwk457FdeHGKmQQ@4kjgWmFU1tcGAZYRZR57yFuVAexjLbJ5M7jvo3X5Hkcf";
const controllers: ChatController[] = [];
afterEach(() => {
  controllers.forEach((c) => c.dispose());
  controllers.length = 0;
  vi.restoreAllMocks();
});
function harness() {
  let now = 100_000;
  const store = new PresenceStore();
  const directory: PresenceService = {
    async list(room) {
      return store.list(room, now);
    },
    async publish(command) {
      const status = await store.apply(command, now);
      if (status !== 200) throw new Error(String(status));
    },
  };
  const bus = new Map<string, (event: TransportEvent) => void>();
  const logs: Array<{
    from: string;
    recipient: string;
    bytes: Uint8Array;
    id: string;
  }> = [];
  const connects: Array<{ clientId: string; storagePassphrase: string }> = [];
  let dropFrom = "",
    failNext = false;
  let clientNumber = 0;
  function client() {
    const address = "DEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"[clientNumber++] + base.slice(1);
    let nextAddress = address;
    const listeners: Array<(event: TransportEvent) => void> = [];
    const factory = (
      listener: (event: TransportEvent) => void,
    ): NymTransport => {
      const routeAddress = nextAddress;
      listeners.push(listener);
      return {
        connect(input) {
          connects.push(input);
          listener({ type: "status", status: "connecting" });
          if (failNext) {
            failNext = false;
            listener({ type: "status", status: "failed" });
            return;
          }
          bus.set(routeAddress, listener);
          listener({ type: "status", status: "connected", address: routeAddress });
        },
        send(input) {
          logs.push({ ...input, from: routeAddress });
          listener({ type: "submitted", id: input.id });
          if (routeAddress !== dropFrom)
            queueMicrotask(() =>
              bus.get(input.recipient)?.({ type: "bytes", bytes: input.bytes }),
            );
        },
        disconnect() {
          if (bus.get(routeAddress) === listener) bus.delete(routeAddress);
          listener({ type: "status", status: "disconnected" });
        },
      };
    };
    const chat = new ChatController(factory, directory, () => now);
    controllers.push(chat);
    return { chat, address, listeners, rotateAddress: () => {
      nextAddress = "DEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"[clientNumber++] + base.slice(1);
      return nextAddress;
    } };
  }
  return {
    client,
    logs,
    connects,
    store,
    directory,
    setTime: (n: number) => {
      now = n;
    },
    time: () => now,
    drop: (address: string) => {
      dropFrom = address;
    },
    fail: () => {
      failNext = true;
    },
  };
}
async function ready(chat: ChatController, name: string) {
  expect(await chat.enter(name)).toBe(true);
  chat.connect();
  await vi.waitFor(() => expect(chat.getSnapshot().link).toBe("connected"));
}
async function pair(h: ReturnType<typeof harness>) {
  const a = h.client(),
    b = h.client();
  await ready(a.chat, "Alice");
  await ready(b.chat, "Bob");
  const invite = await a.chat.makeInvite();
  expect(await b.chat.requestChat(inviteToken(invite!))).toBe(true);
  await vi.waitFor(() => expect(a.chat.getSnapshot().requests).toHaveLength(1));
  expect(a.chat.getSnapshot().contact).toBeNull();
  expect(await b.chat.send("must not send before acceptance")).toBe(false);
  await a.chat.acceptRequest(a.chat.getSnapshot().requests[0].packet.id);
  await vi.waitFor(() =>
    expect(b.chat.getSnapshot().contact?.ready).toBe(true),
  );
  expect(a.chat.getSnapshot().contact?.ready).toBe(true);
  return { a, b, invite: invite! };
}
describe("private chat consent and lifecycle", () => {
  it("requires explicit acceptance, keeps the invite open and exchanges authenticated messages", async () => {
    const h = harness(),
      { a, b, invite } = await pair(h);
    expect(a.chat.getSnapshot().invite).toEqual(invite);
    expect(a.chat.getSnapshot().contact?.code).toBe(
      b.chat.getSnapshot().contact?.code,
    );
    await b.chat.send("hello Alice");
    await vi.waitFor(() =>
      expect(b.chat.getSnapshot().lines[0]?.delivery).toBe("delivered"),
    );
    expect(a.chat.getSnapshot().lines.map((l) => l.body)).toEqual([
      "hello Alice",
    ]);
    const c = h.client();
    await ready(c.chat, "Mallory");
    await c.chat.requestChat(inviteToken(invite));
    // A later request with the same link waits for an explicit answer.
    await vi.waitFor(() => expect(a.chat.getSnapshot().requests).toHaveLength(1));
    expect(a.chat.getSnapshot().requests[0].packet.alias).toBe("Mallory");
    expect(a.chat.getSnapshot().contact?.alias).toBe("Bob");
    await a.chat.rejectRequest(a.chat.getSnapshot().requests[0].packet.id);
    await vi.waitFor(() => expect(c.chat.getSnapshot().contact).toBeNull());
    expect(a.chat.getSnapshot().requests).toEqual([]);
    expect(a.chat.getSnapshot().conversations.map((item) => item.alias)).toEqual(["Bob"]);
  });
  it("requires inner ratchet encryption even when the static sender key is authentic", async () => {
    const h = harness(), { a, b } = await pair(h);
    const seal = vi.spyOn(envelope, "sealEnvelope");
    await b.chat.send("ratcheted message");
    await vi.waitFor(() => expect(a.chat.getSnapshot().lines).toHaveLength(1));
    const captured = seal.mock.calls.map(([input]) => input).find(input =>
      input.plaintext.v === 3 && input.plaintext.t === "ratchet" &&
      input.senderPublicKey === a.chat.getSnapshot().contact!.publicKey)!;
    expect(captured).toBeDefined();
    expect(JSON.stringify(captured.plaintext)).not.toContain("ratcheted message");
    const bytes = await envelope.sealEnvelope({ ...captured, plaintext: {
      v: 3, t: "text", id: "downgrade_01", c: a.chat.getSnapshot().contact!.conversation,
      body: "static key injection",
    } });
    a.listeners.at(-1)!({ type: "bytes", bytes: bytes! });
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(a.chat.getSnapshot().lines.map(line => line.body)).toEqual(["ratcheted message"]);
  });
  it("does not accept a request declined while ratchet keys are being prepared", async () => {
    const h = harness(), a = h.client(), b = h.client();
    await ready(a.chat, "Alice"); await ready(b.chat, "Bob");
    await b.chat.requestChat(inviteToken((await a.chat.makeInvite())!));
    await vi.waitFor(() => expect(a.chat.getSnapshot().requests).toHaveLength(1));
    const id = a.chat.getSnapshot().requests[0].packet.id;
    const accepting = a.chat.acceptRequest(id);
    await a.chat.rejectRequest(id);
    await accepting;
    await vi.waitFor(() => expect(b.chat.getSnapshot().contact).toBeNull());
    expect(a.chat.getSnapshot().contact).toBeNull();
  });
  it("rejects expired, revoked and declined invitations without opening a conversation", async () => {
    const h = harness(),
      a = h.client(),
      b = h.client();
    await ready(a.chat, "Alice");
    await ready(b.chat, "Bob");
    const invite = await a.chat.makeInvite();
    await b.chat.requestChat(inviteToken(invite!));
    await vi.waitFor(() =>
      expect(a.chat.getSnapshot().requests).toHaveLength(1),
    );
    await a.chat.rejectRequest(a.chat.getSnapshot().requests[0].packet.id);
    await vi.waitFor(() => expect(b.chat.getSnapshot().contact).toBeNull());
    expect(a.chat.getSnapshot().contact).toBeNull();
    a.chat.revokeInvite();
    await b.chat.requestChat(inviteToken(invite!));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(a.chat.getSnapshot().requests).toEqual([]);
    h.setTime(invite!.expiresAt);
    a.chat.tick();
    b.chat.tick();
    expect(b.chat.getSnapshot().contact).toBeNull();
    expect(await b.chat.requestChat(inviteToken(invite!))).toBe(false);
  });
  it("expires an incoming request before a late Accept click", async () => {
    const h = harness(),
      a = h.client(),
      b = h.client();
    await ready(a.chat, "Alice");
    await ready(b.chat, "Bob");
    const invite = await a.chat.makeInvite();
    await b.chat.requestChat(inviteToken(invite!));
    await vi.waitFor(() =>
      expect(a.chat.getSnapshot().requests).toHaveLength(1),
    );
    const id = a.chat.getSnapshot().requests[0].packet.id;
    h.setTime(invite!.expiresAt);
    await a.chat.acceptRequest(id);
    expect(a.chat.getSnapshot().contact).toBeNull();
  });
  it("cancels an in-flight acceptance when the inviter ends the conversation", async () => {
    const h = harness(),
      a = h.client(),
      b = h.client();
    await ready(a.chat, "Alice");
    await ready(b.chat, "Bob");
    const invite = await a.chat.makeInvite();
    await b.chat.requestChat(inviteToken(invite!));
    await vi.waitFor(() => expect(a.chat.getSnapshot().requests).toHaveLength(1));
    const before = h.logs.length;
    const accepting = a.chat.acceptRequest(a.chat.getSnapshot().requests[0].packet.id);
    a.chat.endConversation();
    await accepting;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(a.chat.getSnapshot().contact).toBeNull();
    expect(b.chat.getSnapshot().contact?.status).toBe("requesting");
    // Cancellation happened before a shared ratchet existed. No stale acceptance
    // or unauthenticated end control is sent; the pending request expires.
    expect(h.logs.slice(before)).toHaveLength(0);
  });
  it("does not send an old rejection after its invite is replaced", async () => {
    const h = harness(),
      a = h.client(),
      b = h.client();
    await ready(a.chat, "Alice");
    await ready(b.chat, "Bob");
    const invite = await a.chat.makeInvite();
    await b.chat.requestChat(inviteToken(invite!));
    await vi.waitFor(() => expect(a.chat.getSnapshot().requests).toHaveLength(1));
    const originalSeal = envelope.sealEnvelope;
    let releaseReject: (() => void) | undefined;
    vi.spyOn(envelope, "sealEnvelope").mockImplementation(async (input) => {
      if (input.plaintext.v === 3 && input.plaintext.t === "reject")
        await new Promise<void>((resolve) => { releaseReject = resolve; });
      return originalSeal(input);
    });
    const before = h.logs.length;
    const rejecting = a.chat.rejectRequest(a.chat.getSnapshot().requests[0].packet.id);
    await vi.waitFor(() => expect(releaseReject).toBeDefined());
    a.chat.revokeInvite();
    expect(await a.chat.makeInvite()).not.toBeNull();
    releaseReject!();
    await rejecting;
    expect(h.logs.slice(before)).toHaveLength(0);
  });
  it("makes opt-in visible to another session, deletes it on opt-out, and never restores it on reconnect", async () => {
    const h = harness(),
      a = h.client(),
      b = h.client();
    await ready(a.chat, "Alice");
    await ready(b.chat, "Bob");
    await a.chat.joinRoom();
    await b.chat.joinRoom(a.chat.getSnapshot().room!.token);
    expect(h.store.list(a.chat.getSnapshot().room!.id, h.time())).toEqual([]);
    a.chat.setAvailable(true);
    await vi.waitFor(() =>
      expect(a.chat.getSnapshot().presence).toBe("online"),
    );
    b.chat.setDiscover(true);
    await vi.waitFor(() =>
      expect(b.chat.getSnapshot().peers[0]?.alias).toBe("Alice"),
    );
    a.chat.setAvailable(false);
    await vi.waitFor(() =>
      expect(h.store.list(a.chat.getSnapshot().room!.id, h.time())).toEqual([]),
    );
    a.chat.setAvailable(true);
    await vi.waitFor(() =>
      expect(a.chat.getSnapshot().presence).toBe("online"),
    );
    a.chat.disconnect();
    a.chat.connect();
    await vi.waitFor(() => expect(a.chat.getSnapshot().link).toBe("connected"));
    expect(a.chat.getSnapshot().availableUntil).toBeNull();
    // An immediate disconnect stops all sends. The old listing expires; its
    // invite is already locally revoked and cannot open a conversation.
    a.chat.setAvailable(true);
    await vi.waitFor(() =>
      expect(a.chat.getSnapshot().presence).toBe("online"),
    );
    h.setTime(h.time() + INVITE_TTL_MS);
    a.chat.tick();
    expect(h.store.list(a.chat.getSnapshot().room!.id, h.time())).toEqual([]);
    expect(a.chat.getSnapshot().availableUntil).toBeNull();
  });
  it("does not publish a pending opt-in after the switch is turned off", async () => {
    const h = harness(),
      a = h.client();
    await ready(a.chat, "Alice");
    await a.chat.joinRoom();
    a.chat.setAvailable(true);
    a.chat.setAvailable(false);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(h.store.list(a.chat.getSnapshot().room!.id, h.time())).toEqual([]);
    expect(a.chat.getSnapshot().availableUntil).toBeNull();
  });
  it("times out missing acknowledgements and retries the same message without duplicating it", async () => {
    const h = harness(),
      { a, b } = await pair(h);
    h.drop(a.address); // Alice receives, but her ACK is lost.
    await b.chat.send("one message");
    await vi.waitFor(() => expect(a.chat.getSnapshot().lines).toHaveLength(1));
    expect(b.chat.getSnapshot().lines[0].delivery).toBe("waiting");
    h.setTime(h.time() + ACK_TIMEOUT_MS);
    b.chat.tick();
    expect(b.chat.getSnapshot().lines[0].delivery).toBe("unconfirmed");
    expect(b.chat.getSnapshot().contact?.ready).toBe(false);
    expect(await b.chat.send("must wait for the peer")).toBe(false);
    h.drop("");
    await b.chat.checkPeer();
    await vi.waitFor(() =>
      expect(b.chat.getSnapshot().contact?.ready).toBe(true),
    );
    const line = b.chat.getSnapshot().lines[0];
    await b.chat.send(line.body, line.id);
    await vi.waitFor(() =>
      expect(b.chat.getSnapshot().lines[0].delivery).toBe("delivered"),
    );
    expect(a.chat.getSnapshot().lines).toHaveLength(1);
  });
  it("resends a locally accepted request after reconnect if the first accept was lost", async () => {
    const h = harness(),
      a = h.client(),
      b = h.client();
    await ready(a.chat, "Alice");
    await ready(b.chat, "Bob");
    const invite = await a.chat.makeInvite();
    await b.chat.requestChat(inviteToken(invite!));
    await vi.waitFor(() => expect(a.chat.getSnapshot().requests).toHaveLength(1));
    h.drop(a.address);
    await a.chat.acceptRequest(a.chat.getSnapshot().requests[0].packet.id);
    expect(a.chat.getSnapshot().contact?.status).toBe("active");
    expect(b.chat.getSnapshot().contact?.status).toBe("requesting");
    h.drop("");
    a.chat.disconnect();
    a.chat.connect();
    await vi.waitFor(() => expect(a.chat.getSnapshot().link).toBe("connected"));
    await vi.waitFor(() => {
      expect(b.chat.getSnapshot().contact?.status).toBe("active");
      expect(a.chat.getSnapshot().contact?.ready).toBe(true);
      expect(b.chat.getSnapshot().contact?.ready).toBe(true);
    });
  });
  it("resends a pending request after the requester reconnects on a new Nym route", async () => {
    const h = harness(),
      a = h.client(),
      b = h.client();
    await ready(a.chat, "Alice");
    await ready(b.chat, "Bob");
    const invite = await a.chat.makeInvite();
    await b.chat.requestChat(inviteToken(invite!));
    await vi.waitFor(() => expect(a.chat.getSnapshot().requests).toHaveLength(1));
    const requestId = a.chat.getSnapshot().requests[0].packet.id;
    const oldRequest = h.logs.find((item) =>
      item.from === b.address && item.recipient === a.address);
    expect(oldRequest).toBeDefined();
    b.chat.disconnect();
    const newAddress = b.rotateAddress();
    b.chat.connect();
    await vi.waitFor(() => expect(b.chat.getSnapshot().link).toBe("connected"));
    await vi.waitFor(() =>
      expect(a.chat.getSnapshot().requests[0].packet.address).toBe(newAddress),
    );
    expect(a.chat.getSnapshot().requests[0].packet.id).toBe(requestId);
    a.listeners.at(-1)!({ type: "bytes", bytes: oldRequest!.bytes });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(a.chat.getSnapshot().requests[0].packet.address).toBe(newAddress);
    await a.chat.acceptRequest(requestId);
    await vi.waitFor(() => expect(b.chat.getSnapshot().contact?.ready).toBe(true));
    expect(a.chat.getSnapshot().contact?.address).toBe(newAddress);
  });
  it("resends a lost acceptance to the requester's new Nym route", async () => {
    const h = harness(),
      a = h.client(),
      b = h.client();
    await ready(a.chat, "Alice");
    await ready(b.chat, "Bob");
    const invite = await a.chat.makeInvite();
    await b.chat.requestChat(inviteToken(invite!));
    await vi.waitFor(() => expect(a.chat.getSnapshot().requests).toHaveLength(1));
    h.drop(a.address);
    await a.chat.acceptRequest(a.chat.getSnapshot().requests[0].packet.id);
    expect(b.chat.getSnapshot().contact?.status).toBe("requesting");
    h.drop("");
    b.chat.disconnect();
    const newAddress = b.rotateAddress();
    b.chat.connect();
    await vi.waitFor(() => expect(b.chat.getSnapshot().contact?.ready).toBe(true));
    expect(a.chat.getSnapshot().contact?.address).toBe(newAddress);
  });
  it("reuses this session's Nym credentials and rechecks the peer after reconnect", async () => {
    const h = harness(),
      { a, b } = await pair(h);
    await b.chat.send("before reconnect");
    await vi.waitFor(() =>
      expect(b.chat.getSnapshot().lines[0]?.delivery).toBe("delivered"),
    );
    b.chat.disconnect();
    expect(await b.chat.send("offline")).toBe(false);
    b.chat.connect();
    expect(h.connects[2]).toEqual(h.connects[1]);
    await vi.waitFor(() =>
      expect(b.chat.getSnapshot().contact?.ready).toBe(true),
    );
    await b.chat.send("after reconnect");
    await vi.waitFor(() => expect(a.chat.getSnapshot().lines).toHaveLength(2));
    expect(b.chat.getSnapshot().availableUntil).toBeNull();
  });
  it("recovers from offline without republishing and cancels stale transport callbacks", async () => {
    const h = harness(),
      a = h.client();
    await ready(a.chat, "Alice");
    const stale = a.listeners[0];
    a.chat.network(false);
    expect(a.chat.getSnapshot().link).toBe("offline");
    stale({ type: "status", status: "connected", address: a.address });
    expect(a.chat.getSnapshot().link).toBe("offline");
    a.chat.network(true);
    await vi.waitFor(() => expect(a.chat.getSnapshot().link).toBe("connected"));
    a.chat.disconnect();
    a.chat.network(false);
    a.chat.network(true);
    expect(a.chat.getSnapshot().link).toBe("disconnected");
  });
  it("stops after bounded failures and allows a manual retry without resetting the alias", async () => {
    const h = harness(),
      a = h.client();
    await a.chat.enter("Alice");
    h.fail();
    a.chat.connect();
    expect(a.chat.getSnapshot().link).toBe("reconnecting");
    for (const delay of [2000, 5000, 10_000]) {
      h.fail();
      h.setTime(h.time() + delay);
      a.chat.tick();
    }
    expect(a.chat.getSnapshot().link).toBe("failed");
    expect(a.chat.getSnapshot().connectionWanted).toBe(false);
    expect(a.chat.getSnapshot().alias).toBe("Alice");
    expect(h.connects).toHaveLength(4);
    h.setTime(h.time() + 100_000);
    a.chat.tick();
    expect(h.connects).toHaveLength(4);
    a.chat.reconnect();
    await vi.waitFor(() => expect(a.chat.getSnapshot().link).toBe("connected"));
    expect(a.chat.getSnapshot().connectionWanted).toBe(true);
    expect(a.chat.getSnapshot().alias).toBe("Alice");
  });
  it("never appends or sends an in-flight message after Leave", async () => {
    const h = harness(),
      { b } = await pair(h),
      before = h.logs.length;
    const sending = b.chat.send("abandoned");
    b.chat.leave();
    await sending;
    expect(b.chat.getSnapshot().lines).toEqual([]);
    expect(b.chat.getSnapshot().alias).toBeNull();
    expect(h.logs).toHaveLength(before);
  });
  it("does not send a message if the conversation ends during encryption", async () => {
    const h = harness(),
      { b } = await pair(h),
      before = h.logs.length;
    const sending = b.chat.send("abandoned");
    b.chat.endConversation();
    await sending;
    expect(b.chat.getSnapshot().lines).toEqual([]);
    // The final control waits behind the interrupted ratchet operation.
    await vi.waitFor(() => expect(h.logs.slice(before)).toHaveLength(1));
  });
  it("does not retain a newly generated identity if Leave happened during generation", async () => {
    const h = harness(),
      a = h.client();
    const entering = a.chat.enter("Alice");
    a.chat.leave();
    await entering;
    expect(a.chat.getSnapshot().keyReady).toBe(false);
  });
  it("revokes copied room invitations and pending requests immediately on opt-out", async () => {
    const h = harness(),
      a = h.client(),
      b = h.client();
    await ready(a.chat, "Alice");
    await ready(b.chat, "Bob");
    await a.chat.joinRoom();
    a.chat.setAvailable(true);
    await vi.waitFor(() =>
      expect(a.chat.getSnapshot().presence).toBe("online"),
    );
    const token = inviteToken(a.chat.getSnapshot().invite!);
    await b.chat.requestChat(token);
    await vi.waitFor(() =>
      expect(a.chat.getSnapshot().requests).toHaveLength(1),
    );
    const requestId = a.chat.getSnapshot().requests[0].packet.id;
    a.chat.setAvailable(false);
    expect(a.chat.getSnapshot().invite).toBeNull();
    expect(a.chat.getSnapshot().requests).toEqual([]);
    await a.chat.acceptRequest(requestId);
    expect(a.chat.getSnapshot().contact).toBeNull();
    b.chat.endConversation();
    await b.chat.requestChat(token);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(a.chat.getSnapshot().requests).toEqual([]);
    a.chat.setAvailable(true);
    await vi.waitFor(() =>
      expect(a.chat.getSnapshot().presence).toBe("online"),
    );
    expect(inviteToken(a.chat.getSnapshot().invite!)).not.toBe(token);
  });
  it("does not query a global directory and isolates rooms even with the same alias", async () => {
    const h = harness(),
      a = h.client(),
      b = h.client();
    const list = vi.spyOn(h.directory, "list");
    a.chat.setDiscover(true);
    expect(list).not.toHaveBeenCalled();
    await ready(a.chat, "Alice");
    await ready(b.chat, "Alice");
    await a.chat.joinRoom();
    await b.chat.joinRoom();
    a.chat.setAvailable(true);
    await vi.waitFor(() =>
      expect(a.chat.getSnapshot().presence).toBe("online"),
    );
    b.chat.setDiscover(true);
    await vi.waitFor(() =>
      expect(b.chat.getSnapshot().directory).toBe("ready"),
    );
    expect(b.chat.getSnapshot().peers).toEqual([]);
    await b.chat.joinRoom(a.chat.getSnapshot().room!.token);
    await vi.waitFor(() => expect(b.chat.getSnapshot().peers).toHaveLength(1));
    b.chat.leaveRoom();
    expect(b.chat.getSnapshot().peers).toEqual([]);
    expect(b.chat.getSnapshot().room).toBeNull();
  });
  it("requires a real round trip and ignores stale probe echoes after disconnect", async () => {
    const h = harness(),
      a = h.client();
    await a.chat.enter("Alice");
    h.drop(a.address);
    a.chat.connect();
    expect(a.chat.getSnapshot().link).toBe("checking");
    expect(await a.chat.makeInvite()).toBeNull();
    await vi.waitFor(() => expect(h.logs).toHaveLength(1));
    const echo = h.logs[0].bytes,
      listener = a.listeners[0];
    a.chat.disconnect();
    listener({ type: "bytes", bytes: echo });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(a.chat.getSnapshot().link).toBe("disconnected");
  });
  it("detects a silent Nym outage and withdraws presence before reconnecting", async () => {
    const h = harness(),
      a = h.client();
    await ready(a.chat, "Alice");
    await a.chat.joinRoom();
    a.chat.setAvailable(true);
    await vi.waitFor(() =>
      expect(a.chat.getSnapshot().presence).toBe("online"),
    );
    h.drop(a.address);
    h.setTime(h.time() + ROUTE_CHECK_INTERVAL_MS);
    a.chat.tick();
    h.setTime(h.time() + ROUTE_CHECK_TIMEOUT_MS);
    a.chat.tick();
    expect(a.chat.getSnapshot().link).toBe("reconnecting");
    expect(a.chat.getSnapshot().availableUntil).toBeNull();
    expect(a.chat.getSnapshot().invite).toBeNull();
    h.drop("");
    h.setTime(h.time() + 2000);
    a.chat.tick();
    await vi.waitFor(() => expect(a.chat.getSnapshot().link).toBe("connected"));
    expect(a.chat.getSnapshot().presence).toBe("off");
  });
});

describe("fail-closed reconnect regressions", () => {
  it("keeps the switch intent on while offline and cancels recovery when switched off", async () => {
    const h = harness(),
      a = h.client();
    await ready(a.chat, "Alice");
    a.chat.network(false);
    expect(a.chat.getSnapshot().connectionWanted).toBe(true);
    a.chat.disconnect();
    expect(a.chat.getSnapshot().connectionWanted).toBe(false);
    a.chat.network(true);
    h.setTime(h.time() + 120_000);
    a.chat.tick();
    expect(h.connects).toHaveLength(1);
    expect(a.chat.getSnapshot().link).toBe("disconnected");
  });
  it("resumes both directions even when a peer check was lost before reconnection", async () => {
    const h = harness(),
      { a, b } = await pair(h);
    b.chat.network(false);
    await a.chat.checkPeer();
    expect(a.chat.getSnapshot().contact?.ready).toBe(false);
    b.chat.network(true);
    await vi.waitFor(() => {
      expect(a.chat.getSnapshot().contact?.ready).toBe(true);
      expect(b.chat.getSnapshot().contact?.ready).toBe(true);
    });
    await a.chat.send("after recovery");
    await vi.waitFor(() =>
      expect(a.chat.getSnapshot().lines.at(-1)?.delivery).toBe("delivered"),
    );
  });
  it("does not query Discover while disconnected or apply a response from an old connection", async () => {
    const h = harness(),
      a = h.client(),
      list = vi.spyOn(h.directory, "list");
    await a.chat.enter("Alice");
    await a.chat.joinRoom();
    a.chat.setDiscover(true);
    expect(list).not.toHaveBeenCalled();
    let resolve!: (v: []) => void;
    list.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    a.chat.connect();
    await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    a.chat.network(false);
    resolve([]);
    await Promise.resolve();
    await Promise.resolve();
    expect(a.chat.getSnapshot().directory).toBe("idle");
    expect(a.chat.getSnapshot().peers).toEqual([]);
    h.setTime(h.time() + 60_000);
    a.chat.tick();
    expect(list).toHaveBeenCalledTimes(1);
  });
});

it("removes an expired presence locally even while the next directory lookup is pending", async () => {
  const h = harness(),
    a = h.client(),
    b = h.client();
  await ready(a.chat, "Alice");
  await ready(b.chat, "Bob");
  await a.chat.joinRoom();
  await b.chat.joinRoom(a.chat.getSnapshot().room!.token);
  a.chat.setAvailable(true);
  await vi.waitFor(() => expect(a.chat.getSnapshot().presence).toBe("online"));
  b.chat.setDiscover(true);
  await vi.waitFor(() => expect(b.chat.getSnapshot().peers).toHaveLength(1));
  vi.spyOn(h.directory, "list").mockImplementation(() => new Promise(() => {}));
  h.setTime(h.time() + 120_000);
  b.chat.tick();
  expect(b.chat.getSnapshot().peers).toEqual([]);
});


async function addPeer(h: ReturnType<typeof harness>, host: ChatController, name: string) {
  const peer = h.client();
  await ready(peer.chat, name);
  const invite = await host.makeInvite();
  expect(invite).not.toBeNull();
  expect(await peer.chat.requestChat(inviteToken(invite!))).toBe(true);
  await vi.waitFor(() => expect(host.getSnapshot().requests).toHaveLength(1));
  await host.acceptRequest(host.getSnapshot().requests[0].packet.id);
  await vi.waitFor(() => expect(peer.chat.getSnapshot().contact?.ready).toBe(true));
  await vi.waitFor(() => expect(host.getSnapshot().contact?.ready).toBe(true));
  return peer;
}

describe("multiple independent conversations", () => {
  it("keeps two accepted chats, messages and unread counts separate on one connection", async () => {
    const h = harness(), { a, b } = await pair(h);
    const bob = a.chat.getSnapshot().activeConversationId!;
    const c = await addPeer(h, a.chat, "Carol");
    const carol = a.chat.getSnapshot().activeConversationId!;
    expect(bob).not.toBe(carol);
    expect(h.connects).toHaveLength(3);
    await b.chat.send("Only Alice and Bob");
    await c.chat.send("Only Alice and Carol");
    await vi.waitFor(() => expect(a.chat.getSnapshot().conversations.find(c => c.id === bob)?.unread).toBe(1));
    await vi.waitFor(() => expect(a.chat.getSnapshot().lines.map(l => l.body)).toEqual(["Only Alice and Carol"]));
    a.chat.selectConversation(bob);
    expect(a.chat.getSnapshot().lines.map(l => l.body)).toEqual(["Only Alice and Bob"]);
    expect(a.chat.getSnapshot().conversations.find(c => c.id === bob)?.unread).toBe(0);
    await a.chat.send("Reply to Bob");
    await vi.waitFor(() => expect(b.chat.getSnapshot().lines.at(-1)?.body).toBe("Reply to Bob"));
    expect(c.chat.getSnapshot().lines).toHaveLength(1);
    a.chat.setConversationVisible(false);
    await b.chat.send("While viewing Discover");
    await vi.waitFor(() => expect(a.chat.getSnapshot().conversations.find(c => c.id === bob)?.unread).toBe(1));
    a.chat.setConversationVisible(true);
    expect(a.chat.getSnapshot().conversations.find(c => c.id === bob)?.unread).toBe(0);
  });

  it("never redirects an asynchronous send when the user switches conversations", async () => {
    const h = harness(), { a, b } = await pair(h);
    const bob = a.chat.getSnapshot().activeConversationId!;
    const c = await addPeer(h, a.chat, "Carol");
    const carol = a.chat.getSnapshot().activeConversationId!;
    const original = envelope.sealEnvelope;
    let release: (() => void) | undefined;
    vi.spyOn(envelope, "sealEnvelope").mockImplementation(async input => {
      if (input.plaintext.t === "ratchet" && input.plaintext.c === bob &&
          input.senderPublicKey === b.chat.getSnapshot().contact!.publicKey) {
        await new Promise<void>(resolve => { release = resolve; });
      }
      return original(input);
    });
    a.chat.selectConversation(bob);
    const sending = a.chat.send("For Bob, even after switching");
    await vi.waitFor(() => expect(release).toBeDefined());
    a.chat.selectConversation(carol);
    expect(a.chat.getSnapshot().sending).toBe(false);
    await a.chat.send("For Carol");
    release!();
    expect(await sending).toBe(true);
    await vi.waitFor(() => expect(b.chat.getSnapshot().lines[0]?.body).toBe("For Bob, even after switching"));
    await vi.waitFor(() => expect(c.chat.getSnapshot().lines[0]?.body).toBe("For Carol"));
    await vi.waitFor(() => expect(a.chat.getSnapshot().lines[0]?.delivery).toBe("delivered"));
    a.chat.selectConversation(bob);
    await vi.waitFor(() => expect(a.chat.getSnapshot().lines[0]?.delivery).toBe("delivered"));
    expect(a.chat.getSnapshot().sending).toBe(false);
  });

  it("rejects cross-conversation ciphertext even with authentic sender keys", async () => {
    const h = harness(), { a, b } = await pair(h);
    const bob = a.chat.getSnapshot().activeConversationId!;
    const c = await addPeer(h, a.chat, "Carol");
    const carol = a.chat.getSnapshot().activeConversationId!;
    const spy = vi.spyOn(envelope, "sealEnvelope");
    await b.chat.send("Bob ciphertext");
    await c.chat.send("Carol ciphertext");
    await vi.waitFor(() => expect(a.chat.getSnapshot().lines).toHaveLength(1));
    const captures = spy.mock.calls.map(([input]) => input);
    const fromBob = captures.find(input => input.plaintext.t === "ratchet" && input.plaintext.c === bob && input.recipientPublicKey === b.chat.getSnapshot().contact!.publicKey)!;
    const fromCarol = captures.find(input => input.plaintext.t === "ratchet" && input.plaintext.c === carol && input.recipientPublicKey === c.chat.getSnapshot().contact!.publicKey)!;
    expect(fromBob.plaintext.t).toBe("ratchet");
    if (fromBob.plaintext.t !== "ratchet") throw new Error("missing ciphertext");
    for (const sender of [fromBob, fromCarol]) {
      const forged = await envelope.sealEnvelope({ ...sender, plaintext: { ...fromBob.plaintext, c: carol } });
      a.listeners.at(-1)!({ type: "bytes", bytes: forged! });
    }
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(a.chat.getSnapshot().lines.map(l => l.body)).toEqual(["Carol ciphertext"]);
    a.chat.selectConversation(bob);
    expect(a.chat.getSnapshot().lines.map(l => l.body)).toEqual(["Bob ciphertext"]);
    await b.chat.send("Bob still works");
    await c.chat.send("Carol still works");
    await vi.waitFor(() => expect(a.chat.getSnapshot().lines.at(-1)?.body).toBe("Bob still works"));
    a.chat.selectConversation(carol);
    await vi.waitFor(() => expect(a.chat.getSnapshot().lines.at(-1)?.body).toBe("Carol still works"));
  });

  it("rechecks every peer on a new Nym route and preserves all histories", async () => {
    const h = harness(), { a, b } = await pair(h);
    const bob = a.chat.getSnapshot().activeConversationId!;
    const c = await addPeer(h, a.chat, "Carol");
    const carol = a.chat.getSnapshot().activeConversationId!;
    await c.chat.send("Before reconnect");
    await vi.waitFor(() => expect(a.chat.getSnapshot().lines).toHaveLength(1));
    a.chat.selectConversation(null);
    a.chat.network(false);
    expect(a.chat.getSnapshot().conversations.every(c => !c.ready)).toBe(true);
    a.rotateAddress();
    a.chat.network(true);
    await vi.waitFor(() => expect(a.chat.getSnapshot().conversations.every(c => c.ready)).toBe(true));
    expect(h.connects).toHaveLength(4);
    await b.chat.send("Bob reconnected");
    await c.chat.send("Carol reconnected");
    a.chat.selectConversation(carol);
    await vi.waitFor(() => expect(a.chat.getSnapshot().lines.map(l => l.body)).toEqual(["Before reconnect", "Carol reconnected"]));
    a.chat.selectConversation(bob);
    await vi.waitFor(() => expect(a.chat.getSnapshot().lines[0]?.body).toBe("Bob reconnected"));
  });

  it("ending one chat leaves another active, and leaving clears every chat", async () => {
    const h = harness(), { a, b } = await pair(h);
    const bob = a.chat.getSnapshot().activeConversationId!;
    const c = await addPeer(h, a.chat, "Carol");
    const carol = a.chat.getSnapshot().activeConversationId!;
    // The confirmation targets Bob even if Carol became selected meanwhile.
    a.chat.endConversation(bob);
    await vi.waitFor(() => expect(b.chat.getSnapshot().contact?.status).toBe("ended"));
    expect(a.chat.getSnapshot().conversations.map(c => c.id)).toEqual([carol]);
    expect(a.chat.getSnapshot().activeConversationId).toBe(carol);
    a.chat.selectConversation(carol);
    expect(await a.chat.send("Still here, Carol")).toBe(true);
    await vi.waitFor(() => expect(c.chat.getSnapshot().lines[0]?.body).toBe("Still here, Carol"));
    a.chat.leave();
    expect(a.chat.getSnapshot()).toMatchObject({ conversations: [], activeConversationId: null, lines: [], keyReady: false });
    expect(await a.chat.send("Must not send")).toBe(false);
  });

  it("bounds open chats, refuses duplicate peers and recovers capacity after expiration", async () => {
    const h = harness(), { a, b } = await pair(h);
    const bob = a.chat.getSnapshot().activeConversationId!;
    const duplicate = await b.chat.makeInvite();
    expect(await a.chat.requestChat(inviteToken(duplicate!))).toBe(false);
    expect(a.chat.getSnapshot().conversations).toHaveLength(1);
    for (let i = 1; i < MAX_CONVERSATIONS; i++) {
      const peer = h.client();
      await ready(peer.chat, `Peer ${i}`);
      expect(await a.chat.requestChat(inviteToken((await peer.chat.makeInvite())!))).toBe(true);
    }
    expect(a.chat.getSnapshot().canStartConversation).toBe(false);
    expect(await a.chat.makeInvite()).toBeNull();
    const extra = h.client();
    await ready(extra.chat, "Extra peer");
    expect(await a.chat.requestChat(inviteToken((await extra.chat.makeInvite())!))).toBe(false);
    h.setTime(h.time() + INVITE_TTL_MS);
    a.chat.tick();
    expect(a.chat.getSnapshot().conversations.map(c => c.id)).toEqual([bob]);
    expect(a.chat.getSnapshot().canStartConversation).toBe(true);
  });
});

describe("pending chat requests", () => {
  it("keeps the other requests listed after accepting one and answers each later", async () => {
    const h = harness(), a = h.client(), b = h.client(), c = h.client();
    await ready(a.chat, "Alice");
    await ready(b.chat, "Bob");
    await ready(c.chat, "Carol");
    const invite = (await a.chat.makeInvite())!;
    expect(await b.chat.requestChat(inviteToken(invite))).toBe(true);
    expect(await c.chat.requestChat(inviteToken(invite))).toBe(true);
    await vi.waitFor(() => expect(a.chat.getSnapshot().requests).toHaveLength(2));
    const bob = a.chat.getSnapshot().requests.find((item) => item.packet.alias === "Bob")!;
    await a.chat.acceptRequest(bob.packet.id);
    await vi.waitFor(() => expect(b.chat.getSnapshot().contact?.ready).toBe(true));
    expect(a.chat.getSnapshot().requests.map((item) => item.packet.alias)).toEqual(["Carol"]);
    expect(a.chat.getSnapshot().invite).toEqual(invite);
    // A request that arrives during the first chat is listed as well.
    const d = h.client();
    await ready(d.chat, "Dana");
    expect(await d.chat.requestChat(inviteToken(invite))).toBe(true);
    await vi.waitFor(() => expect(a.chat.getSnapshot().requests).toHaveLength(2));
    const carol = a.chat.getSnapshot().requests.find((item) => item.packet.alias === "Carol")!;
    await a.chat.acceptRequest(carol.packet.id);
    await vi.waitFor(() => expect(c.chat.getSnapshot().contact?.ready).toBe(true));
    await vi.waitFor(() => expect(a.chat.getSnapshot().conversations.every((item) => item.ready)).toBe(true));
    expect(a.chat.getSnapshot().conversations.map((item) => item.alias)).toEqual(["Bob", "Carol"]);
    expect(a.chat.getSnapshot().requests.map((item) => item.packet.alias)).toEqual(["Dana"]);
    await a.chat.rejectRequest(a.chat.getSnapshot().requests[0].packet.id);
    await vi.waitFor(() => expect(d.chat.getSnapshot().contact).toBeNull());
    expect(a.chat.getSnapshot().requests).toEqual([]);
    // Expiry clears only what is still pending; the chats stay.
    const e = h.client();
    await ready(e.chat, "Eve");
    expect(await e.chat.requestChat(inviteToken(invite))).toBe(true);
    await vi.waitFor(() => expect(a.chat.getSnapshot().requests).toHaveLength(1));
    h.setTime(invite.expiresAt);
    a.chat.tick();
    expect(a.chat.getSnapshot().invite).toBeNull();
    expect(a.chat.getSnapshot().requests).toEqual([]);
    expect(a.chat.getSnapshot().note).toMatch(/pending requests were cleared/);
    expect(a.chat.getSnapshot().conversations).toHaveLength(2);
  });

  it("answers an existing request instead of sending one back", async () => {
    const h = harness(), a = h.client(), b = h.client();
    await ready(a.chat, "Alice");
    await ready(b.chat, "Bob");
    const fromAlice = (await a.chat.makeInvite())!;
    const fromBob = (await b.chat.makeInvite())!;
    expect(await b.chat.requestChat(inviteToken(fromAlice))).toBe(true);
    await vi.waitFor(() => expect(a.chat.getSnapshot().requests).toHaveLength(1));
    expect(await a.chat.requestChat(inviteToken(fromBob))).toBe(true);
    expect(a.chat.getSnapshot().requests).toEqual([]);
    expect(a.chat.getSnapshot().contact?.role).toBe("inviter");
    await vi.waitFor(() => expect(b.chat.getSnapshot().contact?.ready).toBe(true));
    await vi.waitFor(() => expect(a.chat.getSnapshot().contact?.ready).toBe(true));
    expect(a.chat.getSnapshot().conversations).toHaveLength(1);
    expect(b.chat.getSnapshot().conversations).toHaveLength(1);
    expect(a.chat.getSnapshot().contact?.code).toBe(b.chat.getSnapshot().contact?.code);
  });

  it("resolves requests sent at the same time without leaving both sides waiting", async () => {
    const h = harness(), a = h.client(), b = h.client();
    await ready(a.chat, "Alice");
    await ready(b.chat, "Bob");
    const fromAlice = (await a.chat.makeInvite())!;
    const fromBob = (await b.chat.makeInvite())!;
    const sent = await Promise.all([
      a.chat.requestChat(inviteToken(fromBob)),
      b.chat.requestChat(inviteToken(fromAlice)),
    ]);
    expect(sent).toEqual([true, true]);
    // Either one side yields and lists the other's request, or the late side
    // answered the request it found. Nobody waits for an acceptance that
    // cannot come.
    await vi.waitFor(() => {
      const pending = a.chat.getSnapshot().requests.length + b.chat.getSnapshot().requests.length;
      const active = [a, b].filter((side) => side.chat.getSnapshot().contact?.status === "active").length;
      expect(pending === 1 || active === 2).toBe(true);
    });
    for (const side of [a, b]) {
      const pending = side.chat.getSnapshot().requests[0];
      if (!pending) continue;
      expect(side.chat.getSnapshot().conversations).toHaveLength(0);
      expect(side.chat.getSnapshot().note).toMatch(/also sent you a request/);
      await side.chat.acceptRequest(pending.packet.id);
    }
    await vi.waitFor(() => expect(a.chat.getSnapshot().contact?.ready).toBe(true));
    await vi.waitFor(() => expect(b.chat.getSnapshot().contact?.ready).toBe(true));
    expect(a.chat.getSnapshot().conversations).toHaveLength(1);
    expect(b.chat.getSnapshot().conversations).toHaveLength(1);
    expect(a.chat.getSnapshot().requests).toEqual([]);
    expect(b.chat.getSnapshot().requests).toEqual([]);
  });
});
