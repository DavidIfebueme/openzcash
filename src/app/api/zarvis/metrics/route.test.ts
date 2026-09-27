import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const admin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/admin", () => ({ getIsAdmin: admin }));
import { GET } from "./route";
describe("Zarvis aggregate metrics", () => {
  it("requires an authenticated admin", async () => { admin.mockResolvedValue(false); expect((await GET()).status).toBe(403); });
  it("returns aggregate counters without identifiers", async () => {
    admin.mockResolvedValue(true); const response = await GET(); const data = await response.json();
    expect(data).toHaveProperty("modelCalls"); expect(data).not.toHaveProperty("messages"); expect(data).not.toHaveProperty("apiKey"); expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
