import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createEcosystemCollector } from "./collector";
import { emptyCheckpoint } from "./checkpoint";
import type { Catalog } from "./types";
const at = "2026-10-16T03:30:00.000Z", day = "2026-10-16";
const seed = { registry: {}, snapshot: { registryHash: "registry", collectedAt: "2026-10-15T03:30:00.000Z", repositories: [] } } as unknown as Catalog;
const fresh = { ...seed.snapshot, collectedAt: at };
function setup() {
  const store = { claim: vi.fn().mockResolvedValue({ status: "claimed", row: emptyCheckpoint() }), read: vi.fn().mockResolvedValue(null), complete: vi.fn().mockResolvedValue({ committed: true }) };
  const collect = vi.fn().mockResolvedValue({ snapshot: fresh, publicationIssues: [] });
  const validate = vi.fn();
  const run = createEcosystemCollector({ store, collect, validate, seed, request: () => vi.fn(), now: () => Date.parse(at) + 1000, id: () => "lease" });
  return { run, store, collect, validate };
}
describe("Daily ecosystem publication", () => {
  it("publishes only a complete validated candidate after claiming the durable lease", async () => {
    const { run, store, collect, validate } = setup();
    expect(await run({ day, at })).toMatchObject({ ok: true, outcome: "collected", collectedAt: at });
    expect(collect).toHaveBeenCalledWith(expect.objectContaining({ previousSnapshot: seed.snapshot, startedAt: at }));
    expect(validate).toHaveBeenCalledWith(fresh, seed.snapshot);
    expect(store.complete).toHaveBeenCalledExactlyOnceWith("registry", "lease", "2026-10-16T03:30:01.000Z", fresh);
  });
  it.each(["already-collected", "locked", "retry-later"])("does not fetch sources when checkpoint says %s", async status => {
    const { run, store, collect } = setup(); store.claim.mockResolvedValue({ status, row: emptyCheckpoint() });
    expect((await run({ day, at })).outcome).toBe(status);
    expect(collect).not.toHaveBeenCalled(); expect(store.complete).not.toHaveBeenCalled();
  });
  it("uses the latest durable release history as its baseline", async () => {
    const { run, store, collect } = setup();
    const previous = { ...fresh, collectedAt: "2026-10-16T03:00:00.000Z" };
    store.read.mockResolvedValue({ snapshot: previous, checkpoint: emptyCheckpoint() });
    await run({ day, at });
    expect(collect).toHaveBeenCalledWith(expect.objectContaining({ previousSnapshot: previous }));
  });
  it.each(["partial", "invalid", "network"])("preserves the publication and records a retry after %s failure", async failure => {
    const { run, store, collect, validate } = setup();
    if (failure === "partial") collect.mockResolvedValue({ snapshot: fresh, publicationIssues: ["Incomplete history"] });
    if (failure === "invalid") validate.mockImplementation(() => { throw new Error("Invalid snapshot"); });
    if (failure === "network") collect.mockRejectedValue(new Error("secret-source-error"));
    expect(await run({ day, at })).toEqual({ ok: false, outcome: "unavailable", day });
    expect(store.complete).toHaveBeenCalledExactlyOnceWith("registry", "lease", "2026-10-16T03:30:01.000Z", null);
  });
  it("does not claim success when its lease has expired or been replaced", async () => {
    const { run, store } = setup(); store.complete.mockResolvedValue({ committed: false });
    expect(await run({ day, at })).toEqual({ ok: false, outcome: "superseded", day });
  });
  it("does not fetch or publish when the database cannot provide a lock", async () => {
    const { run, store, collect } = setup(); store.claim.mockRejectedValue(new Error("db-secret"));
    expect((await run({ day, at })).outcome).toBe("unavailable");
    expect(collect).not.toHaveBeenCalled(); expect(store.complete).not.toHaveBeenCalled();
  });
});
