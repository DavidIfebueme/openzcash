import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Q4ProposalSummary } from "./q4";
vi.mock("server-only", () => ({}));
const source = { payments: vi.fn(), approvals: vi.fn() };
vi.mock("@/lib/cache/memo", () => ({ LEDGER_TTL_MS: 600_000, cached: (_key: string, _ttl: number, fn: () => unknown) => fn() }));
import { createZcgHistoryReader } from "./zcg-history-server";
const readZcgHistory = createZcgHistoryReader(source);

const proposal: Q4ProposalSummary = { number: 70, title: "New work", applicant: "alice", organization: "Example team",
  category: null, summary: null, requestedUsdCents: null, url: "https://example.com", createdAt: "2026-10-30T12:00:00Z", updatedAt: "2026-10-30T12:00:00Z" };
beforeEach(() => { vi.clearAllMocks(); source.payments.mockResolvedValue([]); source.approvals.mockResolvedValue([]); });

describe("ZCG history source isolation", () => {
  it("does not query the ledger when no proposals can be shown", async () => {
    expect(await readZcgHistory([])).toEqual({});
    expect(source.payments).not.toHaveBeenCalled();
  });
  it("does not turn a source failure into a negative funding claim", async () => {
    source.approvals.mockRejectedValue(new Error("unavailable"));
    expect(await readZcgHistory([proposal])).toEqual({ 70: { status: "unavailable" } });
  });
  it("keeps positive evidence from the independent source", async () => {
    source.approvals.mockRejectedValue(new Error("unavailable"));
    source.payments.mockResolvedValue([{ project: "Earlier work", recipient: "Example team", sourceSheet: "grants_disbursed", isPaid: true, paidDate: "2025-01-01", isTest: false, isInternal: false }]);
    expect((await readZcgHistory([proposal]))[70]).toMatchObject({ status: "confirmed", basis: "recipient" });
  });
});
