import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("./collector", () => ({ collectEcosystemDaily: vi.fn() }));
import { createEcosystemSchedule, ECOSYSTEM_FIRST_RUN_MS, ECOSYSTEM_CHECK_MS } from "./schedule";
const outcome = { ok: true, outcome: "collected" as const, day: "2026-10-16" };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-16T03:00:00Z")); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllEnvs(); });
it("starts once after boot and keeps checking the durable checkpoint", async () => {
  const collect = vi.fn().mockResolvedValue(outcome), schedule = createEcosystemSchedule({ collect });
  schedule.start(); schedule.start();
  expect(vi.getTimerCount()).toBe(2);
  await vi.advanceTimersByTimeAsync(ECOSYSTEM_FIRST_RUN_MS);
  expect(collect).toHaveBeenCalledExactlyOnceWith({ day: "2026-10-16", at: "2026-10-16T03:01:00.000Z" });
  await vi.advanceTimersByTimeAsync(ECOSYSTEM_CHECK_MS);
  expect(collect).toHaveBeenCalledTimes(2);
  schedule.stop(); expect(vi.getTimerCount()).toBe(0);
});
it("coalesces overlapping work and contains unexpected failures", async () => {
  let finish!: (value: typeof outcome) => void;
  const collect = vi.fn().mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockRejectedValueOnce(new Error("secret"));
  const schedule = createEcosystemSchedule({ collect });
  const first = schedule.execute(); expect(schedule.execute()).toBe(first);
  await Promise.resolve(); finish(outcome); await first;
  expect(await schedule.execute()).toEqual({ ok: false, outcome: "unavailable", day: "2026-10-16" });
});
it("honors DISABLE_AUTO_REFRESH before starting and on later ticks", async () => {
  const collect = vi.fn(), schedule = createEcosystemSchedule({ collect });
  vi.stubEnv("DISABLE_AUTO_REFRESH", "true");
  expect(schedule.start()).toBe(false); expect(vi.getTimerCount()).toBe(0);
  expect((await schedule.execute()).outcome).toBe("disabled");
  expect(collect).not.toHaveBeenCalled();
  vi.stubEnv("DISABLE_AUTO_REFRESH", "false"); schedule.start();
  vi.stubEnv("DISABLE_AUTO_REFRESH", "true");
  await vi.advanceTimersByTimeAsync(ECOSYSTEM_CHECK_MS);
  expect(collect).not.toHaveBeenCalled();
});
