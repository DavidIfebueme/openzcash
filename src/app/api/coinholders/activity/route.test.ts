import { beforeEach, describe, expect, it, vi } from "vitest";

const reader = vi.hoisted(() => ({ readCoinholderDashboard: vi.fn() }));
vi.mock("@/lib/coinholder/analytics/server", () => reader);
import { GET } from "./route";

const dashboard = {
  round: { id: "q3-2026" },
  sourceState: "verified",
  activity: { buckets: [{ casts: 12 }] },
  revealHistory: { days: ["2026-09-17"] },
  proposals: [{ id: 8 }],
};
const get = (query = "") => GET(new Request(`https://openzcash.org/api/coinholders/activity${query}`));

beforeEach(() => {
  reader.readCoinholderDashboard.mockReset();
  reader.readCoinholderDashboard.mockResolvedValue(dashboard);
});

describe("public Coinholder activity", () => {
  it("serves the verified series without a community or session", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=60, stale-while-revalidate=60");
    expect(await response.json()).toEqual(dashboard);
    expect(reader.readCoinholderDashboard).toHaveBeenCalledOnce();
  });

  it("omits fixed historical series from subsequent source checks", async () => {
    const response = await get("?history=omit");
    const body = await response.json();
    expect(body).toEqual({ round: dashboard.round, sourceState: "verified", proposals: dashboard.proposals, activityOmitted: true });
    expect(body).not.toHaveProperty("activity");
    expect(body).not.toHaveProperty("revealHistory");
  });

  it("returns a non-cacheable failure without leaking internal diagnostics", async () => {
    reader.readCoinholderDashboard.mockRejectedValue(new Error("private infrastructure detail"));
    const response = await get();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "COINHOLDER_READ_FAILED" });
  });
});
