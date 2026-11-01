import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createTopicSchedule } from "./topic-schedule";

afterEach(() => vi.useRealTimers());
describe("automatic discovery of new and edited proposals", () => {
  it("warms once after boot and rechecks every five minutes without duplicate timers", async () => {
    vi.useFakeTimers();
    const read = vi.fn(async () => ({ status: "current" as const, fetchedAt: null, proposals: [] }));
    const schedule = createTopicSchedule({ read, enabled: () => true });
    schedule.start(); schedule.start();
    await vi.advanceTimersByTimeAsync(20_000); expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(280_000); expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(300_000); expect(read).toHaveBeenCalledTimes(3);
    schedule.stop(); await vi.advanceTimersByTimeAsync(300_000); expect(read).toHaveBeenCalledTimes(3);
  });
  it("does not schedule new work when disabled", async () => {
    vi.useFakeTimers(); const read = vi.fn();
    const schedule = createTopicSchedule({ read, enabled: () => false });
    schedule.start(); await vi.advanceTimersByTimeAsync(600_000);
    expect(read).not.toHaveBeenCalled(); schedule.stop();
  });
});
