import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { filterCovers, resolveCover, stockCovers, stockCoverUrl } from "./covers";
it("retains all 29 landscape PNG covers for selection and download", () => {
  expect(stockCovers).toHaveLength(29);
  expect(new Set(stockCovers.map((c) => c.id)).size).toBe(29);
  for (const c of stockCovers) {
    const bytes = readFileSync(new URL("../../../public" + stockCoverUrl(c.id), import.meta.url));
    expect(bytes.subarray(1, 4).toString()).toBe("PNG");
    expect(bytes.readUInt32BE(16)).toBe(1536); expect(bytes.readUInt32BE(20)).toBe(1024);
  }
});
it("keeps manual choices and only resolves known local artwork", () => {
  expect(resolveCover("zingo", "Development")).toBe("zingo");
  expect(resolveCover(undefined, "Research", "HashSmash challenge")).toBe("hashsmash");
  for (const value of ["../../secret", "https://example.com/image.png", "upload:old"]) expect(resolveCover(value, "Design")).toBe("design");
  expect(stockCoverUrl("../../secret")).toBe("/opportunities/art/code.png?v=20261103-paper-3");
});
it("finds wallet, infrastructure and challenge artwork", () => {
  expect(resolveCover(undefined, "Content", "Create a Zcash NU7 video")).toBe("nu7");
  expect(resolveCover(undefined, "Content", "Review the ZecHub glossary")).toBe("zechub");
  expect(filterCovers("", "Wallets")).toHaveLength(10);
  expect(filterCovers("yukon").map((c) => c.id)).toEqual(["hashsmash"]);
  expect(filterCovers("zakura", "Wallets")).toEqual([]);
});
