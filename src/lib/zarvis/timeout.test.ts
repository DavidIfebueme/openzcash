import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { boundedRead } from "./timeout";
afterEach(() => vi.useRealTimers());
describe("Public read deadlines", () => {
  it("stops waiting for a stalled source and respects cancellation", async () => {
    vi.useFakeTimers();
    const never = () => new Promise(() => {});
    const timeout = boundedRead(never, new AbortController().signal);
    const timed = expect(timeout).rejects.toThrow("PUBLIC_READ_TIMEOUT");
    await vi.advanceTimersByTimeAsync(12_001); await timed;
    const controller = new AbortController();
    const cancelled = boundedRead(never, controller.signal);
    const check = expect(cancelled).rejects.toThrow("REQUEST_ABORTED");
    controller.abort(); await check;
    const read = vi.fn();
    await expect(boundedRead(read, controller.signal)).rejects.toThrow(); expect(read).not.toHaveBeenCalled();
  });
});
