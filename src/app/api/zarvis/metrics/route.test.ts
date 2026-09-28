import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const admin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/admin", () => ({ getIsAdmin: admin }));
import { GET } from "./route";
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
describe("Zarvis aggregate metrics", () => {
  it("requires an authenticated admin", async () => { admin.mockResolvedValue(false); expect((await GET()).status).toBe(403); });
  it("reports the live quota policy and expiry only to an authenticated admin", async () => {
    vi.stubEnv("ZARVIS_QUOTA_PAUSE_UNTIL", "2026-09-29T03:00:00.000Z");
    vi.stubEnv("ZARVIS_DAILY_REQUEST_LIMIT", "100");
    vi.stubEnv("ZARVIS_HOURLY_REQUEST_LIMIT", "30");
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-28T14:00:00.000Z"));
    admin.mockResolvedValue(false);
    expect((await GET()).status).toBe(403);
    admin.mockResolvedValue(true);
    expect((await (await GET()).json()).quota).toEqual({
      paused: true, resumesAt: "2026-09-29T03:00:00.000Z", dailyLimit: 100, hourlyLimit: 30,
    });
    vi.setSystemTime(new Date("2026-09-29T03:00:00.000Z"));
    expect((await (await GET()).json()).quota.paused).toBe(false);
  });
  it("returns aggregate counters without identifiers", async () => {
    admin.mockResolvedValue(true); const response = await GET(); const data = await response.json();
    expect(data).toHaveProperty("modelCalls"); expect(data).not.toHaveProperty("messages"); expect(data).not.toHaveProperty("apiKey"); expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
