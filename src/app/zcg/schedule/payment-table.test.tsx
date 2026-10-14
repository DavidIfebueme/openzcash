import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PaymentTable } from "./payment-table";

const grant = {
  id: "coinholder", project: "ZODL Q1 & Q2 2026 Core Protocol Development",
  sourceSheet: "coinholder_grants", grantStatus: "open", isPaid: false,
  isTest: false, isInternal: false, estimatedPayoutDate: "2026-10-13",
  amountUsdCents: 195000000n, category: "Infrastructure", recipientNameRaw: "ZODL",
  milestoneLabel: null, deliverable: null, sourceSheetGid: "722519692",
  sourceRowIndex: 11, importedAt: new Date("2026-10-11T02:17:05Z"),
};

describe("payment schedule records", () => {
  it("renders amount, date, payment status and original source for a past grant", () => {
    const html = renderToStaticMarkup(<PaymentTable rows={[grant]} label="Past estimates" empty="No entries" />);
    expect(html).toContain("$1,950,000");
    expect(html).toContain("2026-10-13");
    expect(html).toContain("Payment not recorded");
    expect(html).toContain("722519692");
    expect(html).toContain("Sheet row 12");
    expect(html).toContain('role="table"');
    expect(html).toContain('role="columnheader"');
    expect(html).toContain('role="cell"');
  });
  it("labels missing amounts without displaying a zero or payment claim", () => {
    const html = renderToStaticMarkup(<PaymentTable rows={[{...grant, amountUsdCents: null}]} label="Past estimates" empty="No entries" />);
    expect(html).toContain("Not recorded");
    expect(html).not.toContain("$0");
    expect(html).not.toContain("Overdue payment");
  });
  it("uses the supplied empty state when the filtered section has no records", () => {
    const html = renderToStaticMarkup(<PaymentTable rows={[]} label="Past estimates" empty="No past estimates match this category." />);
    expect(html).toContain("No past estimates match this category.");
    expect(html).not.toContain("<table");
  });
});
