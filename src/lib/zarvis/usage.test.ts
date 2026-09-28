import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: mocks.getDb }));
import { zarvisConfig } from "./config";
import { reserveZarvisRequest } from "./usage";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("ZARVIS_ORIGIN", "http://127.0.0.1:3100");
  vi.stubEnv("ZARVIS_LOCAL_UNLIMITED", "true");
  vi.stubEnv("ZARVIS_QUOTA_PAUSE_UNTIL", "");
  mocks.getDb.mockImplementation(() => { throw new Error("Normal quota storage reached"); });
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("Unlimited local Zarvis testing", () => {
  it("allows repeated local requests without reading, resetting or spending quota counters", async () => {
    for (let i = 0; i < 30; i++) {
      expect(await reserveZarvisRequest(new Headers())).toEqual({ allowed: true, retryAfter: 0 });
    }
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it.each(["production", "test"])("keeps normal quota enforcement in %s even if the flag is enabled", async (mode) => {
    vi.stubEnv("NODE_ENV", mode);
    expect(zarvisConfig().unlimitedLocalTesting).toBe(false);
    await expect(reserveZarvisRequest(new Headers())).rejects.toThrow("Normal quota storage reached");
  });

  it.each(["", "false"])("requires an explicit true opt-in, not %s", async (flag) => {
    vi.stubEnv("ZARVIS_LOCAL_UNLIMITED", flag);
    await expect(reserveZarvisRequest(new Headers())).rejects.toThrow("Normal quota storage reached");
  });

  it.each(["", "https://openzcash.org", "http://0.0.0.0:3100", "http://localhost.evil.example", "http://127.0.0.1:3100/not-an-origin", "http://user@127.0.0.1:3100"])("keeps normal quotas for a missing or non-local configured origin: %s", async (origin) => {
    vi.stubEnv("ZARVIS_ORIGIN", origin);
    expect(zarvisConfig().unlimitedLocalTesting).toBe(false);
    await expect(reserveZarvisRequest(new Headers({ "x-forwarded-host": "localhost:3100" }))).rejects.toThrow("Normal quota storage reached");
  });
});


describe("Temporary production launch window", () => {
  const deadline = "2026-09-29T03:00:00.000Z";
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ZARVIS_QUOTA_PAUSE_UNTIL", deadline);
    vi.stubEnv("ZARVIS_DAILY_REQUEST_LIMIT", "100");
    vi.stubEnv("ZARVIS_HOURLY_REQUEST_LIMIT", "30");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T14:00:00.000Z"));
  });

  it("admits more than the ordinary global and network caps without changing stored counters", async () => {
    for (let i = 0; i < 101; i++) {
      expect(await reserveZarvisRequest(new Headers())).toEqual({ allowed: true, retryAfter: 0 });
    }
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(zarvisConfig()).toMatchObject({
      unlimitedLocalTesting: false, dailyLimit: 100, hourlyLimit: 30,
      quotaPause: { active: true, until: deadline },
    });
  });

  it("resumes normal quota storage exactly at midnight in Sao Paulo without restarting", async () => {
    vi.setSystemTime(new Date(Date.parse(deadline) - 1));
    expect(await reserveZarvisRequest(new Headers())).toEqual({ allowed: true, retryAfter: 0 });
    vi.setSystemTime(new Date(deadline));
    expect(zarvisConfig().quotaPause.active).toBe(false);
    await expect(reserveZarvisRequest(new Headers())).rejects.toThrow("Normal quota storage reached");
    vi.advanceTimersByTime(1);
    await expect(reserveZarvisRequest(new Headers())).rejects.toThrow("Normal quota storage reached");
  });

  it.each([
    "", "true", "invalid", "2026-09-29", "2026-09-29T03:00:00", "2026-09-29T00:00:00-03:00",
    "2026-09-28T13:00:00.000Z", "2026-09-30T03:00:00.000Z", "2026-02-30T03:00:00.000Z",
  ])("keeps normal quotas for missing, invalid, expired or too distant expiry: %s", async (expiry) => {
    vi.stubEnv("ZARVIS_QUOTA_PAUSE_UNTIL", expiry);
    expect(zarvisConfig().quotaPause.active).toBe(false);
    await expect(reserveZarvisRequest(new Headers())).rejects.toThrow("Normal quota storage reached");
  });

  it("accepts explicit UTC seconds and limits the active window to the last 24 hours", () => {
    vi.stubEnv("ZARVIS_QUOTA_PAUSE_UNTIL", "2026-09-29T03:00:00Z");
    vi.setSystemTime(new Date(Date.parse(deadline) - 86_400_001));
    expect(zarvisConfig().quotaPause.active).toBe(false);
    vi.advanceTimersByTime(1);
    expect(zarvisConfig().quotaPause).toEqual({ active: true, until: deadline });
  });

  it("does not enable a disabled assistant", () => {
    vi.stubEnv("ZARVIS_ENABLED", "false");
    expect(zarvisConfig()).toMatchObject({ enabled: false, quotaPause: { active: true } });
  });
});
