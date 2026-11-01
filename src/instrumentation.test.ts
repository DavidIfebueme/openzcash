import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { register } from "./instrumentation";

const jobs = vi.hoisted(() => ({
  startMarketSnapshots: vi.fn(),
  startNewsSchedule: vi.fn(),
  startLegalSchedule: vi.fn(),
  startEcosystemSchedule: vi.fn(),
  startCoinholderTopicSchedule: vi.fn(),
  refreshZcg: vi.fn(async () => ({
    ok: true,
    ms: 1,
    disbursements: [],
    snapshots: [],
    proposals: [],
    totals: [],
    sourceWarnings: [],
  })),
  importZechubTreasury: vi.fn(async () => []),
  warmIssueAmounts: vi.fn(async () => ({ ok: true, fetched: 0 })),
  warmDiligence: vi.fn(async () => ({ ok: true, proposals: 0 })),
  startCanarySchedule: vi.fn(() => true),
}));
vi.mock("@/lib/news/feed", () => ({ startNewsSchedule: jobs.startNewsSchedule }));
vi.mock("@/lib/ecosystem/schedule", () => ({ startEcosystemSchedule: jobs.startEcosystemSchedule }));
vi.mock("@/lib/coinholder/topic-schedule", () => ({ startCoinholderTopicSchedule: jobs.startCoinholderTopicSchedule }));
vi.mock("@/lib/legal/schedule", () => ({ startLegalSchedule: jobs.startLegalSchedule }));
vi.mock("@/lib/markets/sources", () => ({ startMarketSnapshots: jobs.startMarketSnapshots }));
vi.mock("@/lib/zcg/refresh", () => ({ refreshZcg: jobs.refreshZcg }));
vi.mock("@/lib/zechub/import-treasury", () => ({
  importZechubTreasury: jobs.importZechubTreasury,
}));
vi.mock("@/lib/zcg/issue-amounts", () => ({
  warmIssueAmounts: jobs.warmIssueAmounts,
}));
vi.mock("@/lib/zcg/diligence", () => ({
  warmDiligence: jobs.warmDiligence,
}));
vi.mock("@/lib/zarvis/canary-schedule", () => ({
  startCanarySchedule: jobs.startCanarySchedule,
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("NODE_ENV", "production");
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  Object.values(jobs).forEach((fn) => fn.mockClear());
});

describe("server data collection scheduling", () => {
  it("keeps a test snapshot intact across server restarts", async () => {
    vi.stubEnv("DISABLE_AUTO_REFRESH", "true");
    await register();
    expect(jobs.startNewsSchedule).not.toHaveBeenCalled();
    // The cycle still runs, but nothing that writes to the database does.
    expect(jobs.startMarketSnapshots).toHaveBeenCalledTimes(1);
    expect(jobs.startLegalSchedule).toHaveBeenCalledTimes(1);
    expect(jobs.startEcosystemSchedule).toHaveBeenCalledTimes(1);
    expect(jobs.startCoinholderTopicSchedule).toHaveBeenCalledTimes(1);
    // The canary reads public data only; a frozen snapshot still gets probed.
    expect(jobs.startCanarySchedule).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(2);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(jobs.refreshZcg).not.toHaveBeenCalled();
    expect(jobs.importZechubTreasury).not.toHaveBeenCalled();
    expect(jobs.warmIssueAmounts).not.toHaveBeenCalled();
    // Diligence is an in-memory cache from public data: the under-review
    // table keeps its signals even on a frozen snapshot.
    expect(jobs.warmDiligence).toHaveBeenCalledTimes(1);
  });

  it("retains startup and recurring collection when enabled", async () => {
    vi.stubEnv("DISABLE_AUTO_REFRESH", undefined);
    await register();
    expect(jobs.startNewsSchedule).toHaveBeenCalledTimes(1);
    expect(jobs.startMarketSnapshots).toHaveBeenCalledTimes(1);
    expect(jobs.startLegalSchedule).toHaveBeenCalledTimes(1);
    expect(jobs.startEcosystemSchedule).toHaveBeenCalledTimes(1);
    expect(jobs.startCanarySchedule).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(2);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(jobs.refreshZcg).toHaveBeenCalledTimes(1);
    expect(jobs.importZechubTreasury).toHaveBeenCalledTimes(1);
    expect(jobs.warmIssueAmounts).toHaveBeenCalledTimes(1);
    expect(jobs.warmDiligence).toHaveBeenCalledTimes(1);
  });

  it("does nothing outside the production Node runtime", async () => {
    vi.stubEnv("NODE_ENV", "test");
    await register();
    expect(jobs.startNewsSchedule).not.toHaveBeenCalled();
    expect(jobs.startMarketSnapshots).not.toHaveBeenCalled();
    expect(jobs.startLegalSchedule).not.toHaveBeenCalled();
    expect(jobs.startEcosystemSchedule).not.toHaveBeenCalled();
    expect(jobs.startCanarySchedule).not.toHaveBeenCalled();
    expect(jobs.startCoinholderTopicSchedule).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
