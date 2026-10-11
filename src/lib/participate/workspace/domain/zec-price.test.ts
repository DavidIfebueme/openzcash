import { describe, expect, it } from "vitest";
import { formatEstimatedZec, readDisplayZecPrice, readFreshZecPrice } from "@/lib/participate/workspace/domain/zec-price";
import { zcgApprovedBudget } from "@/lib/participate/workspace/data/zcg-approved-budgets";
import { estimateFundingZat } from "@/lib/participate/workspace/domain/funding-quote";

const now = new Date("2026-10-10T12:00:00Z");
const price = { rateUsdPerZecE8: "33333000000", quotedAt: now.toISOString(), retrievedAt: now.toISOString(), expiresAt: "2026-10-10T12:05:00.000Z" };

describe("public ZEC estimates", () => {
  it("retains the provider's exact rate and computes all four reviewed budgets", () => {
    expect(readFreshZecPrice(price, now)).toEqual(price);
    const ids = ["zcg-graphsense-2026-09-28", "zcg-ironwood-2026-09-28", "zcg-mumbai-2026-09-14", "zcg-arabia-2026-08-31"];
    expect(ids.map(id => formatEstimatedZec(estimateFundingZat(BigInt(zcgApprovedBudget(id)!.usdCents), 33333000000n)))).toEqual(["24.00", "24.00", "60.90", "81.00"]);
    expect(estimateFundingZat(800000n, 33333000000n)).toBe(2400024001n);
  });
  it.each([
    { ...price, rateUsdPerZecE8: "0" }, { ...price, rateUsdPerZecE8: "1e8" },
    { ...price, rateUsdPerZecE8: "1000000000000001" },
    { ...price, quotedAt: "2026-10-10T11:55:00.000Z" },
    { ...price, quotedAt: "2026-10-10T12:00:01.000Z" },
    { ...price, expiresAt: "2026-10-10T12:06:00.000Z" },
    { ...price, retrievedAt: "2026-10-10T11:59:59.000Z" },
    { ...price, retrievedAt: "2026-10-10T12:00:01.000Z" }
  ])("rejects stale, future, malformed or extended prices", input => {
    expect(() => readFreshZecPrice(input, now)).toThrow();
  });
  it("expires at UTC midnight and never presents tiny positive estimates as zero", () => {
    expect(() => readFreshZecPrice({ ...price, quotedAt: "2026-10-09T23:59:59.000Z", retrievedAt: "2026-10-10T00:00:00.000Z", expiresAt: "2026-10-10T00:00:00.000Z" }, new Date("2026-10-10T00:00:00Z"))).toThrow();
    expect(formatEstimatedZec(1n)).toBe("<0.01");
    expect(formatEstimatedZec(999_500_000n)).toBe("10.00");
    expect(formatEstimatedZec(123456789012n)).toBe("1,234.57");
  });
  it("requires a reviewed budget rather than interpreting a requested amount or arbitrary ID as approval", () => {
    expect(zcgApprovedBudget("zcg-seedsigner-2026-09-14")).toBeNull();
    expect(zcgApprovedBudget("unreviewed-application")).toBeNull();
    expect(zcgApprovedBudget("constructor")).toBeNull();
  });
});

describe("browser display clock tolerance", () => {
  it("accepts the observed 203ms retrieval skew without changing timestamps or expiry", () => {
    const browserNow = new Date("2026-10-11T19:20:39.650Z");
    const input = { ...price, quotedAt: "2026-10-11T19:20:00.000Z", retrievedAt: "2026-10-11T19:20:39.853Z", expiresAt: "2026-10-11T19:25:00.000Z" };
    expect(readDisplayZecPrice(input, browserNow)).toEqual(input);
    expect(() => readFreshZecPrice(input, browserNow)).toThrow();
  });
  it("allows at most two seconds for both source and retrieval timestamps", () => {
    const at = new Date(+now + 2_000);
    const input = { ...price, quotedAt: at.toISOString(), retrievedAt: at.toISOString(), expiresAt: new Date(+at + 300_000).toISOString() };
    expect(readDisplayZecPrice(input, now)).toEqual(input);
    expect(() => readFreshZecPrice(input, now)).toThrow();
    expect(() => readDisplayZecPrice({ ...price, retrievedAt: new Date(+now + 2_001).toISOString() }, now)).toThrow();
    const later = new Date(+now + 2_001);
    expect(() => readDisplayZecPrice({ ...input, quotedAt: later.toISOString(), retrievedAt: later.toISOString(), expiresAt: new Date(+later + 300_000).toISOString() }, now)).toThrow();
  });
  it("provides no grace period at the original five-minute expiry", () => {
    expect(readDisplayZecPrice(price, new Date("2026-10-10T12:04:59.999Z"))).toEqual(price);
    expect(() => readDisplayZecPrice(price, new Date(price.expiresAt))).toThrow();
    expect(() => readDisplayZecPrice({ ...price, expiresAt: "2026-10-10T12:05:02.000Z" }, now)).toThrow();
  });
  it("neither carries an old price past UTC midnight nor accepts tomorrow's price early", () => {
    const old = { ...price, quotedAt: "2026-10-09T23:59:59.000Z", retrievedAt: "2026-10-09T23:59:59.000Z", expiresAt: "2026-10-10T00:00:00.000Z" };
    expect(readDisplayZecPrice(old, new Date("2026-10-09T23:59:59.999Z"))).toEqual(old);
    expect(() => readDisplayZecPrice(old, new Date("2026-10-10T00:00:00.000Z"))).toThrow();
    const next = { ...price, quotedAt: "2026-10-10T00:00:00.100Z", retrievedAt: "2026-10-10T00:00:00.100Z", expiresAt: "2026-10-10T00:05:00.100Z" };
    expect(() => readDisplayZecPrice(next, new Date("2026-10-09T23:59:59.900Z"))).toThrow();
    expect(() => readDisplayZecPrice({ ...old, retrievedAt: "2026-10-10T00:00:00.100Z" }, new Date("2026-10-09T23:59:59.900Z"))).toThrow();
  });
  it.each([
    { ...price, rateUsdPerZecE8: "0" },
    { ...price, rateUsdPerZecE8: "1000000000000001" },
    { ...price, retrievedAt: "2026-10-10T11:59:59.000Z" },
    { ...price, expiresAt: "2026-10-10T12:06:00.000Z" }
  ])("continues to reject malformed or inconsistent display prices", input => {
    expect(() => readDisplayZecPrice(input, now)).toThrow();
  });
});
