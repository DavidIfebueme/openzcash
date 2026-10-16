import { describe, expect, it, vi } from "vitest";
import { createEcosystemReader } from "./snapshot-reader";
import { emptyCheckpoint } from "./checkpoint";
import type { Catalog } from "./types";
const seed = { registry: { checkedAt: "2026-09-08" }, snapshot: { collectedAt: "2026-10-15T03:00:00Z" } } as Catalog;
const fresh = { ...seed.snapshot, collectedAt: "2026-10-16T03:00:00Z" };
const now = () => Date.parse("2026-10-16T04:00:00Z");
describe("Runtime ecosystem reader", () => {
  it("refreshes an existing process and a restarted process without rebuilding", async () => {
    let clock = now();
    const read = vi.fn().mockResolvedValueOnce(null).mockResolvedValue({ snapshot: fresh, checkpoint: emptyCheckpoint() });
    const validate = vi.fn();
    const load = createEcosystemReader({ seed, read, validate, now: () => clock });
    expect((await load()).catalog).toBe(seed);
    clock += 60_001;
    expect((await load()).catalog.snapshot).toBe(fresh);
    const restarted = createEcosystemReader({ seed, read, validate, now });
    expect((await restarted()).catalog.snapshot).toBe(fresh);
    expect((await restarted()).catalog.registry).toBe(seed.registry);
    expect(read).toHaveBeenCalledTimes(3);
  });
  it("retains the last valid publication when storage fails or a candidate fails validation", async () => {
    const invalid = { ...fresh, collectedAt: "2026-10-16T03:30:00Z" };
    const read = vi.fn().mockResolvedValueOnce({ snapshot: fresh, checkpoint: emptyCheckpoint() })
      .mockRejectedValueOnce(new Error("private database error"))
      .mockResolvedValueOnce({ snapshot: invalid, checkpoint: emptyCheckpoint() });
    const validate = vi.fn().mockImplementation(snapshot => { if (snapshot === invalid) throw new Error("invalid"); });
    const load = createEcosystemReader({ seed, read, validate, now, ttl: 0 });
    expect((await load()).catalog.snapshot).toBe(fresh);
    expect(await load()).toMatchObject({ available: false, source: "daily", catalog: { snapshot: fresh } });
    expect(await load()).toMatchObject({ available: false, source: "daily", catalog: { snapshot: fresh } });
  });
  it("shares concurrent reads and never rolls back to an older durable snapshot", async () => {
    const read = vi.fn().mockResolvedValue({ snapshot: { ...fresh, collectedAt: "2026-10-14T03:00:00Z" }, checkpoint: emptyCheckpoint() });
    const load = createEcosystemReader({ seed, read, validate: vi.fn(), now });
    const values = await Promise.all([load(), load(), load()]);
    expect(read).toHaveBeenCalledTimes(1);
    expect(values.every(value => value.catalog === seed)).toBe(true);
  });
  it("serves the seed when no database is available", async () => {
    const load = createEcosystemReader({ seed, read: async () => { throw new Error("unavailable"); }, validate: vi.fn(), now });
    expect(await load()).toMatchObject({ available: false, source: "bundled", catalog: seed });
  });
});
