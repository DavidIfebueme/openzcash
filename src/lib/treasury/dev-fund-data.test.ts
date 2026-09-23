import { beforeEach, describe, expect, it, vi } from "vitest";
import { valueReportedDevFund, type DevFundReportedData } from "./dev-fund";

vi.mock("server-only", () => ({}));
const { snapshot, lockbox } = vi.hoisted(() => ({ snapshot: vi.fn(), lockbox: vi.fn() }));
vi.mock("@/lib/zcg/snapshots-repo", () => ({ latestSnapshot: snapshot }));
vi.mock("@/lib/zcash/lockbox-live", () => ({ currentLockboxZec: lockbox }));

import { reportedDevFundData } from "./dev-fund-data";

const zcg = {
  usdMilestonesPaidCents: 2_145_107_100n,
  zecBalanceZat: 8_767_000_000_000n,
  usdCashBalanceCents: 886_740_800n,
  capturedAt: new Date("2026-09-16T17:23:30Z"),
  importedAt: new Date("2026-09-20T04:23:06.913Z"),
  status: "updates_required",
  // These are deliberately different scopes from assets on hand.
  zecReceivablesZat: 11_509_613_000_000n,
  futureGrantLiabilitiesCents: -272_335_000n,
};
const lock = {
  zat: 14_317_785_000_000n,
  height: 3_493_036,
  baselineHeight: 3_485_624,
  snap: {
    capturedAt: new Date("2026-09-16T17:13:00Z"),
    importedAt: new Date("2026-09-20T04:23:07.904Z"),
    status: "ok",
    zecReceivablesZat: 17_264_531_000_000n,
  },
};

beforeEach(() => {
  snapshot.mockReset().mockResolvedValue(zcg);
  lockbox.mockReset().mockResolvedValue(lock);
});

describe("reported dev fund defaults", () => {
  it("loads the footer balances and cumulative paid milestones with original dates", async () => {
    const data = await reportedDevFundData();
    expect(snapshot).toHaveBeenCalledWith("zcg_operating");
    expect(data.zcg).toMatchObject({
      paidMilestonesUsd: 21_451_071, zec: 87_670, cashUsd: 8_867_408,
      snapshotAt: "2026-09-16T17:23:30.000Z", updatesRequired: true,
    });
    expect(data.lockbox).toMatchObject({ zec: 143_177.85, height: 3_493_036 });
    expect(data.zcg?.sourceUrl).toContain("#gid=135980745");
    expect(data.lockbox?.sourceUrl).toContain("#gid=808560406");
    expect(() => JSON.stringify(data)).not.toThrow();

    // 87,670 + 143,177.85 ZEC at $1,600, plus $8,867,408 cash.
    // Neither future receivables nor already-paid spending are added/subtracted.
    expect(valueReportedDevFund(data, 1_600)).toBe(378_223_968);
    expect(valueReportedDevFund(data, 3_200)).toBe(747_580_528);
  });

  it("keeps unavailable sources missing, without filling them with example values", async () => {
    snapshot.mockRejectedValueOnce(new Error("unavailable"));
    const data = await reportedDevFundData();
    expect(data.zcg).toBeNull();
    expect(data.lockbox).not.toBeNull();
    expect(valueReportedDevFund(data, 1_600)).toBeNull();

    lockbox.mockResolvedValueOnce(null);
    const noLockbox = await reportedDevFundData();
    expect(noLockbox.zcg?.paidMilestonesUsd).toBe(21_451_071);
    expect(valueReportedDevFund(noLockbox, 1_600)).toBeNull();
  });

  it("preserves a missing amount instead of presenting it as zero spending or cash", async () => {
    snapshot.mockResolvedValueOnce({ ...zcg, usdMilestonesPaidCents: null, usdCashBalanceCents: null });
    const data = await reportedDevFundData();
    expect(data.zcg?.paidMilestonesUsd).toBeNull();
    expect(data.zcg?.cashUsd).toBeNull();
    expect(valueReportedDevFund(data, 1_600)).toBeNull();
  });

  it("allows reported zero balances and rejects an invalid valuation price", async () => {
    const data = await reportedDevFundData();
    const zero: DevFundReportedData = {
      zcg: { ...data.zcg!, zec: 0, cashUsd: 0, paidMilestonesUsd: 0 },
      lockbox: { ...data.lockbox!, zec: 0 },
    };
    expect(valueReportedDevFund(zero, 1_600)).toBe(0);
    for (const price of [0, -1, NaN, Infinity]) expect(valueReportedDevFund(data, price)).toBeNull();
  });
});
