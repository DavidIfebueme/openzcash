import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { treasuryAnswer, numberedZipAnswer } from "./direct-data";
import { bundledZipCorpus } from "./knowledge";
import { valueReportedDevFund } from "@/lib/treasury/dev-fund";
const now = () => new Date().toISOString();
const data = () => ({ funds: {
  zcg: { zec: 10.001, cashUsd: 50, paidMilestonesUsd: 9999999, sourceUrl: "https://openzcash.org/zcg/reconciliation", snapshotAt: "2026-09-16T00:00:00Z", importedAt: now(), updatesRequired: true },
  lockbox: { estimatedZec: 20.001, estimateThroughBlock: 3493051, sourceAnchorBlock: 3400000, sourceAnchorDate: "2026-09-01T00:00:00Z", importedAt: now(), updatesRequired: false },
}, price: { cents: 12345, quotedAt: now(), stale: false } });
const corpus = () => ({ ...bundledZipCorpus, retrievedAt: now() });

describe("Deterministic treasury facts", () => {
  it("keeps cash, past spending, quote and two separate pools distinct; rounds like the footer", () => {
    const d = data();
    const text = treasuryAnswer(JSON.stringify({ data: d }), "both", false);
    const value = valueReportedDevFund({ zcg: d.funds.zcg, lockbox: { ...d.funds.lockbox, zec: d.funds.lockbox.estimatedZec, height: 3493051, baselineHeight: 3400000, snapshotAt: "2026-09-01", sourceUrl: "https://openzcash.org/lockbox" } }, 123.45);
    expect(text).toContain(new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value!));
    expect(text).toContain("$123.45 per ZEC"); expect(text).toContain("$50.00 USD cash");
    expect(text).not.toContain("9,999,999"); expect(text).toContain("3,493,051");
    expect(text).toContain("not a fresh wallet reading"); expect(text).toContain("Later outflows");
    expect(text).toContain("needing updates"); expect(text).toContain("separate spending restrictions");
  });
  it("does not include the other pool in a single-fund valuation", () => {
    const text = treasuryAnswer(JSON.stringify({ data: data() }), "zcg", false);
    expect(text).toContain("gross value: $1,284.62"); expect(text).not.toContain("Lockbox — estimate");
  });
  it.each(["{}", "bad json", '{"data":{"funds":{"zcg":null,"lockbox":null}}}'])("does not turn absent data into zero: %s", (content) => {
    const text = treasuryAnswer(content, "both", false);
    expect(text).toContain("unavailable"); expect(text).not.toMatch(/NaN|\$0\.00|gross value:/);
  });
  it("does not combine incomplete holdings or an unknown cash amount", () => {
    const d = data();
    const content = JSON.stringify({ data: { ...d, funds: { ...d.funds, zcg: { ...d.funds.zcg, cashUsd: null } } } });
    expect(treasuryAnswer(content, "both", false)).toContain("USD cash not reported");
    expect(treasuryAnswer(content, "both", false)).not.toContain("gross value:");
  });
  it.each([null, { cents: 10000, quotedAt: null, stale: false }, { cents: 10000, quotedAt: "2200-01-01", stale: false }])("does not price holdings using an invalid quote: %j", (price) => {
    expect(treasuryAnswer(JSON.stringify({ data: { ...data(), price } }), "both", false)).toContain("valid USD quote is unavailable");
  });
  it("marks cached valuations explicitly and provides Portuguese output", () => {
    const d = data(); d.price.quotedAt = "2026-01-01T00:00:00Z";
    const content = JSON.stringify({ data: d });
    expect(treasuryAnswer(content, "both", false)).toContain("cached; not confirmed current");
    expect(treasuryAnswer(content, "both", true)).toContain("não confirmada como atual");
  });
});

describe("Official numbered ZIP excerpts", () => {
  it("keeps exact numbers and revision-specific status, not an activation claim", () => {
    const c = corpus(); const d = c.documents.find((d) => d.number === 317)!;
    const answer = numberedZipAnswer(317, true, c, false, false)!;
    expect(answer).toContain(d.sourceUrl); expect(answer).toContain("ZIP 317");
    expect(answer).toContain("Revision 0"); expect(answer).toContain("Revision 1");
    expect(answer).toContain("does not establish network activation"); expect(answer).toContain("Official abstract excerpt");
  });
  it.each([
    "Abstract\n========\n\nFirst official line\nand its continuation.\n\nSecond paragraph.",
    "# Abstract\n\nFirst official line\nand its continuation.\n\nSecond paragraph.",
  ])("extracts only a bounded first abstract paragraph", (text) => {
    const c = corpus(); c.documents = c.documents.map(d => d.number === 317 ? { ...d, text } : d);
    const answer = numberedZipAnswer(317, true, c, false, true)!;
    expect(answer).toContain("First official line and its continuation."); expect(answer).not.toContain("Second paragraph"); expect(answer).toContain("em inglês");
    expect(numberedZipAnswer(317, false, c, false, false)).not.toContain("abstract excerpt");
  });
  it("does not invent a missing abstract, date, unknown ZIP or stale status", () => {
    const c = corpus(); c.documents = c.documents.map(d => d.number === 317 ? { ...d, text: "Reserved", createdOn: null } : d);
    expect(numberedZipAnswer(317, true, c, false, false)).toContain("not specified");
    expect(numberedZipAnswer(317, true, c, false, false)).not.toContain("abstract excerpt");
    expect(numberedZipAnswer(99999, true, c, false, false)).toBeUndefined();
    expect(numberedZipAnswer(317, true, c, true, false)).toBeUndefined();
  });
  it("rejects unsafe citations", () => {
    const c = corpus(); c.documents = c.documents.map(d => d.number === 317 ? { ...d, sourceUrl: "https://attacker.example/zip" } : d);
    expect(numberedZipAnswer(317, true, c, false, false)).toBeUndefined();
  });
});
