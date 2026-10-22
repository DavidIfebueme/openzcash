import { describe, expect, it } from "vitest";
import { normalizeAlias } from "./session";

describe("private chat aliases", () => {
  it("normalizes whitespace and composition", () => {
    expect(normalizeAlias("  João   Z ")).toBe("João Z");
    expect(normalizeAlias("Zcash_BR-01")).toBe("Zcash_BR-01");
    expect(normalizeAlias("José")).toBe("José");
  });
  it("rejects empty, long, marked-up and invisible-character aliases", () => {
    for (const alias of [
      "",
      "a",
      "a".repeat(25),
      "<script>",
      "alice‮",
      "a​b",
      "https://example.com",
    ]) {
      expect(normalizeAlias(alias)).toBeNull();
    }
  });
});
