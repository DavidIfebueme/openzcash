import { beforeEach, expect, it, vi } from "vitest";

const reader = vi.hoisted(() => ({ readDecisionHistory: vi.fn() }));
vi.mock("@/lib/participate/decision-history", () => reader);
import { GET } from "./route";

beforeEach(() => vi.clearAllMocks());

it("serves the complete public register with a versioned response", async () => {
  const rows = Array.from({ length: 41 }, (_, id) => ({ id: `decision-${id}` }));
  reader.readDecisionHistory.mockResolvedValue(rows);
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("public");
  expect(await response.json()).toEqual({ version: 1, rows });
});

it("reports a source failure without pretending the register is empty or leaking diagnostics", async () => {
  reader.readDecisionHistory.mockRejectedValue(new Error("private database address"));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ error: "HISTORY_UNAVAILABLE" });
});
