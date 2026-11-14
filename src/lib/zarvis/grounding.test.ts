import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { PROTOCOL_FACTS, amountClaims, isFinancialQuestion, numericFacts, unsupportedAmounts, verifiedSentences } from "./grounding";
import { KNOWLEDGE } from "./sources";
import { BLOCK_SUBSIDY_ALLOCATION, compactData, derivedTreasuryFacts, treasuryContext } from "./data";
import { valueReportedDevFund } from "@/lib/treasury/dev-fund";

// Shape of the live "treasuries" lookup on 2026-09-28; the Lockbox estimate accrues per block, so figures are fixtures, not live values.
const funds = {
  zcg: { paidMilestonesUsd: 21507071, zec: 88435, cashUsd: 8816950, snapshotAt: "2026-09-23T20:16:00Z", importedAt: "2026-09-27T03:00:00Z", updatesRequired: true, sourceUrl: "https://docs.google.com/spreadsheets/d/zcg" },
  lockbox: { zec: 144333.7875, height: 3499201, baselineHeight: 3493796, snapshotAt: "2026-09-23T20:16:00Z", importedAt: "2026-09-27T03:00:00Z", updatesRequired: false, sourceUrl: "https://docs.google.com/spreadsheets/d/lockbox" },
};
const price = { cents: 159280, quotedAt: "2026-09-28T11:30:00Z", fetchedAt: "2026-09-28T11:30:00Z", stale: false };
const supply = { zec: 16945106, quotedAt: "2026-09-28T11:30:00Z", fetchedAt: "2026-09-28T11:30:00Z", stale: false };
const treasuriesEvidence = () => [{ content: JSON.stringify({ sourceUrl: "https://openzcash.org/zcg/treasury-calculator", retrievedAt: "2026-09-28T11:36:00Z", ...compactData({ funds: treasuryContext(funds), derived: derivedTreasuryFacts(funds, price, supply), allocation: BLOCK_SUBSIDY_ALLOCATION, price, supply }) }) }];

describe("Derived treasury facts", () => {
  it("reproduces the footer's per-pool cent rounding, ZEC totals and shares", () => {
    const d = derivedTreasuryFacts(funds, price, supply);
    expect(d).toMatchObject({ zcgValueUsd: 140859268, zcgTotalUsd: 149676218, lockboxValueUsd: 229894856.73, combinedZec: 232768.7875, combinedZecValueUsd: 370754124.73, zcgShareOfCombinedPercent: 37.99, lockboxShareOfCombinedPercent: 62.01, lockboxShareOfGrossValuePercent: 60.57, zcgShareOfSupplyPercent: 0.52, combinedShareOfSupplyPercent: 1.37 });
    expect(d.combinedGrossValueUsd).toBe(valueReportedDevFund(funds, 1592.8));
    expect(BLOCK_SUBSIDY_ALLOCATION).toMatchObject({ zcgPercent: 8, lockboxPercent: 12, devFundPercent: 20, minerPercent: 80, lockboxPerBlockZec: 0.06249999, zcgPerBlockZec: 0.04166666, blockSubsidyZec: 0.52083333, sinceBlock: 3_543_405, targetBlockSpacingSeconds: 25, blocksPerDay: 3456, untilBlock: 6_132_390, beforeNu7: { untilBlock: 3_543_404, targetBlockSpacingSeconds: 75, blocksPerDay: 1152, blockSubsidyZec: 1.5625, zcgPerBlockZec: 0.125, lockboxPerBlockZec: 0.1875, minerPerBlockZec: 1.25 } });
  });
  it("never turns a missing price, supply or pool into zero", () => {
    const noPrice = derivedTreasuryFacts(funds, null, supply);
    expect(noPrice).toMatchObject({ zcgValueUsd: null, combinedGrossValueUsd: null, combinedZec: 232768.7875, combinedShareOfSupplyPercent: 1.37 });
    const noZcg = derivedTreasuryFacts({ zcg: null, lockbox: funds.lockbox }, price, null);
    expect(noZcg).toMatchObject({ lockboxValueUsd: 229894856.73, zcgValueUsd: null, combinedZec: null, combinedGrossValueUsd: null, lockboxShareOfSupplyPercent: null });
    expect(JSON.stringify([noPrice, noZcg])).not.toMatch(/NaN|:0[,}]/);
    expect(derivedTreasuryFacts(funds, { cents: 0 }, supply).zcgValueUsd).toBeNull();
  });
  it("maps every derived key to the unit the guard expects, on top of the protocol constants", () => {
    const units = numericFacts([{ content: JSON.stringify({ data: { derived: derivedTreasuryFacts(funds, price, supply), allocation: BLOCK_SUBSIDY_ALLOCATION } }) }]).slice(PROTOCOL_FACTS.length).map((f) => f.unit);
    expect(units.filter((u) => u === "USD")).toHaveLength(5); expect(units.filter((u) => u === "ZEC")).toHaveLength(9); expect(units.filter((u) => u === "%")).toHaveLength(11);
    expect(numericFacts([])).toEqual(PROTOCOL_FACTS);
  });
});

