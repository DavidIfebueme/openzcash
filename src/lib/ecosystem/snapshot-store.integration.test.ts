import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { ecosystemSnapshotStore as store } from "./snapshot-store";
import type { Snapshot } from "./types";
const testUrl = process.env.ECOSYSTEM_TEST_DB_URL;
if (testUrl) {
  const url = new URL(testUrl);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || url.pathname !== "/openzcash_ecosystem_test" || url.search)
    throw new Error("ECOSYSTEM_TEST_REQUIRES_DISPOSABLE_LOCAL_DB");
}
const at = "2026-10-16T03:30:00.000Z", day = "2026-10-16", hash = "test-registry";
const snapshot = { schemaVersion: 1, registryHash: hash, collectedAt: at, repositories: [] } as unknown as Snapshot;
describe.skipIf(!testUrl)("Ecosystem PostgreSQL checkpoint and atomic snapshot", () => {
  let admin: ReturnType<typeof postgres>;
  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", testUrl!);
    admin = postgres(testUrl!, { max: 1 });
    await migrate(drizzle(admin), { migrationsFolder: "./drizzle" });
  });
  beforeEach(async () => { await admin`delete from ecosystem_public_snapshots`; });
  afterAll(async () => {
    await admin?.end();
    const state = globalThis as typeof globalThis & { __zecSql?: ReturnType<typeof postgres>; __zecDb?: unknown };
    await state.__zecSql?.end(); delete state.__zecSql; delete state.__zecDb;
    vi.unstubAllEnvs();
  });
  it("serializes simultaneous claims and persists success across a new DB connection", async () => {
    const claims = await Promise.all(Array.from({ length: 12 }, (_, i) => store.claim(hash, day, at, `worker-${i}`)));
    expect(claims.filter(claim => claim.status === "claimed")).toHaveLength(1);
    expect(claims.filter(claim => claim.status === "locked")).toHaveLength(11);
    const id = claims.find(claim => claim.status === "claimed")!.row.lease!.id;
    expect(await store.complete(hash, id, at, snapshot)).toEqual({ committed: true });
    const independent = postgres(testUrl!, { max: 1 });
    try {
      const [row] = await independent`select checkpoint, snapshot from ecosystem_public_snapshots where registry_hash = ${hash}`;
      expect(row.checkpoint.successfulDay).toBe(day); expect(row.snapshot.collectedAt).toBe(at);
    } finally { await independent.end(); }
    expect((await store.read(hash, at))?.snapshot).toBeNull();
    expect((await store.read(hash, "2026-10-15T03:30:00.000Z"))?.snapshot).toEqual(snapshot);
    expect((await store.claim(hash, day, at, "restart")).status).toBe("already-collected");
  });
  it("retains the previous snapshot after source failure and applies a durable retry budget", async () => {
    await store.claim(hash, day, at, "today"); await store.complete(hash, "today", at, snapshot);
    const tomorrow = "2026-10-17T03:30:00.000Z";
    await store.claim(hash, "2026-10-17", tomorrow, "tomorrow");
    await store.complete(hash, "tomorrow", tomorrow, null);
    expect(await store.read(hash)).toMatchObject({ snapshot, checkpoint: { successfulDay: day, outcome: "source-unavailable" } });
    expect((await store.claim(hash, "2026-10-17", tomorrow, "retry")).status).toBe("retry-later");
  });
  it("rejects late workers and mismatched cutoffs without changing a newer publication", async () => {
    await store.claim(hash, day, at, "old");
    const later = "2026-10-16T04:01:00.000Z", current = { ...snapshot, collectedAt: later };
    await store.claim(hash, day, later, "new");
    await expect(store.complete(hash, "new", later, snapshot)).rejects.toThrow("does not match its lease");
    expect((await store.complete(hash, "new", later, current)).committed).toBe(true);
    expect((await store.complete(hash, "old", later, snapshot)).committed).toBe(false);
    expect((await store.read(hash))?.snapshot?.collectedAt).toBe(later);
  });
  it("isolates different reviewed registry versions during overlapping deployments", async () => {
    await store.claim(hash, day, at, "first");
    expect((await store.claim("different-registry", day, at, "second")).status).toBe("claimed");
    await store.complete(hash, "first", at, snapshot);
    expect((await store.read("different-registry"))?.snapshot).toBeNull();
  });
});
