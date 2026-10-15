import { describe, expect, it } from "vitest";
import { createDeviceIdentity, sodiumReady } from "./identity";
import { createLiveInvite, inviteToken, sign } from "./live-invite";
import {
  presenceCommand,
  presenceBody,
  presenceRoomBody,
  openPresence,
  PRESENCE_LEASE_MS,
} from "./presence";
import { PresenceStore } from "./presence-store";
import { openRoom, signRoomOperation } from "./discovery-room";
import { encodeKey } from "./keys";
const address =
  "DguTcdkWWtDyUFLvQxRdcA8qZhardhE1ZXy1YCC7Zfmq.Dxreouj5RhQqMb3ZaAxgXFdGkmfbDKwk457FdeHGKmQQ@4kjgWmFU1tcGAZYRZR57yFuVAexjLbJ5M7jvo3X5Hkcf";
describe("private room presence", () => {
  async function setup() {
    const room = (await openRoom())!,
      alice = await createDeviceIdentity(),
      owner = await createDeviceIdentity();
    const invite = await createLiveInvite(alice, "Alice", address, 100_000);
    return { room, alice, owner, invite, store: new PresenceStore() };
  }
  it("seals participant details with a separate room key and signing identity", async () => {
    const { room, alice, owner, invite, store } = await setup();
    const command = await presenceCommand(owner, room, invite, "upsert", 1, alice);
    const wire = JSON.stringify(command);
    for (const secret of [
      "Alice",
      address,
      alice.publicKey,
      alice.signingKey,
      inviteToken(invite),
      room.token,
    ])
      expect(wire).not.toContain(secret);
    expect(await store.apply(command, 100_000)).toBe(200);
    const entry = store.list(room.id, 100_000)[0];
    expect(await openPresence(room, entry, 100_001)).toEqual(invite);
    const sameRoom = (await openRoom(room.token))!;
    expect(await openPresence(sameRoom, entry, 100_001)).toEqual(invite);
    const other = (await openRoom())!;
    expect(store.list(other.id, 100_000)).toEqual([]);
    expect(
      await openPresence({ ...other, id: room.id }, entry, 100_001),
    ).toBeNull();
    // A validly signed but modified ciphertext still fails authenticated decryption.
    const altered = {
      ...command,
      sealed: (command.sealed[0] === "A" ? "B" : "A") + command.sealed.slice(1),
    };
    altered.signature = await sign(owner, presenceBody(altered));
    expect(
      await openPresence(room, { ...altered, onlineUntil: 140_000 }, 100_001),
    ).toBeNull();
    expect(await openRoom("ozroom2.bad")).toBeNull();
  });
  it("expires leases, verifies ownership and prevents late heartbeat resurrection", async () => {
    const { room, alice, owner, invite, store } = await setup();
    const first = await presenceCommand(owner, room, invite, "upsert", 1, alice);
    expect(await store.apply(first, 100_000)).toBe(200);
    expect(store.list(room.id, 100_000)[0].onlineUntil).toBe(
      100_000 + PRESENCE_LEASE_MS,
    );
    const impostor = await createDeviceIdentity();
    const forged = await presenceCommand(impostor, room, invite, "remove", 2);
    forged.owner = owner.signingKey;
    expect(await store.apply(forged, 100_001)).toBe(403);
    expect(store.list(room.id, 220_000)).toEqual([]);
    expect(
      await store.apply(
        await presenceCommand(owner, room, invite, "upsert", 2, alice),
        150_000,
      ),
    ).toBe(200);
    expect(
      await store.apply(
        await presenceCommand(owner, room, invite, "remove", 4),
        150_001,
      ),
    ).toBe(200);
    expect(
      await store.apply(
        await presenceCommand(owner, room, invite, "upsert", 3, alice),
        150_002,
      ),
    ).toBe(409);
    expect(store.list(room.id, 150_002)).toEqual([]);
    expect(await store.apply(first, invite.expiresAt)).toBe(403);
  });
  it("rejects malformed envelopes and leases beyond the bounded lifetime", async () => {
    const { room, alice, owner, invite, store } = await setup();
    const oversizedLease = await presenceCommand(
      owner,
      room,
      { ...invite, expiresAt: invite.expiresAt + 100_000 },
      "upsert",
      1,
      alice,
    );
    expect(await store.apply(oversizedLease, 100_000)).toBe(403);
    expect(
      await store.apply({ op: "upsert", invite: "plaintext" }, 100_000),
    ).toBe(400);
    expect(
      await store.apply(
        {
          ...(await presenceCommand(owner, room, invite, "upsert", 1, alice)),
          sealed: "x",
        },
        100_000,
      ),
    ).toBe(400);
  });
  it("requires the invite issuer to authorize the exact room and publisher", async () => {
    const { room, alice, owner, invite, store } = await setup();
    await expect(
      presenceCommand(owner, room, invite, "upsert", 1),
    ).rejects.toThrow("issuer");
    const allowed = await presenceCommand(owner, room, invite, "upsert", 1, alice);
    const other = await createDeviceIdentity();
    expect(await store.apply(allowed, 100_000)).toBe(200);
    const wrongOwner = { ...allowed, owner: other.signingKey };
    expect(await store.apply(wrongOwner, 100_001)).toBe(403);
    const otherRoom = (await openRoom())!;
    expect(await store.apply({ ...allowed, room: otherRoom.id }, 100_001)).toBe(403);
  });
  it("does not display a copied invitation republished under another owner", async () => {
    const { room, alice, owner, invite, store } = await setup();
    const allowed = await presenceCommand(owner, room, invite, "upsert", 1, alice);
    const attacker = await createDeviceIdentity();
    const own = await presenceCommand(attacker, room, invite, "upsert", 1, alice);
    const stolenGrant = allowed.grant;
    const sodium = await sodiumReady();
    const padded = new Uint8Array(1408);
    const payload = new TextEncoder().encode(inviteToken(invite));
    new DataView(padded.buffer).setUint16(0, payload.length);
    padded.set(payload, 2);
    const nonce = crypto.getRandomValues(new Uint8Array(24));
    const metadata = JSON.stringify({
      op: own.op, room: own.room, owner: own.owner,
      expiresAt: own.expiresAt, revision: own.revision, grant: stolenGrant,
    });
    const cipher = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(padded, metadata, null, nonce, room.key);
    const sealed = new Uint8Array(nonce.length + cipher.length);
    sealed.set(nonce);
    sealed.set(cipher, nonce.length);
    padded.fill(0);
    payload.fill(0);
    const body = { ...own, grant: stolenGrant, sealed: encodeKey(sealed) };
    body.signature = await sign(attacker, presenceBody(body));
    body.roomProof = await signRoomOperation(room.authSecret, presenceRoomBody(body));
    expect(await store.apply(body, 100_000)).toBe(200);
    expect(await openPresence(room, store.list(room.id, 100_001)[0], 100_001)).toBeNull();
  });
  it("restores verified leases and tombstones without extending them", async () => {
    const { room, alice, owner, invite, store } = await setup();
    const first = await presenceCommand(owner, room, invite, "upsert", 1, alice);
    expect(await store.apply(first, 100_000)).toBe(200);
    const snapshot = store.snapshot(100_001);
    const restored = new PresenceStore({ allowedRooms: new Map([[room.id, 1]]) });
    await restored.restore(snapshot, 100_002);
    expect(restored.list(room.id, 100_002)[0].onlineUntil).toBe(100_000 + PRESENCE_LEASE_MS);
    expect(restored.list(room.id, 100_000 + PRESENCE_LEASE_MS)).toEqual([]);
    expect(await store.apply(await presenceCommand(owner, room, invite, "remove", 2), 100_010)).toBe(200);
    const tombstone = store.snapshot(100_011);
    await restored.restore(tombstone, 100_012);
    expect(await restored.apply(first, 100_013)).toBe(409);
    expect(restored.list(room.id, 100_013)).toEqual([]);
  });
  it("rejects forged snapshots, lease extension and disallowed rooms atomically", async () => {
    const { room, alice, owner, invite, store } = await setup();
    const command = await presenceCommand(owner, room, invite, "upsert", 1, alice);
    expect(await store.apply(command, 100_000)).toBe(200);
    const snapshot = store.snapshot(100_001);
    const target = new PresenceStore({ allowedRooms: new Map([[room.id, 1]]) });
    await target.restore(snapshot, 100_002);
    const extended = structuredClone(snapshot);
    extended.records[0].entry!.onlineUntil += 1;
    await expect(target.restore(extended, 100_003)).rejects.toThrow();
    const forged = structuredClone(snapshot);
    forged.records[0].command.signature = forged.records[0].command.roomProof;
    await expect(target.restore(forged, 100_003)).rejects.toThrow();
    const disallowed = new PresenceStore({ allowedRooms: new Map() });
    await expect(disallowed.restore(snapshot, 100_003)).rejects.toThrow();
    expect(target.list(room.id, 100_003)).toHaveLength(1);
  });
  it("frees online slots after departures while bounding retained replay tombstones", async () => {
    const room = (await openRoom())!;
    const store = new PresenceStore({
      allowedRooms: new Map([[room.id, 10]]),
      maxTombstonesPerRoom: 20,
    });
    for (let index = 0; index < 10; index++) {
      const person = await createDeviceIdentity();
      const invite = await createLiveInvite(person, `Old ${index}`, address, 100_000);
      expect(await store.apply(await presenceCommand(person, room, invite, "upsert", 1, person), 100_000)).toBe(200);
      expect(await store.apply(await presenceCommand(person, room, invite, "remove", 2), 100_001)).toBe(200);
    }
    expect(store.list(room.id, 100_002)).toEqual([]);
    for (let index = 0; index < 10; index++) {
      const person = await createDeviceIdentity();
      const invite = await createLiveInvite(person, `New ${index}`, address, 100_002);
      expect(await store.apply(await presenceCommand(person, room, invite, "upsert", 1, person), 100_002)).toBe(200);
    }
    expect(store.list(room.id, 100_003)).toHaveLength(10);
    const person = await createDeviceIdentity();
    const invite = await createLiveInvite(person, "Overflow", address, 100_002);
    expect(await store.apply(await presenceCommand(person, room, invite, "upsert", 1, person), 100_002)).toBe(503);
    const snapshot = store.snapshot(100_003);
    expect(snapshot.records).toHaveLength(20);
    const restored = new PresenceStore({ allowedRooms: new Map([[room.id, 10]]), maxTombstonesPerRoom: 20 });
    await restored.restore(snapshot, 100_004);
    expect(restored.list(room.id, 100_004)).toHaveLength(10);
  });
  it("allows an allowlist change after old signed records expire, but not before", async () => {
    const { room, alice, owner, invite, store } = await setup();
    expect(await store.apply(await presenceCommand(owner, room, invite, "upsert", 1, alice), 100_000)).toBe(200);
    const snapshot = store.snapshot(100_001);
    const removedRoom = new PresenceStore({ allowedRooms: new Map() });
    await expect(removedRoom.restore(snapshot, 100_002)).rejects.toThrow("admitted");
    await removedRoom.restore(snapshot, invite.expiresAt + 1);
    expect(removedRoom.snapshot(invite.expiresAt + 1).records).toEqual([]);
    const tampered = structuredClone(snapshot);
    tampered.records[0].command.signature = tampered.records[0].command.roomProof;
    await expect(removedRoom.restore(tampered, invite.expiresAt + 1)).rejects.toThrow("Invalid");
  });
});
