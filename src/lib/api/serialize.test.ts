import { describe, expect, it } from "vitest";

import { toCsv } from "./serialize";

describe("toCsv", () => {
  it("serializes plain rows with a header line", () => {
    expect(toCsv([{ a: 1, b: "x" }])).toBe("a,b\n1,x");
  });

  it("quotes cells containing separators, quotes and newlines", () => {
    expect(toCsv([{ a: 'has "quote"', b: "line\nbreak", c: "com,ma" }])).toBe(
      'a,b,c\n"has ""quote""","line\nbreak","com,ma"',
    );
  });

  it("renders null and undefined as empty cells", () => {
    expect(toCsv([{ a: null, b: undefined }])).toBe("a,b\n,");
  });

  it("prefixes formula-shaped cells with a guard apostrophe", () => {
    const rows = [
      { title: "=SUM(A1:A2)", note: "+cmd|'/c calc'!A0", at: "@f(x)", tab: "\tTabStart" },
    ];
    const csv = toCsv(rows);
    expect(csv).toContain("'=SUM(A1:A2)");
    expect(csv).toContain("'+cmd|'/c calc'!A0");
    expect(csv).toContain("'@f(x)");
    expect(csv).toContain("'\tTabStart");
  });

  it("keeps negative numbers and currency-like cells untouched", () => {
    expect(toCsv([{ amount: -12.5, code: "-TXT-" }])).toBe("amount,code\n-12.5,-TXT-");
  });

  it("guards formula characters even inside quoted cells", () => {
    const csv = toCsv([{ title: '=HYPERLINK("http://x","a,b")' }]);
    expect(csv).toBe('title\n"\'=HYPERLINK(""http://x"",""a,b"")"');
  });
});
