import { describe, expect, it } from "vitest";
import { monthlySourceCsv } from "./source-csv";

describe("monthly source export", () => {
  it("keeps paid and requested amounts distinct", () => {
    const csv = monthlySourceCsv([
      { name: "Payment", detail: "October", url: "https://example.org/paid", amount: 7980, amountLabel: "Paid USD" },
      { name: "Proposal", detail: "Pending", url: "https://example.org/request", amount: 9000, amountLabel: "Requested USD" },
    ]);
    expect(csv).toContain("Amount USD,Amount label");
    expect(csv).toContain('"7980","Paid USD"');
    expect(csv).toContain('"9000","Requested USD"');
  });

  it("preserves a known zero and leaves unknown or ranged amounts unfilled", () => {
    const csv = monthlySourceCsv([
      { name: "Zero", detail: "Recorded", url: "https://example.org/0", amount: 0 },
      { name: "Unknown", detail: "No value", url: "https://example.org/unknown", amount: null },
      { name: "Range", detail: "Estimate", url: "https://example.org/range", amountLabel: "$60,000–$120,000 range" },
    ]);
    expect(csv).toContain('"Recorded","0",""');
    expect(csv).toContain('"No value","",""');
    expect(csv).toContain('"Estimate","","$60,000–$120,000 range"');
  });

  it("quotes commas, double quotes and newlines without losing source text", () => {
    const csv = monthlySourceCsv([{ name: 'A, "B"', detail: "First\nSecond", url: "https://example.org" }]);
    expect(csv).toContain('"A, ""B""","First\nSecond"');
  });
});
