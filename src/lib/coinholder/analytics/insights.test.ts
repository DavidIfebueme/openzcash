import { describe, expect, it } from "vitest";
import { formatInsightZec, insightGap, insightMargin, insightPercent } from "@/lib/coinholder/analytics/insights";

describe("Coinholder insight precision", () => {
  it("retains exact decimal amounts beyond the safe Number range", () => {
    expect(formatInsightZec("12345678901234567890.125")).toBe("12,345,678,901,234,567,890.125");
    expect(formatInsightZec("1833.750")).toBe("1,833.75");
    expect(formatInsightZec("0.000")).toBe("0");
    expect(() => formatInsightZec("NaN")).toThrow("Invalid ZEC amount");
  });

  it("distinguishes valid zero from an absent denominator", () => {
    expect(insightPercent(0n, 10n)).toBe(0);
    expect(insightPercent(0n, 0n)).toBeNull();
    expect(insightMargin(0n, 0n)).toBeNull();
    expect(insightGap(0, 0, "0", "0")).toBeNull();
  });

  it("computes the percentage-point gap before rounding either percentage", () => {
    const gap = insightGap(1336, 4029, "636064", "17451615");
    expect(gap?.toFixed(2)).toBe("-29.51");
    expect((insightPercent(636064n, 17451615n)! - insightPercent(1336n, 4029n)!).toFixed(2)).toBe("-29.51");
    expect(insightGap(1494, 3903, "486153", "17433679")?.toFixed(2)).toBe("-35.49");
  });

  it("keeps strict-majority boundary precision without using rounded display values", () => {
    expect(insightMargin(50n, 100n)).toBe(0);
    expect(insightMargin(50000001n, 100000000n)).toBeGreaterThan(0);
    expect(insightMargin(49999999n, 100000000n)).toBeLessThan(0);
    expect(insightMargin(100n, 100n)).toBe(50);
    expect(insightMargin(0n, 100n)).toBe(-50);
  });
});