describe("Protocol facts", () => {
  it("support the per-block figures of both eras, derived from the schedule", () => {
    const zec = PROTOCOL_FACTS.filter((f) => f.unit === "ZEC").map((f) => f.value);
    for (const value of [1.5625, 0.125, 0.1875, 1.25, 0.52083333, 0.04166666, 0.06249999, 0.41666668]) expect(zec).toContain(value);
  });
});

describe("Treasury arithmetic in model answers", () => {
  const evidence = treasuriesEvidence();
  it.each([
    "$140.9 million", "$140,859,268", "about $229.9 million", "$149.7 million", "$371 million", "$379.6 million", "232,769 ZEC", "232.8K ZEC",
    "62%", "38%", "60.6%", "1.37%", "0.52%", "8%", "12%", "20%", "80%", "0.1875 ZEC", "1.5625 ZEC", "0.125 ZEC", "0,125 ZEC", "1.25 ZEC", "0.06249999 ZEC", "0.52083333 ZEC", "0.04166666 ZEC", "0.41666668 ZEC", "1 ZEC = $1,592.80",
  ])("supports the site's own derived figure: %s", (text) => expect(unsupportedAmounts(text, evidence)).toEqual([]));
  it.each(["$500 million", "150,000 ZEC", "99%", "R$ 140,9 milhões", "$10 million", "$999 billion", "0.3 ZEC per block", "0.135 ZEC"])("still rejects figures that are not the site's arithmetic: %s", (text) => expect(unsupportedAmounts(text, evidence)).not.toEqual([]));
  it.each([
    "ZCG holds $8,816,950.00.", "The quote is $1,592.80, as of 11:30 UTC.", "**$1,592.80**.", "US$ 1.592,80.", "US$ 1.592,80, obtida hoje.",
    "Estimate through block 3,499,201. ZEC is quoted at $1,592.80.", "Report dated September 23, 2026. USD cash is $8,816,950.", "Imported September 27, 2026, ZEC balance 88,435 ZEC.",
  ])("does not read sentence punctuation as a separator or a unit across sentences: %s", (text) => expect(unsupportedAmounts(text, evidence)).toEqual([]));
  it("keeps the fallback's guarantee: an evidence stub without figures supports nothing", () => {
    expect(unsupportedAmounts("$140.9 million", [{ content: JSON.stringify({ sourceUrl: "https://openzcash.org/zcg/treasury-calculator", error: "unavailable" }) }])).toEqual(["$140.9 million"]);
  });
  it.each(["$140,859,268 (rounded: $140,859,000)", "$140,859,000", "$3.5M", "about $3.5M", "roughly 40%", "$5,000,000 in total", "150,000 ZEC", "0.135 ZEC", "99%"])("rejects a wrong or invented figure even near a real one: %s", (text) => expect(unsupportedAmounts(text, evidence)).not.toEqual([]));
  it.each(["144,333 ZEC", "$1,592", "232,768 ZEC", "$370,754,124", "$229,894,856"])("accepts integer truncation of a cents or fraction value: %s", (text) => expect(unsupportedAmounts(text, evidence)).toEqual([]));
  // Three significant digits of 140,859,268 are 141 million: "approximately $140 million" is one step low, not an approximation.
  it.each(["$8 million", "$140 million", "$140.8 million", "approximately $140 million", "about $1,600", "$229 million", "37%", "60.5%", "232.7K ZEC"])("never reads a scaled or percent figure one step low as a truncation: %s", (text) => expect(unsupportedAmounts(text, evidence)).not.toEqual([]));
  it.each(["about $140,859,000", "roughly $141 million", "approximately $140.9 million", "~$141M", "cerca de US$ 141 milhões", "aproximadamente 38%", "around 1.4%"])("accepts three-significant-digit rounding behind an approximation word: %s", (text) => expect(unsupportedAmounts(text, evidence)).toEqual([]));
});

