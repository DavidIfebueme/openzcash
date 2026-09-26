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
  mocks.getDb.mockImplementation(() => { throw new Error("Normal quota storage reached"); });
});
afterEach(() => { vi.unstubAllEnvs(); });

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
