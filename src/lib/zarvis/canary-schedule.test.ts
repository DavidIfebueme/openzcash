import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ run: vi.fn(), record: vi.fn(), alert: vi.fn(), config: vi.fn(), zip: vi.fn(), semantic: vi.fn() }));
vi.mock("./canary", () => ({ runCanary: mocks.run }));
vi.mock("./metrics-store", () => ({ recordCanary: mocks.record }));
vi.mock("./alerts", () => ({ sendAlert: mocks.alert }));
vi.mock("./config", () => ({ zarvisConfig: mocks.config }));
vi.mock("./zips", () => ({ getZipCorpus: mocks.zip }));
vi.mock("./semantic", () => ({ warmSemantic: mocks.semantic }));
import { CANARY_FIRST_RUN_MS, CANARY_INTERVAL_MS, CANARY_WARMUP_MS, STALE_RUNS_BEFORE_ALERT, executeCanary, resetCanaryScheduleForTests, startCanarySchedule } from "./canary-schedule";
const passed = { at: "2026-09-28T12:00:00.000Z", ok: true, ms: 700, passed: 4, failed: 0, skipped: 0, failedCases: [], skippedCases: [], cases: [] };
const skippedZip = { ...passed, passed: 3, skipped: 1, skippedCases: ["zip"] };
beforeEach(() => {
  vi.clearAllMocks(); resetCanaryScheduleForTests(); vi.useFakeTimers();
  vi.spyOn(console, "info").mockImplementation(() => {}); vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.config.mockReturnValue({ enabled: true, canaryModel: false }); mocks.run.mockResolvedValue(passed); mocks.record.mockResolvedValue(true);
  mocks.zip.mockResolvedValue({ corpus: {}, stale: false }); mocks.semantic.mockResolvedValue(undefined);
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("executeCanary", () => {
  it("runs, stores, logs labels only and returns the stored flag", async () => {
    const outcome = await executeCanary();
    expect(outcome).toMatchObject({ ok: true, passed: 4, stored: true });
    expect(mocks.run.mock.calls[0][1]).toEqual({ model: false }); expect(mocks.record).toHaveBeenCalledWith(passed); expect(mocks.alert).not.toHaveBeenCalled();
    const line = JSON.parse((console.info as unknown as { mock: { calls: string[][] } }).mock.calls[0][0]);
    expect(line).toMatchObject({ event: "zarvis.canary", ok: true, passed: 4, failed: 0, skipped: 0, stored: true });
  });
  it("adds the paid case only when explicitly enabled and the assistant is on", async () => {
    mocks.config.mockReturnValue({ enabled: true, canaryModel: true });
    await executeCanary(); expect(mocks.run.mock.calls[0][1]).toEqual({ model: true });
    mocks.config.mockReturnValue({ enabled: false, canaryModel: true });
    await executeCanary(); expect(mocks.run.mock.calls[1][1]).toEqual({ model: false });
  });
  it("alerts with labels only when a check fails", async () => {
    mocks.run.mockResolvedValue({ ...passed, ok: false, passed: 3, failed: 1, failedCases: ["treasuries"] }); mocks.record.mockResolvedValue(false);
    expect(await executeCanary()).toMatchObject({ ok: false, failedCases: ["treasuries"], stored: false });
    expect(mocks.alert).toHaveBeenCalledWith("canary", "Zarvis canary failed: 1 of 4 checks (treasuries).");
  });
  it("shares one in-flight run between concurrent callers", async () => {
    let finish!: (value: typeof passed) => void;
    mocks.run.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const first = executeCanary(), second = executeCanary();
    expect(second).toBe(first);
    finish(passed); await first;
    expect(mocks.run).toHaveBeenCalledTimes(1);
    await executeCanary(); expect(mocks.run).toHaveBeenCalledTimes(2);
  });
  it("treats a skipped ZIP case as a pass and alerts only once it persists", async () => {
    mocks.run.mockResolvedValue(skippedZip);
    for (let i = 1; i < STALE_RUNS_BEFORE_ALERT; i++) { expect(await executeCanary()).toMatchObject({ ok: true, skippedCases: ["zip"] }); expect(mocks.alert).not.toHaveBeenCalled(); }
    await executeCanary();
    expect(mocks.alert).toHaveBeenCalledTimes(1); expect(mocks.alert.mock.calls[0][0]).toBe("canary"); expect(mocks.alert.mock.calls[0][1]).toMatch(/ZIP corpus stale for 3 consecutive/);
    mocks.run.mockResolvedValue(passed); await executeCanary(); mocks.run.mockResolvedValue(skippedZip); await executeCanary();
    expect(mocks.alert).toHaveBeenCalledTimes(1);
  });
});
describe("startCanarySchedule", () => {
  it("warms the ZIP corpus and the embedding model, runs after boot and then hourly", async () => {
    expect(startCanarySchedule()).toBe(true);
    expect(vi.getTimerCount()).toBe(3);
    await vi.advanceTimersByTimeAsync(CANARY_WARMUP_MS);
    expect(mocks.zip).toHaveBeenCalledTimes(1); expect(mocks.semantic).toHaveBeenCalledTimes(1); expect(mocks.run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(CANARY_FIRST_RUN_MS - CANARY_WARMUP_MS);
    expect(mocks.run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(CANARY_INTERVAL_MS);
    expect(mocks.run).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(CANARY_INTERVAL_MS);
    expect(mocks.run).toHaveBeenCalledTimes(3);
  });
  it("survives a warm-up failure and a run that throws", async () => {
    mocks.zip.mockRejectedValue(new Error("PUBLIC_READ_TIMEOUT")); mocks.semantic.mockRejectedValue(new Error("SEMANTIC_MODEL_MISSING")); mocks.run.mockRejectedValue(new Error("boom"));
    startCanarySchedule();
    await vi.advanceTimersByTimeAsync(CANARY_FIRST_RUN_MS + CANARY_INTERVAL_MS);
    expect(mocks.run).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith("[cron] zarvis canary failed:", "boom");
  });
  it("can be disabled by environment", () => {
    vi.stubEnv("ZARVIS_CANARY_SCHEDULE", "false");
    expect(startCanarySchedule()).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
});
