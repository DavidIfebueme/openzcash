import { afterEach, describe, expect, it, vi } from "vitest";
import { cachedFeed } from "./cache";

afterEach(() => vi.useRealTimers());
describe("public-source cache", () => {
  it("retries failed partial coverage early without discarding its valid pools", async () => {
    vi.useFakeTimers();
    const loader = vi
      .fn()
      .mockResolvedValueOnce({ pools: [1], failed: true })
      .mockResolvedValueOnce({ pools: [1, 2], failed: false });
    const read = cachedFeed(loader, 300_000, (data) => data.failed);
    expect((await read()).data?.pools).toEqual([1]);
    vi.advanceTimersByTime(59_999);
    await read();
    expect(loader).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect((await read()).data?.pools).toEqual([1, 2]);
    expect(loader).toHaveBeenCalledTimes(2);
  });
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
