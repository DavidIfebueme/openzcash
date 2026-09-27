import { describe, expect, it } from "vitest";
import { unsupportedAmounts } from "./grounding";

const evidence = [{ content: JSON.stringify({ data: { price: { usd: 100 } } }) }];
describe("Pre-production audit: rendered financial claims", () => {
  it.each([
    "[$999 billion](https://z.cash/)",
    "[**$999 billion**](https://z.cash/)",
    "[$999 billion][source]\n\n[source]: https://z.cash/",
    "$&#57;&#57;&#57; billion",
    "$9**99** billion",
    "&#36;999 billion",
  ])("rejects unsupported money in rendered Markdown: %s", (text) => {
    expect(unsupportedAmounts(text, evidence)).not.toEqual([]);
  });
  it("allows supported amounts in source links without checking hidden URL parameters", () => {
    expect(unsupportedAmounts("[$100](https://z.cash/?example=999USD)", evidence)).toEqual([]);
  });
});
