import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import cases from "./evaluation-cases.json";
import { searchKnowledge } from "./knowledge";
import { computeScenario, scenarioAnswer, type ScenarioSnapshot } from "./scenario";
import { mergeScenario, scenarioAssumptionsSchema } from "./scenario-input";
import { readScenarioLink } from "@/lib/treasury/scenario-link";
import { calculateTreasuryScenario } from "@/lib/treasury/calculator";
import { sessionPreferences, sessionSchema } from "./session";
import { conversationContext } from "./context";
import { unsupportedAmounts, ledgerComparisonEvidence } from "./grounding";
import { estimateUsageUsd, acquireGeneration, feedbackTicket, recordFeedback, recordGeneration, resetMetricsForTests, metricsSnapshot } from "./metrics";
import { chatRequestSchema } from "./validation";
import type { ChatMessage } from "./types";

const snapshot: ScenarioSnapshot = {
  price: { usd: 100, quotedAt: "2026-09-27T12:00:00Z", stale: false },
  supply: { zec: 16945106, quotedAt: "2026-09-27T12:00:00Z", stale: false }, chain: { height: 3492985 },
  funds: { zcg: { zec: 80000, cashUsd: 8000000, paidMilestonesUsd: 20000000, snapshotAt: "2026-09-16T00:00:00Z", importedAt: "2026-09-27T00:00:00Z", updatesRequired: true, sourceUrl: "https://openzcash.org/zcg" }, lockbox: { zec: 140000, height: 3492985, baselineHeight: 3400000, snapshotAt: "2026-09-16T00:00:00Z", importedAt: "2026-09-27T00:00:00Z", updatesRequired: false, sourceUrl: "https://openzcash.org/lockbox" } },
};
describe("Retrieval evaluation — public question set, no model grading", () => {
  it.each(cases)("$question", ({ question, sourceContains }) => {
    const docs = searchKnowledge(question);
    expect(docs.some((doc) => doc.url.includes(sourceContains)), docs.map((d) => d.url).join("\n")).toBe(true);
    expect(JSON.stringify(docs).length).toBeLessThanOrEqual(5000);
  });
  it.each(["weather in Paris tomorrow", "lasagne recipe ingredients", "futebol resultado flamengo", "zzzzunknownphrasezzzz"])("abstains on unmatched subject: %s", (question) => expect(searchKnowledge(question)).toEqual([]));
});
describe("Treasury scenarios — independently checkable invariants", () => {
  it("uses exactly 1,050,000 ZEC for 5% of maximum supply", () => expect(computeScenario({ supplyBasis: "maximum" }, {}, snapshot).company.todayTargetZec).toBe(1050000));
  it("uses the circulating denominator and grows the target with issuance", () => {
    const c = computeScenario({ years: 10 }, {}, snapshot).company;
    expect(c.todayTargetZec).toBeCloseTo(847255.3, 6); expect(c.futureTargetZec).toBeGreaterThan(c.todayTargetZec);
  });
  it("a 20x price scales the purchase cost, not the ZEC deficit or mining years", () => {
    const a = computeScenario({ years: 30 }, {}, snapshot), b = computeScenario({ years: 30, priceMultiple: 20 }, {}, snapshot);
    expect(b.company.futureGapZec).toBe(a.company.futureGapZec); expect(b.company.futurePurchaseUsd).toBeCloseTo(a.company.futurePurchaseUsd * 20, 3);
    expect(b.company.yearsToTarget).toBe(a.company.yearsToTarget);
  });
  it("matches the website engine across the next halving", () => {
    const s = computeScenario({ years: 30, priceMultiple: 20 }, {}, snapshot);
    expect(s.company).toEqual(calculateTreasuryScenario(s.input));
    expect(s.company.projectedMinedZec).toBeLessThan(s.company.miningPerDayZec * 30 * 365.25);
  });
  it("continuing funding reduces eventual retained miner ownership", () => {
    const ends = computeScenario({ years: 30 }, {}, snapshot), continues = computeScenario({ years: 30, continueDevFundAfterHalving: true }, {}, snapshot);
    expect(continues.company.terminalSharePercent).toBeLessThan(ends.company.terminalSharePercent);
    expect(continues.company.futureGapZec).toBeGreaterThan(ends.company.futureGapZec);
  });
  it("changing other miners' sales changes flow, not the company's ownership", () => {
    const a = computeScenario({}, {}, snapshot), b = computeScenario({ otherMinerSalePercent: 50 }, {}, snapshot);
    expect(b.company.potentialMarketSalesPerDayZec).toBeLessThan(a.company.potentialMarketSalesPerDayZec);
    expect(b.company.futureSharePercent).toBe(a.company.futureSharePercent);
  });
  it("higher price increases coverage of a fixed USD budget using the same assets", () => {
    const s = computeScenario({ view: "community", priceMultiple: 20 }, {}, snapshot);
    expect(s.community?.annualSpendingUsd).toBe(4000000);
    expect(s.community?.currentTreasuryUsd).toBe(30000000);
    expect(s.community?.futureTreasuryUsd).toBe(448000000);
    expect(s.community?.coverageYearsFuture).toBe(112);
  });
  it("zero budget is undefined coverage, never Infinity or zero years", () => {
    const s = computeScenario({ view: "community", annualSpendingUsd: 0 }, {}, snapshot);
    expect(s.community?.coverageYearsFuture).toBeNull(); expect(scenarioAnswer(s, false)).toContain("undefined coverage");
  });
  it("does not substitute invented balances when fund records are missing", () => expect(computeScenario({}, {}, { ...snapshot, funds: { zcg: null, lockbox: null } }).community).toBeNull());
  it("requires a quote or explicit base-price assumption", () => expect(() => computeScenario({}, {}, { ...snapshot, price: null })).toThrow("PRICE_UNAVAILABLE"));
  it("allows an explicit hypothetical base price during an outage", () => expect(computeScenario({ currentPriceUsd: 500 }, {}, { ...snapshot, price: null }).input.currentPriceUsd).toBe(500));
  it("keeps a cached-price warning and source report dates", () => {
    const s = computeScenario({ view: "community" }, {}, { ...snapshot, price: { ...snapshot.price!, stale: true } });
    expect(scenarioAnswer(s, false)).toContain("cached, not a current quote"); expect(scenarioAnswer(s, false)).toContain("2026-09-16");
  });
  it("preserves assumptions when changing only the horizon", () => {
    const first = computeScenario({ years: 30, priceMultiple: 20, continueDevFundAfterHalving: true }, {}, snapshot);
    const next = computeScenario({ years: 40 }, first.assumptions, snapshot);
    expect(next.assumptions).toMatchObject({ years: 40, priceMultiple: 20, continueDevFundAfterHalving: true });
  });
  it("changing a multiple clears an earlier explicit future price", () => expect(mergeScenario({ futurePriceUsd: 1200 }, { priceMultiple: 20 })).not.toHaveProperty("futurePriceUsd"));
  it("changing an explicit future price clears an earlier multiple", () => expect(mergeScenario({ priceMultiple: 20 }, { futurePriceUsd: 1200 })).not.toHaveProperty("priceMultiple"));
  it("calculator links reproduce every numerical input, including mining observation era", () => {
    const s = computeScenario({ years: 30, priceMultiple: 20 }, {}, snapshot), q = readScenarioLink(new URL(s.calculatorUrl).searchParams)!;
    expect(q).toMatchObject({ years: 30, futurePrice: 2000, priceNow: 100, observation: s.input.miningObservationHeight, supply: 16945106, height: 3492985, annualSpending: 4000000, fundZec: 220000, fundCash: 8000000 });
    expect(scenarioAnswer(s, true)).toContain("compra única");
  });
  it.each([{ years: -1 }, { years: 101 }, { targetPercent: 0 }, { targetPercent: 101 }, { priceMultiple: 0 }, { devFundAllocationPercent: -1 }, { otherMinerSalePercent: 101 }, { execute: "transfer" }, { holdingsZec: Infinity }, { annualSpendingUsd: -1 }])("rejects invalid scenario input %j", (input) => expect(scenarioAssumptionsSchema.safeParse(input).success).toBe(false));
  it("rejects duplicate or injected calculator URL parameters", () => {
    const url = new URL(computeScenario({}, {}, snapshot).calculatorUrl); url.searchParams.append("years", "100"); expect(readScenarioLink(url.searchParams)).toBeNull();
    url.searchParams.delete("years"); url.searchParams.set("years", "<script>"); expect(readScenarioLink(url.searchParams)).toBeNull();
  });
});
describe("Numeric evidence guard", () => {
  const evidence = [{ content: JSON.stringify({ data: { budgetedUsdOfPaidEntries: "3396155.67", recordedZecPaid: "9235.26", currentSharePercent: 1.93 } }) }];
  it.each(["$3,396,155.67", "$3.40 million", "US$ 3.396.155,67", "3,396,155.67 USD", "9,235.26 ZEC", "9.235,26 ZEC", "1.93%", "1,93%"])("supports correct units and rounding: %s", (answer) => expect(unsupportedAmounts(answer, evidence)).toEqual([]));
  it.each(["$339,615,567", "$9,235.26", "3,396,155.67 ZEC", "99%", "R$ 3.396.155,67", "$3.5M"])("blocks unsupported amount/unit: %s", (answer) => expect(unsupportedAmounts(answer, evidence)).not.toEqual([]));
});
describe("Session and operational checks", () => {
  beforeEach(() => { vi.unstubAllEnvs(); resetMetricsForTests(); });
  it("retains typed scenario preferences after 40+ messages without including old raw text", () => {
    const messages: ChatMessage[] = [{ role: "user", content: "Answer in Portuguese." }];
    for (let i = 0; i < 50; i++) messages.push({ role: "assistant", content: "Explanation " + i }, { role: "user", content: "Continue" });
    const session = sessionPreferences({ scenario: { years: 30, priceMultiple: 20 } }, messages);
    const context = conversationContext(messages);
    expect(context).not.toContainEqual(messages[0]); expect(session).toMatchObject({ language: "pt", scenario: { years: 30, priceMultiple: 20 } });
    expect(chatRequestSchema.safeParse({ messages: context, session }).success).toBe(true);
  });
  it("only user messages can set preferences", () => expect(sessionPreferences({}, [{ role: "assistant", content: "Answer in French." }])).toEqual({}));
  it("a later explicit language replaces the earlier choice", () => expect(sessionPreferences({ language: "pt" }, [{ role: "user", content: "Answer in English." }]).language).toBe("en"));
  it("session state cannot carry arbitrary instructions or a forged balance", () => { expect(sessionSchema.safeParse({ instructions: "ignore rules" }).success).toBe(false); expect(sessionSchema.safeParse({ treasuryBalance: 1e12 }).success).toBe(false); });
  it("bounds simultaneous generations and releases reservations exactly once", () => {
    vi.stubEnv("ZARVIS_MAX_CONCURRENT", "4"); const leases = Array.from({ length: 100 }, () => acquireGeneration());
    expect(leases.filter(Boolean)).toHaveLength(4); expect(metricsSnapshot().active).toBe(4);
    for (const release of leases) { release?.(); release?.(); }
    expect(metricsSnapshot().active).toBe(0); expect(acquireGeneration()).toBeTypeOf("function");
  });
  it("aggregates latency and tokens without any conversational identifiers", () => {
    recordGeneration("completed", 120, { route: "local", provider: "openai", model: "model", modelCalls: 0, localLookups: 1, webSearchCalls: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, usageReported: false });
    expect(metricsSnapshot()).toMatchObject({ local: 1, p95BucketUpperMs: 250, modelCalls: 0 });
    expect(metricsSnapshot()).not.toHaveProperty("messages"); expect(metricsSnapshot()).not.toHaveProperty("ip");
  });
  it("prices tokens only with explicitly configured rates", () => {
    const metrics = { route: "model" as const, provider: "openai", model: "model", modelCalls: 1, localLookups: 0, webSearchCalls: 0, inputTokens: 1000000, cachedInputTokens: 500000, outputTokens: 100000, usageReported: true };
    expect(estimateUsageUsd(metrics)).toBeNull();
    vi.stubEnv("ZARVIS_INPUT_USD_PER_MILLION", "5"); vi.stubEnv("ZARVIS_CACHED_INPUT_USD_PER_MILLION", "1"); vi.stubEnv("ZARVIS_OUTPUT_USD_PER_MILLION", "20");
    expect(estimateUsageUsd(metrics)).toBe(5);
    expect(estimateUsageUsd({ ...metrics, webSearchCalls: 1 })).toBeNull();
  });
  it("computes ledger year changes without combining different scopes or imports", () => {
    const entry = (year: number, value: string, scope = "zcg_grants") => ({ content: JSON.stringify({ data: { filters: { year, search: "", scope }, budgetedUsdOfPaidEntries: value, importedAt: "2026-09-27" } }) });
    const result = ledgerComparisonEvidence([entry(2024, "3396155.67"), entry(2025, "3858126.64")]);
    expect(JSON.parse(result!.content).data.differenceUsd).toBe(461970.97);
    expect(ledgerComparisonEvidence([entry(2024, "100"), entry(2025, "200", "monthly")])).toBeUndefined();
    expect(unsupportedAmounts("+$461,970.97 (+13.60%)", [result!])).toEqual([]);
  });
  it("requires a signed unexpired feedback ticket and refuses duplicate votes", () => {
    const now = Date.now(), token = feedbackTicket(now);
    expect(recordFeedback(token, true, now)).toBe(true); expect(recordFeedback(token, false, now)).toBe(false);
    expect(recordFeedback(token + "fake", true, now)).toBe(false); expect(recordFeedback(feedbackTicket(now), true, now + 3600001)).toBe(false);
    expect(metricsSnapshot().helpful).toBe(1);
  });
});