describe("Ledger figures in model answers", () => {
  const ledger = [{ content: JSON.stringify({ data: { filters: { year: 2024, scope: "zcg_grants", search: "" }, importedAt: "2026-09-27T00:00:00Z", budgetedUsdOfPaidEntries: "3396155.67", recordedZecPaid: "9235.26", paidEntries: 40, paidEntriesMissingUsd: 0, paidEntriesMissingZec: 0 } }) }];
  it.each(["$3,396,155", "$3,396,156", "$3,396,155.67", "$3.396M", "$3.396 million", "$3.40 million", "about $3.4M", "roughly $3,400,000", "US$ 3.396.155,67", "9,235 ZEC", "9.235,26 ZEC"])("supports a truncated, rounded or scaled reading of the ledger total: %s", (text) => expect(unsupportedAmounts(text, ledger)).toEqual([]));
  it.each(["$3.5M", "about $3.5M", "$3.3M", "about $3.3M", "$3.39 million", "$3,396,000", "$3,400,000", "$3,396,157", "$339,615,567", "3,396,155.67 ZEC", "$9,235.26"])("still rejects a wrong reading: %s", (text) => expect(unsupportedAmounts(text, ledger)).not.toEqual([]));
  it("rounds a scaled claim at its own precision instead of truncating it", () => {
    const facts = [{ content: JSON.stringify({ data: { totalUsd: 1_990_000_000 } }) }];
    expect(unsupportedAmounts("$1 billion", facts)).toEqual(["$1 billion"]);
    expect(unsupportedAmounts("$2 billion", facts)).toEqual([]);
    expect(unsupportedAmounts("$1.99 billion", facts)).toEqual([]);
  });
  it("reads M and million suffixes as millions, keeping both readings of an ambiguous token", () => {
    const [claim] = amountClaims("$3.396 million");
    expect(claim).toMatchObject({ unit: "USD", scale: 1e6, approximate: false });
    expect(claim.readings.map((r) => r.value)).toEqual([3.396, 3396]);
    expect(amountClaims("about $3.4M")[0]).toMatchObject({ approximate: true, scale: 1e6 });
  });
});

describe("Reviewed knowledge in the guard", () => {
  const evidence = treasuriesEvidence();
  const notes = KNOWLEDGE.filter((note) => ["issuance", "funding", "calculator"].includes(note.id)).map((note) => ({ text: `${note.keywords}\n${note.text}` }));
  it.each(["21 million ZEC", "1,050,000 ZEC", "5% of 21 million ZEC", "8% and 12%", "20% leaves 80%", "a 25% relative increase", "0.125 ZEC per block", "0.1875 ZEC", "1.25 ZEC", "1.5625 ZEC", "0.52083333 ZEC", "0.04166666 ZEC", "0.06249999 ZEC", "0.41666668 ZEC", "75 seconds", "25 seconds", "1,680,000 blocks", "5,040,000 blocks", "height 6,132,390"])("never flags a protocol constant, with or without notes: %s", (text) => {
    expect(unsupportedAmounts(text, evidence)).toEqual([]); expect(unsupportedAmounts(text, [])).toEqual([]);
  });
  it("accepts a figure only because the selected reviewed note states it", () => {
    expect(unsupportedAmounts("4.24%", evidence)).toEqual(["4.24%"]);
    expect(unsupportedAmounts("4.24%", evidence, notes)).toEqual([]);
    expect(unsupportedAmounts("4.25%", evidence, notes)).toEqual(["4.25%"]);
  });
  it("does not let a Brazilian-real figure in a note vouch for a dollar claim", () => expect(unsupportedAmounts("$5", [], [{ text: "R$ 5" }])).toEqual(["$5"]));
});

describe("Verified sentences after a failed repair", () => {
  const facts = numericFacts(treasuriesEvidence());
  it("drops only the sentences with withheld figures and keeps dated, verified ones", () => {
    const kept = verifiedSentences("ZCG holds 88,435 ZEC. That is worth $999 billion today. The Lockbox estimate is 144,333.79 ZEC through block 3,499,201.\n\n- Cash: $8,816,950.\n- Invented: $5,000,000.", facts);
    expect(kept).toBe("ZCG holds 88,435 ZEC. The Lockbox estimate is 144,333.79 ZEC through block 3,499,201.\n\n- Cash: $8,816,950.");
    expect(kept).not.toMatch(/999|5,000,000/);
  });
  it("returns nothing when no figure or date survives", () => {
    expect(verifiedSentences("The treasury has $999 billion ready to spend.", facts)).toBeUndefined();
    expect(verifiedSentences("Balances are healthy. Spending is $999 billion.", facts)).toBeUndefined();
  });
  it("keeps a dated sentence without figures", () => expect(verifiedSentences("The report is dated September 23, 2026. It shows $999 billion.", facts)).toBe("The report is dated September 23, 2026."));
});

describe("Financial questions are buffered before evidence arrives", () => {
  it.each(["What does ZCG hold?", "Analyze a treasury scenario", "Quanto o ZCG pagou em grants?", "If ZEC rises 20x, what changes?", "What is the ZEC price?", "How much was the wallet team funded?", "Who funds the ECC?", "What are the transaction fees?", "What is the miner reward per block?", "How much does the ZF earn?", "Quanto a Fundação recebeu em taxas?", "Did ZCG sell any ZEC?"])("guards %s", (q) => expect(isFinancialQuestion(q)).toBe(true));
  it.each(["Who is Zooko?", "What is a viewing key?", "Como funciona a privacidade do Zcash?", "What is ZIP 317?", "How does a shielded memo work?"])("streams %s", (q) => expect(isFinancialQuestion(q)).toBe(false));
});

