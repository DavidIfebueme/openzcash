import { afterEach, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DirectoryProvider } from "./directory-provider";
import { DirectoryStorage, PersistentPresenceStore } from "./directory-storage";
import { openRoom, signRoomOperation, type DiscoveryRoom } from "./discovery-room";
import { createDeviceIdentity } from "./identity";
import { createLiveInvite } from "./live-invite";
import { directoryRoomProofBody, openDirectory, sealDirectory } from "./directory-wire";
import { messageId } from "./messages";
import { presenceCommand } from "./presence";

const address = "DguTcdkWWtDyUFLvQxRdcA8qZhardhE1ZXy1YCC7Zfmq.Dxreouj5RhQqMb3ZaAxgXFdGkmfbDKwk457FdeHGKmQQ@4kjgWmFU1tcGAZYRZR57yFuVAexjLbJ5M7jvo3X5Hkcf";
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

it("keeps two ten-person rooms isolated and durable at the pilot admission limit", async () => {
  // Real crypto and encrypted local storage; no native Nym client or mixnet.
  const directory = await mkdtemp(join(tmpdir(), "openzcash-pilot-ops-"));
  directories.push(directory);
  const storageKey = new Uint8Array(randomBytes(32));
  const storage = new DirectoryStorage(join(directory, "data"), new Uint8Array(storageKey));
  await storage.prepare();
  const providerIdentity = await storage.identity();
  const roomA = (await openRoom())!, roomB = (await openRoom())!;
  const admitted = new Map([[roomA.id, 10], [roomB.id, 10]]);
  const store = new PersistentPresenceStore(storage, { allowedRooms: admitted });
  const provider = new DirectoryProvider(providerIdentity, Date.now, {
    replyMode: "surb", allowedRooms: admitted, store,
    maxRequestsPerMinute: 240, maxPerRoomPerMinute: 120,
  });
  const requester = await createDeviceIdentity();
  const durations: number[] = [];
  async function request(room: DiscoveryRoom, body: unknown) {
    const q = { v: 1 as const, id: messageId(), at: Date.now(), body };
    const bytes = await sealDirectory(2, {
      ...q, roomProof: await signRoomOperation(room.authSecret, directoryRoomProofBody(q)),
    }, requester, providerIdentity.publicKey);
    const tag = randomBytes(16);
    const started = performance.now();
    const reply = await provider.handle(bytes, tag);
    durations.push(performance.now() - started);
    expect(reply?.replyTag ? Array.from(reply.replyTag) : null).toEqual(Array.from(tag));
    const opened = await openDirectory(reply!.bytes, 3, requester.secretKey, providerIdentity.publicKey);
    expect(opened?.value).toMatchObject({ id: q.id });
    return opened!.value as { status: number; entries?: { owner: string }[]; next?: string | null };
  }
  const people = [];
  for (const [roomIndex, room] of [roomA, roomB].entries()) {
    for (let index = 0; index < 10; index++) {
      const person = await createDeviceIdentity();
      const invite = await createLiveInvite(person, `Synthetic ${roomIndex}-${index}`, address);
      const command = await presenceCommand(person, room, invite, "upsert", 1, person);
      expect((await request(room, command)).status).toBe(200);
      people.push({ room, person, invite });
    }
  }
  for (const room of [roomA, roomB]) {
    const owners: string[] = [];
    let after: string | null = null;
    do {
      const page = await request(room, { op: "list", room: room.id, after });
      expect(page.status).toBe(200);
      expect(page.entries!.length).toBeLessThanOrEqual(6);
      owners.push(...page.entries!.map((entry) => entry.owner));
      after = page.next ?? null;
    } while (after);
    expect(new Set(owners).size).toBe(10);
    const extra = await createDeviceIdentity();
    const invite = await createLiveInvite(extra, "Synthetic overflow", address);
    expect((await request(room, await presenceCommand(extra, room, invite, "upsert", 1, extra))).status).toBe(503);
  }
  // Existing participants can still refresh while the room is full.
  for (const { room, person, invite } of people)
    expect((await request(room, await presenceCommand(person, room, invite, "upsert", 2, person))).status).toBe(200);

  const snapshotPath = join(directory, "data", "presence.sealed");
  expect((await stat(snapshotPath)).mode & 0o777).toBe(0o600);
  expect((await readFile(snapshotPath)).toString("utf8")).not.toContain("Synthetic");
  const restartedStorage = new DirectoryStorage(join(directory, "data"), new Uint8Array(storageKey));
  const restored = new PersistentPresenceStore(restartedStorage, { allowedRooms: admitted });
  await restored.initialize();
  expect(restored.list(roomA.id)).toHaveLength(10);
  expect(restored.list(roomB.id)).toHaveLength(10);
  const samples = durations.sort((a, b) => a - b);
  const percentile = (p: number) => Math.round(samples[Math.ceil(p * samples.length) - 1] * 100) / 100;
  process.stdout.write(`Pilot local sealed-directory operations: ${samples.length}; p95 ${percentile(0.95)} ms; p99 ${percentile(0.99)} ms (no mixnet)\n`);
  providerIdentity.secretKey.fill(0);
  requester.secretKey.fill(0);
  storage.destroy(); restartedStorage.destroy(); storageKey.fill(0);
}, 60_000);
