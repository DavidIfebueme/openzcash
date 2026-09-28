import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { searchKnowledge, knowledgeCoverage } from "./knowledge";
import { compactData } from "./data";
import { decimalUnits, ledgerQuerySchema } from "./ledger";
import { systemPrompt } from "./prompt";
describe("Local knowledge coverage and size", () => {
  it.each([["como funciona a metodologia dos pagamentos", "/zcg/methodology"], ["Zcash ceremony participants", "/ceremony/people"], ["viewing keys sender recipient", "zip-0310"], ["treasury calculator cypherpunk", "treasury-calculator"]])("finds relevant public material: %s", (q, target) => {
    expect(searchKnowledge(q).some((d) => d.url.includes(target))).toBe(true);
  });
  it("keeps full-key scope attached to isolated ZIP 310 excerpts", () => {
    const docs = searchKnowledge("ZIP 310 new unspent note nullifier incoming IVK");
    const excerpts = docs.filter((doc) => doc.id.startsWith("reference:zip-0310:"));
    expect(excerpts.length).toBeGreaterThan(0);
    expect(excerpts.every((doc) => doc.snapshotNote?.includes("full Sapling viewing key (FVK)"))).toBe(true);
    expect(excerpts.every((doc) => doc.snapshotNote?.includes("incoming viewing key alone cannot derive nullifiers"))).toBe(true);
  });
  it("indexes the explicit public collection and keeps selected context small", () => {
    expect(knowledgeCoverage.sourceFiles).toBeGreaterThan(45);
    const docs = searchKnowledge("Zcash funding governance methodology ceremony grants treasury");
    expect(docs.length).toBeLessThanOrEqual(4);
    expect(JSON.stringify(docs).length).toBeLessThanOrEqual(5000);
    expect(docs.every((d) => !/\/(?:admin|viewing-keys|login|invites)(?:\/|$)/.test(d.url))).toBe(true);
  });
  it("does not inject the full navigation or a changing clock into the system prefix", () => {
    expect(systemPrompt()).not.toContain("PUBLIC SITE GUIDE");
    expect(systemPrompt().length).toBeLessThan(6200);
  });
  it("bounds large, escaped and deeply nested records without losing freshness markers", () => {
    const input = { stale: true, importedAt: "2026-09-26", rows: Array.from({ length: 200 }, () => ({ name: "A", text: '\"\\'.repeat(2000), amount: 100 })) };
    const result = compactData(input);
    expect(JSON.stringify(result).length).toBeLessThanOrEqual(5000);
    expect(result.partial).toBe(true);
    expect(result.data).toMatchObject({ stale: true, importedAt: "2026-09-26" });
  });
  it("preserves exact money units, negative refunds and validated programs", () => {
    expect(decimalUnits(123456789123456789n, 8)).toBe("1234567891.23456789");
    expect(decimalUnits(-3n, 2)).toBe("-0.03");
    expect(decimalUnits(0n, 8)).toBe("0.00000000");
    expect(ledgerQuerySchema.parse({ scope: "coinholder_grants", year: null, search: "100%_project" }).search).toBe("100%_project");
  });
});
