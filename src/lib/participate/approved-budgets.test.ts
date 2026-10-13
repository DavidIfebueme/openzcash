import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ transaction: vi.fn(), rows: [] as unknown[][] }));
vi.mock("@/lib/db/client", () => ({ getDb: () => ({ transaction: state.transaction }) }));

const at = new Date("2026-10-12T18:00:00.000Z");
function seed() {
  state.rows = [[{ id: "sheet-454", title: "0xramp: ZEC payments", status: "approved", platformLink: "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/454", sourceSheetGid: "1164534734", sourceRowIndex: 707, program: "zcg", origin: "sheet", locked: false, importedAt: at }],
    [{ project: "0xramp: ZEC payments", recipientNameRaw: "0xramp Labs", amountUsdCents: 4500000n, grantStatus: "open", sourceSheet: "grants_disbursed", sourceSheetGid: "803214474", sourceRowIndex: 888, origin: "sheet", locked: false, isTest: false, isInternal: false, importedAt: at }]];
  state.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
    const rows = [...state.rows];
    return fn({ execute: vi.fn(), select: () => ({ from: () => ({ where: () => Promise.resolve(rows.shift()) }) }) });
  });
}
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(at); seed(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it("coalesces page/API reads, caches one public budget map and refreshes changed imported amounts", async () => {
  const { readApprovedBudgets } = await import("./approved-budgets");
  const [first, second] = await Promise.all([readApprovedBudgets(), readApprovedBudgets()]);
  expect(first).toEqual(second);
  expect(first.budgets["454"].usdCents).toBe("4500000");
  expect(first.importedAt).toBe(at.toISOString());
  expect(state.transaction).toHaveBeenCalledTimes(1);
  await readApprovedBudgets();
  expect(state.transaction).toHaveBeenCalledTimes(1);
  state.rows[1] = [{ ...(state.rows[1][0] as object), amountUsdCents: 3000000n }];
  vi.advanceTimersByTime(60_001);
  expect((await readApprovedBudgets()).budgets["454"].usdCents).toBe("3000000");
  expect(state.transaction).toHaveBeenCalledTimes(2);
  expect(state.transaction.mock.calls[0][1]).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
});

it("does not keep serving an expired budget when the database fails and recovers on the next read", async () => {
  const { readApprovedBudgets } = await import("./approved-budgets");
  await readApprovedBudgets();
  vi.advanceTimersByTime(60_001);
  state.transaction.mockRejectedValueOnce(new Error("DB unavailable"));
  await expect(readApprovedBudgets()).rejects.toThrow("DB unavailable");
  expect((await readApprovedBudgets()).budgets["454"].usdCents).toBe("4500000");
});

it("does not block opening the workspace while a cold database is waiting", async () => {
  state.transaction.mockImplementation(() => new Promise(() => {}));
  const { initialApprovedBudgets } = await import("./approved-budgets");
  const pending = initialApprovedBudgets();
  await vi.advanceTimersByTimeAsync(1_000);
  await expect(pending).resolves.toBeNull();
});

it("returns 503 without private database details or a misleading empty successful response", async () => {
  state.transaction.mockRejectedValueOnce(new Error("private connection detail"));
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  const { GET } = await import("@/app/api/participate/approved-budgets/route");
  const response = await GET();
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ error: "APPROVED_BUDGETS_UNAVAILABLE" });
  expect(logged).toHaveBeenCalledWith("[participate] official approved budgets unavailable");
});

it("serves public sheet provenance without payment or account fields", async () => {
  const { GET } = await import("@/app/api/participate/approved-budgets/route");
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("public, max-age=60");
  expect(await response.json()).toEqual({ version: 1, importedAt: at.toISOString(), budgets: {
    "454": { usdCents: "4500000", sourceRows: [889], sourceUrl: expect.stringContaining("gid=803214474&range=A889"), proposalSourceUrl: expect.stringContaining("gid=1164534734&range=A708") },
  } });
});
