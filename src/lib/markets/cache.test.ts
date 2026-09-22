import { afterEach, describe, expect, it, vi } from "vitest";
import { cachedFeed } from "./cache";

afterEach(() => vi.useRealTimers());
describe("public-source cache", () => {
  it("deduplicates concurrent loads and respects the TTL", async () => {
    vi.useFakeTimers();
    const loader = vi.fn().mockResolvedValue({ volume: 100 });
    const read = cachedFeed(loader, 300000);
    const [a, b] = await Promise.all([read(), read()]);
    expect(a).toEqual(b);
    expect(loader).toHaveBeenCalledTimes(1);
    await read();
    expect(loader).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(300001);
    await read();
    expect(loader).toHaveBeenCalledTimes(2);
  });
  it("preserves the last successful timestamp on failure and backs off", async () => {
    vi.useFakeTimers();
    const loader = vi
      .fn()
      .mockResolvedValueOnce({ volume: 100 })
      .mockRejectedValue(new Error("offline"));
    const read = cachedFeed(loader, 100);
    const first = await read();
    vi.advanceTimersByTime(101);
    const saved = await read();
    expect(saved).toMatchObject({
      data: { volume: 100 },
      fetchedAt: first.fetchedAt,
      stale: true,
    });
    await read();
    expect(loader).toHaveBeenCalledTimes(2);
  });
  it("returns missing data instead of fabricating zero activity", async () => {
    const read = cachedFeed(async () => {
      throw new Error("unavailable");
    });
    expect(await read()).toMatchObject({
      data: null,
      fetchedAt: null,
      stale: true,
    });
  });
});
