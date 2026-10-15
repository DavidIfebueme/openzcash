import { afterEach, describe, expect, it, vi } from "vitest";
import { NymDirectory } from "./nym-directory";
import { DirectoryProvider } from "./directory-provider";
import { createDeviceIdentity } from "./identity";
import { openRoom, signRoomOperation, type DiscoveryRoom } from "./discovery-room";
import { createLiveInvite } from "./live-invite";
import { openPresence, presenceCommand } from "./presence";
import { messageId } from "./messages";
import {
  DIRECTORY_REQUEST,
  DIRECTORY_RESPONSE,
  DIRECTORY_TIMEOUT_MS,
  directoryRoomProofBody,
  openDirectory,
  sealDirectory,
} from "./directory-wire";
const address =
  "DguTcdkWWtDyUFLvQxRdcA8qZhardhE1ZXy1YCC7Zfmq.Dxreouj5RhQqMb3ZaAxgXFdGkmfbDKwk457FdeHGKmQQ@4kjgWmFU1tcGAZYRZR57yFuVAexjLbJ5M7jvo3X5Hkcf";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function setup() {
  const identity = await createDeviceIdentity(),
    provider = new DirectoryProvider(identity);
  const sent: Array<{ id: string; recipient: string; bytes: Uint8Array; anonymous?: boolean }> = [];
  const rooms = new Map<string, DiscoveryRoom>();
  let online = true,
    drop = false;
  const client = new NymDirectory(
    { address, publicKey: identity.publicKey, replyMode: "address" },
    (input) => {
      sent.push(input);
      if (!drop)
        void provider
          .handle(input.bytes)
          .then((reply) => reply && client.receive(reply.bytes));
    },
    () => online,
    () => address,
    (id) => rooms.get(id)?.authSecret ?? null,
  );
  const fetch = vi.fn(() => {
    throw new Error("Direct HTTP forbidden");
  });
  vi.stubGlobal("fetch", fetch);
  return {
    client,
    identity,
    provider,
    sent,
    register: (room: DiscoveryRoom) => rooms.set(room.id, room),
    unregister: (room: DiscoveryRoom) => rooms.delete(room.id),
    fetch,
    offline: () => {
      online = false;
      client.close();
    },
    drop: () => {
      drop = true;
    },
  };
}
async function directoryRequest(
  providerKey: string,
  room: DiscoveryRoom,
  body: unknown,
  replyMode: "address" | "surb" = "address",
  authenticated = true,
) {
  const sender = await createDeviceIdentity();
  const request = {
    v: 1 as const,
    id: messageId(),
    at: Date.now(),
    ...(replyMode === "address" ? { replyTo: address } : {}),
    body,
  };
  return sealDirectory(
    DIRECTORY_REQUEST,
    {
      ...request,
      ...(authenticated
        ? { roomProof: await signRoomOperation(room.authSecret, directoryRoomProofBody(request)) }
        : {}),
    },
    sender,
    providerKey,
  );
}
describe("Discover only through Nym", () => {
  it("publishes, lists and removes encrypted entries through encrypted Nym messages, never HTTP", async () => {
    const h = await setup(),
      room = (await openRoom())!,
      person = await createDeviceIdentity();
    h.register(room);
    const invite = await createLiveInvite(person, "Alice", address);
    await h.client.publish(
      await presenceCommand(person, room, invite, "upsert", 1, person),
    );
    const entries = await h.client.list(room.id);
    expect(entries).toHaveLength(1);
    expect((await openPresence(room, entries[0], Date.now()))?.alias).toBe(
      "Alice",
    );
    await h.client.publish(
      await presenceCommand(person, room, invite, "remove", 2),
    );
    expect(await h.client.list(room.id)).toEqual([]);
    expect(h.fetch).not.toHaveBeenCalled();
    expect(
      h.sent.every((p) => p.recipient === address && p.bytes.length === 4169),
    ).toBe(true);
    const opened = await openDirectory(
      h.sent[1].bytes,
      DIRECTORY_REQUEST,
      h.identity.secretKey,
    );
    expect(JSON.stringify(opened?.value)).not.toContain(room.token);
    expect(JSON.stringify(opened?.value)).not.toContain(person.publicKey);
    expect((opened?.value as { replyTo: string }).replyTo).toBe(address);
    expect(
      new Set(h.sent.map((p) => Array.from(p.bytes.slice(1, 33)).join())).size,
    ).toBe(h.sent.length);
    h.client.close();
  });
  it("fails closed without a provider or route, and rejects pending work immediately on disconnect", async () => {
    const h = await setup(),
      room = (await openRoom())!;
    h.register(room);
    const disabled = new NymDirectory(
      null,
      vi.fn(),
      () => true,
      () => address,
      () => null,
    );
    await expect(disabled.list(room.id)).rejects.toThrow();
    h.drop();
    const work = h.client.list(room.id);
    const rejected = expect(work).rejects.toThrow("paused");
    await vi.waitFor(() => expect(h.sent).toHaveLength(1));
    const late = await h.provider.handle(h.sent[0].bytes);
    h.offline();
    await rejected;
    if (late) await h.client.receive(late.bytes);
    await expect(h.client.list(room.id)).rejects.toThrow();
    expect(h.sent).toHaveLength(1);
    expect(h.fetch).not.toHaveBeenCalled();
  });
  it("ignores forged provider responses and times out without an HTTP fallback", async () => {
    const h = await setup(),
      room = (await openRoom())!;
    h.register(room);
    h.drop();
    vi.useFakeTimers();
    const work = h.client.list(room.id),
      result = expect(work).rejects.toThrow();
    await vi.waitFor(() => expect(h.sent).toHaveLength(1));
    const request = await openDirectory(
      h.sent[0].bytes,
      DIRECTORY_REQUEST,
      h.identity.secretKey,
    );
    const attacker = await createDeviceIdentity();
    await h.client.receive(
      await sealDirectory(
        DIRECTORY_RESPONSE,
        { v: 1, id: h.sent[0].id, status: 200, entries: [], next: null },
        attacker,
        request!.sender,
      ),
    );
    await vi.advanceTimersByTimeAsync(DIRECTORY_TIMEOUT_MS);
    await result;
    expect(h.fetch).not.toHaveBeenCalled();
    h.client.close();
  });
  it("paginates bounded authenticated results and rejects duplicate or corrupted requests", async () => {
    const h = await setup(),
      room = (await openRoom())!;
    h.register(room);
    for (let i = 0; i < 7; i++) {
      const person = await createDeviceIdentity(),
        invite = await createLiveInvite(person, `User ${i}`, address);
      await h.client.publish(
        await presenceCommand(person, room, invite, "upsert", 1, person),
      );
    }
    expect(await h.client.list(room.id)).toHaveLength(7);
    expect(h.sent).toHaveLength(9);
    expect(await h.provider.handle(h.sent[0].bytes)).toBeNull();
    const corrupt = new Uint8Array(h.sent[0].bytes);
    corrupt[100] ^= 1;
    expect(await h.provider.handle(corrupt)).toBeNull();
    expect(await h.provider.handle(new Uint8Array(100000))).toBeNull();
    h.client.close();
  });
  it("fits a full 50-person room into bounded six-entry Nym response pages", async () => {
    const h = await setup();
    const room = (await openRoom())!;
    h.register(room);
    for (let index = 0; index < 50; index++) {
      const person = await createDeviceIdentity();
      const invite = await createLiveInvite(person, `Participant ${index}`, address);
      await h.client.publish(await presenceCommand(person, room, invite, "upsert", 1, person));
    }
    expect(await h.client.list(room.id)).toHaveLength(50);
    expect(h.sent).toHaveLength(59);
    h.client.close();
  });
  it("rejects unauthenticated and disallowed rooms before consuming valid quota", async () => {
    const identity = await createDeviceIdentity();
    const room = (await openRoom())!;
    const outsider = (await openRoom())!;
    const provider = new DirectoryProvider(identity, Date.now, {
      allowedRooms: new Map([[room.id, 1]]),
      maxRequestsPerMinute: 1,
      maxPerRoomPerMinute: 1,
    });
    const list = (id: string) => ({ op: "list", room: id, after: null });
    for (let i = 0; i < 100; i++)
      expect(await provider.handle(new Uint8Array(99))).toBeNull();
    expect(await provider.handle(await directoryRequest(identity.publicKey, room, list(room.id), "address", false))).toBeNull();
    expect(await provider.handle(await directoryRequest(identity.publicKey, outsider, list(outsider.id)))).toBeNull();
    expect(await provider.handle(await directoryRequest(identity.publicKey, room, list(room.id)))).not.toBeNull();
  });
  it("reserves a fair budget per room and does not charge invalid signed publishes", async () => {
    const identity = await createDeviceIdentity();
    const first = (await openRoom())!;
    const second = (await openRoom())!;
    const provider = new DirectoryProvider(identity, Date.now, {
      allowedRooms: new Map([[first.id, 2], [second.id, 2]]),
      maxRequestsPerMinute: 4,
      maxPerRoomPerMinute: 2,
    });
    const person = await createDeviceIdentity();
    const invite = await createLiveInvite(person, "Alice", address);
    const command = await presenceCommand(person, first, invite, "upsert", 1, person);
    const invalid = { ...command, signature: command.roomProof };
    expect(await provider.handle(await directoryRequest(identity.publicKey, first, invalid))).not.toBeNull();
    const list = (room: DiscoveryRoom) => directoryRequest(identity.publicKey, room, { op: "list", room: room.id, after: null });
    expect(await provider.handle(await list(first))).not.toBeNull();
    expect(await provider.handle(await list(first))).not.toBeNull();
    expect(await provider.handle(await list(first))).toBeNull();
    expect(await provider.handle(await list(second))).not.toBeNull();
  });
  it("requires a native SURB and never accepts a payload return address in SURB mode", async () => {
    const identity = await createDeviceIdentity();
    const room = (await openRoom())!;
    const provider = new DirectoryProvider(identity, Date.now, {
      replyMode: "surb",
      allowedRooms: new Map([[room.id, 1]]),
    });
    const body = { op: "list", room: room.id, after: null };
    const anonymous = await directoryRequest(identity.publicKey, room, body, "surb");
    expect(await provider.handle(anonymous)).toBeNull();
    const tag = crypto.getRandomValues(new Uint8Array(16));
    const reply = await provider.handle(anonymous, tag);
    expect(reply).toMatchObject({ replyTag: tag });
    expect(reply && "recipient" in reply).toBe(false);
    expect(await provider.handle(await directoryRequest(identity.publicKey, room, body), tag)).toBeNull();
  });
  it("sends browser Discover requests anonymously without exposing a reply address", async () => {
    const identity = await createDeviceIdentity();
    const room = (await openRoom())!;
    const provider = new DirectoryProvider(identity, Date.now, {
      replyMode: "surb",
      allowedRooms: new Map([[room.id, 1]]),
    });
    const sent: Array<{ bytes: Uint8Array; anonymous?: boolean }> = [];
    const client = new NymDirectory(
      { address, publicKey: identity.publicKey, replyMode: "surb" },
      (input) => {
        sent.push(input);
        void provider.handle(input.bytes, crypto.getRandomValues(new Uint8Array(16)))
          .then((reply) => reply && client.receive(reply.bytes));
      },
      () => true,
      () => null,
      (id) => id === room.id ? room.authSecret : null,
    );
    expect(await client.list(room.id)).toEqual([]);
    expect(sent[0].anonymous).toBe(true);
    const opened = await openDirectory(sent[0].bytes, DIRECTORY_REQUEST, identity.secretKey);
    expect(opened?.value).not.toHaveProperty("replyTo");
    client.close();
  });
  it("can deliver a signed removal after leaving without allowing stale list requests", async () => {
    const h = await setup();
    const room = (await openRoom())!;
    const person = await createDeviceIdentity();
    h.register(room);
    const invite = await createLiveInvite(person, "Alice", address);
    await h.client.publish(await presenceCommand(person, room, invite, "upsert", 1, person));
    const remove = await presenceCommand(person, room, invite, "remove", 2);
    h.unregister(room);
    await h.client.publish(remove);
    await expect(h.client.list(room.id)).rejects.toThrow("authorization");
  });
});
