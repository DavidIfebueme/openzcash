import { describe, expect, it } from "vitest";
import { displayZecPriceExpiresAt, formatEstimatedZec, readDisplayZecPrice, readFreshZecPrice } from "@/lib/participate/workspace/domain/zec-price";
import { zcgApprovedBudget, type ApprovedBudgetMap } from "@/lib/participate/workspace/data/zcg-approved-budgets";
import { estimateFundingZat } from "@/lib/participate/workspace/domain/funding-quote";

const officialSource = (issueNumber: number) => ({ issueNumber, url: `https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/${issueNumber}` });
const budget = (usdCents: string) => ({ usdCents,
  sourceUrl: "https://docs.google.com/spreadsheets/d/official-ledger/edit#gid=803214474&range=A889:L893",
  proposalSourceUrl: "https://docs.google.com/spreadsheets/d/official-ledger/edit#gid=1164534734&range=A708",
  sourceRows: [889, 890, 891, 892, 893],
});
// Deliberately different from the former hardcoded budgets: the current ledger wins.
const budgets: ApprovedBudgetMap = { "424": budget("10000"), "438": budget("20000"), "405": budget("30000"), "400": budget("40000"), "454": budget("4500000") };
const now = new Date("2026-10-10T12:00:00Z");
const price = { rateUsdPerZecE8: "33333000000", quotedAt: now.toISOString(), retrievedAt: now.toISOString(), expiresAt: "2026-10-10T12:05:00.000Z" };

describe("public ZEC estimates", () => {
  it("retains the provider's exact rate and computes a supplied approved budget", () => {
    expect(readFreshZecPrice(price, now)).toEqual(price);
    const approved = zcgApprovedBudget(budgets, "zcg-github-454", officialSource(454))!;
    expect(formatEstimatedZec(estimateFundingZat(BigInt(approved.usdCents), 33333000000n))).toBe("135.00");
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
  it.each([
    ["zcg-graphsense-2026-09-28", "424"], ["zcg-ironwood-2026-09-28", "438"],
    ["zcg-mumbai-2026-09-14", "405"], ["zcg-arabia-2026-08-31", "400"],
  ])("resolves legacy archive %s through its official issue metadata", (recordId, issue) => {
    expect(zcgApprovedBudget(budgets, recordId)).toEqual(budgets[issue]);
    expect(zcgApprovedBudget({}, recordId)).toBeNull();
  });
  it("uses the same official issue across preserved archive identities", () => {
    expect(zcgApprovedBudget(budgets, "zcg-github-454", officialSource(454))).toEqual(budgets["454"]);
    expect(zcgApprovedBudget(budgets, "preserved-source-revision-two", officialSource(454))).toEqual(budgets["454"]);
  });
  it("cannot infer approval from a demo title, arbitrary ID or a requested amount", () => {
    for (const id of ["zcg-github-99999", "demo-zcg-github-454", "unreviewed-application", "constructor"]) {
      expect(zcgApprovedBudget(budgets, id)).toBeNull();
    }
    expect(zcgApprovedBudget(budgets, "source-without-budget", officialSource(99999))).toBeNull();
  });
  it.each([
    { issueNumber: 454, url: "https://github.com/another-owner/zcashcommunitygrants/issues/454" },
    { issueNumber: 454, url: "https://github.com.evil.example/ZcashCommunityGrants/zcashcommunitygrants/issues/454" },
    { issueNumber: 454, url: "https://github.com@evil.example/ZcashCommunityGrants/zcashcommunitygrants/issues/454" },
    { ...officialSource(438), issueNumber: 454 },
    { ...officialSource(454), issueNumber: NaN },
  ])("rejects a nonofficial or mismatched source identity", source => {
    expect(zcgApprovedBudget(budgets, "zcg-github-454", source)).toBeNull();
    // A bad capture must not fall back to matching metadata for the legacy ID.
    expect(zcgApprovedBudget(budgets, "zcg-graphsense-2026-09-28", source)).toBeNull();
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
  it("uses a one-hour display deadline without changing the five-minute payment quote", () => {
    expect(readDisplayZecPrice(price, new Date(price.expiresAt))).toEqual(price);
    expect(() => readFreshZecPrice(price, new Date(price.expiresAt))).toThrow();
    expect(readDisplayZecPrice(price, new Date("2026-10-10T12:59:59.999Z"))).toEqual(price);
    expect(displayZecPriceExpiresAt(now).toISOString()).toBe("2026-10-10T13:00:00.000Z");
    expect(() => readDisplayZecPrice(price, new Date("2026-10-10T13:00:00.000Z"))).toThrow();
    expect(() => readDisplayZecPrice({ ...price, expiresAt: "2026-10-10T12:05:02.000Z" }, now)).toThrow();
  });
  it("does not renew the display window from retrieval time", () => {
    const retrieved = { ...price, retrievedAt: "2026-10-10T12:04:00.000Z" };
    expect(readDisplayZecPrice(retrieved, new Date("2026-10-10T12:59:59.999Z"))).toEqual(retrieved);
    expect(() => readDisplayZecPrice(retrieved, new Date("2026-10-10T13:00:00.000Z"))).toThrow();
    expect(displayZecPriceExpiresAt(new Date("2026-10-10T23:40:00Z")).toISOString()).toBe("2026-10-11T00:00:00.000Z");
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
