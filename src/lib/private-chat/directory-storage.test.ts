import { afterEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DirectoryStorage, PersistentPresenceStore } from "./directory-storage";
import { createDeviceIdentity } from "./identity";
import { createLiveInvite } from "./live-invite";
import { openRoom } from "./discovery-room";
import { presenceCommand, PRESENCE_LEASE_MS } from "./presence";

const address =
  "DguTcdkWWtDyUFLvQxRdcA8qZhardhE1ZXy1YCC7Zfmq.Dxreouj5RhQqMb3ZaAxgXFdGkmfbDKwk457FdeHGKmQQ@4kjgWmFU1tcGAZYRZR57yFuVAexjLbJ5M7jvo3X5Hkcf";
const directories: string[] = [];
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "openzcash-directory-test-"));
  directories.push(root);
  const key = new Uint8Array(randomBytes(32));
  const storage = new DirectoryStorage(join(root, "sealed"), new Uint8Array(key));
  await storage.prepare();
  return { root, key, storage };
}
afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("native directory storage", () => {
  it("keeps the provider identity stable after restart and encrypts owner-only files", async () => {
    const { root, key, storage } = await fixture();
    const first = await storage.identity();
    const identityFile = join(root, "sealed", "identity.sealed");
    const onDisk = await readFile(identityFile);
    expect(onDisk.toString("utf8")).not.toContain(first.publicKey);
    expect((await stat(identityFile)).mode & 0o777).toBe(0o600);
    expect((await stat(join(root, "sealed"))).mode & 0o777).toBe(0o700);
    const restarted = new DirectoryStorage(join(root, "sealed"), new Uint8Array(key));
    await restarted.prepare();
    const second = await restarted.identity();
    expect(second.publicKey).toBe(first.publicKey);
    expect(second.secretKey).toEqual(first.secretKey);
    first.secretKey.fill(0);
    second.secretKey.fill(0);
    storage.destroy();
    restarted.destroy();
    key.fill(0);
  });

  it("pins the native address and refuses silent descriptor rotation after restart", async () => {
    const { root, key, storage } = await fixture();
    const identity = await storage.identity();
    await storage.bindDescriptor(address, identity.publicKey);
    const descriptorPath = join(root, "sealed", "descriptor.json");
    const descriptor = await readFile(descriptorPath, "utf8");
    expect((await stat(descriptorPath)).mode & 0o777).toBe(0o600);
    const binding = await readFile(join(root, "sealed", "binding.sealed"));
    expect(binding.toString("utf8")).not.toContain(address);

    const restarted = new DirectoryStorage(join(root, "sealed"), new Uint8Array(key));
    await restarted.bindDescriptor(address, identity.publicKey);
    await expect(restarted.bindDescriptor(address + "changed", identity.publicKey)).rejects.toThrow("identity changed");
    expect(await readFile(descriptorPath, "utf8")).toBe(descriptor);
    await rm(descriptorPath);
    await restarted.bindDescriptor(address, identity.publicKey);
    expect(await readFile(descriptorPath, "utf8")).toBe(descriptor);

    identity.secretKey.fill(0);
    storage.destroy(); restarted.destroy(); key.fill(0);
  });

  it("detects ciphertext alteration and rejects missing lock launchers", async () => {
    const { root, key, storage } = await fixture();
    await expect(storage.inheritedLock(undefined)).rejects.toThrow();
    await expect(storage.inheritedLock("1")).rejects.toThrow();
    const identity = await storage.identity();
    const path = join(root, "sealed", "identity.sealed");
    const bytes = await readFile(path);
    bytes[bytes.length - 1] ^= 1;
    await writeFile(path, bytes);
    const restarted = new DirectoryStorage(join(root, "sealed"), new Uint8Array(key));
    await expect(restarted.identity()).rejects.toThrow();
    identity.secretKey.fill(0);
    storage.destroy();
    restarted.destroy();
    key.fill(0);
  });

  it("persists original online leases and removals without reviving stale presence", async () => {
    const { root, key, storage } = await fixture();
    const room = (await openRoom())!;
    const person = await createDeviceIdentity();
    const now = Date.now();
    const invite = await createLiveInvite(person, "Alice", address, now);
    const first = await presenceCommand(person, room, invite, "upsert", 1, person);
    const options = { allowedRooms: new Map([[room.id, 1]]) };
    const original = new PersistentPresenceStore(storage, options);
    expect(await original.apply(first, now)).toBe(200);
    const restartedStorage = new DirectoryStorage(join(root, "sealed"), new Uint8Array(key));
    const restarted = new PersistentPresenceStore(restartedStorage, options);
    await restarted.initialize();
    expect(restarted.list(room.id, now + 1)[0].onlineUntil).toBe(now + PRESENCE_LEASE_MS);
    expect(await restarted.apply(await presenceCommand(person, room, invite, "remove", 2), now + 2)).toBe(200);
    const finalStorage = new DirectoryStorage(join(root, "sealed"), new Uint8Array(key));
    const final = new PersistentPresenceStore(finalStorage, options);
    await final.initialize();
    expect(final.list(room.id, now + 3)).toEqual([]);
    expect(await final.apply(first, now + 4)).toBe(409);
    const presenceFile = join(root, "sealed", "presence.sealed");
    expect((await readFile(presenceFile)).toString("utf8")).not.toContain("Alice");
    expect((await stat(presenceFile)).mode & 0o777).toBe(0o600);
    storage.destroy();
    restartedStorage.destroy();
    finalStorage.destroy();
    key.fill(0);
  });
});
