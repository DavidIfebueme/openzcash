import { beforeEach, expect, it, vi } from "vitest";
const reader = vi.hoisted(() => vi.fn());
vi.mock("@/lib/participate/official-proposals", () => ({ readOfficialProposals: reader }));
import { GET } from "./route";
beforeEach(() => vi.resetAllMocks());
it("returns only the shared public snapshot without caching private board data", async () => {
  const snapshot = { version: 1, readAt: "2026-10-13T04:00:00.000Z", proposals: [] };
  reader.mockResolvedValue(snapshot);
  const response = await GET();
  expect(response.status).toBe(200); expect(await response.json()).toEqual(snapshot);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
it("fails explicitly without leaking internal source errors", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  reader.mockRejectedValue(new Error("private database details"));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "OFFICIAL_PROPOSALS_UNAVAILABLE" });
  vi.restoreAllMocks();
});
