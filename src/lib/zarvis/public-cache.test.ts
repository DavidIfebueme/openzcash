import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { cachedPublic, clearPublicCache } from "./public-cache";
afterEach(() => { clearPublicCache(); vi.useRealTimers(); });
describe("Public data cache", () => {
  it("shares simultaneous reads, expires them and does not cache failures", async () => {
    vi.useFakeTimers();
    const read = vi.fn().mockResolvedValue({ total: 10 });
    await Promise.all([cachedPublic("same", 60_000, read), cachedPublic("same", 60_000, read)]);
    expect(read).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_001); await cachedPublic("same", 60_000, read); expect(read).toHaveBeenCalledTimes(2);
    const failed = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(20);
    await expect(cachedPublic("fail", 60_000, failed)).rejects.toThrow("offline");
    expect(await cachedPublic("fail", 60_000, failed)).toBe(20);
  });
  it("invalidates aggregates when the import version changes", async () => {
    const read = vi.fn().mockResolvedValue(10);
    await cachedPublic("ledger:import-1:2025", 60_000, read);
    await cachedPublic("ledger:import-2:2025", 60_000, read);
    expect(read).toHaveBeenCalledTimes(2);
  });
});
