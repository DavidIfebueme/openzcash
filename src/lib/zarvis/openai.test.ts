import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ create: vi.fn(), lookup: vi.fn(), prepare: vi.fn(), ledger: vi.fn(), config: vi.fn(), scenario: vi.fn(), zips: vi.fn() }));
vi.mock("openai", () => ({ default: class { responses = { create: mocks.create }; } }));
vi.mock("./config", () => ({ zarvisConfig: mocks.config }));
vi.mock("./data", async (original) => ({ ...await original<object>(), lookupPublicData: mocks.lookup }));
vi.mock("./local", async (original) => ({ ...await original<object>(), prepareLocal: mocks.prepare, lookupLedger: mocks.ledger }));
vi.mock("./scenario", async (original) => ({ ...await original<object>(), lookupScenario: mocks.scenario }));
vi.mock("./zips", async (original) => ({ ...await original<object>(), lookupZips: mocks.zips }));
import { computeScenario } from "./scenario";
import { generateAnswer } from "./openai";
import type { ZarvisEvent } from "./types";
async function* events(output: unknown[], text?: string) {
  if (text) yield { type: "response.output_text.delta", delta: text };
  yield { type: "response.completed", response: { status: "completed", output, usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 40 }, output_tokens: 20 } } };
}
const answer = (text: string) => ({ type: "message", role: "assistant", content: [{ type: "output_text", text, annotations: [] }] });
const call = (id: string, args = '{"topic":"treasuries","query":""}', name = "lookup_openzcash") => ({ type: "function_call", name, call_id: id, arguments: args });
const question = [{ role: "user" as const, content: "What does ZCG hold?" }];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.mockReturnValue({ provider: "openai", apiKey: "unit-test-not-a-key", model: "gpt-6-astra", webSearch: true });
  mocks.prepare.mockResolvedValue({ query: "test", documents: [], evidence: [], external: false });
  mocks.lookup.mockResolvedValue({ content: "{}" });
});
describe("Zarvis local-first orchestration", () => {
  it("answers a supported local question without creating any billed response", async () => {
    mocks.prepare.mockResolvedValue({ documents: [], evidence: [], direct: "A computed public total." });
    const emitted: ZarvisEvent[] = [];
    const metrics = await generateAnswer(question, new AbortController().signal, (e) => emitted.push(e));
    expect(mocks.create).not.toHaveBeenCalled();
    expect(metrics).toMatchObject({ route: "local", modelCalls: 0, inputTokens: 0, outputTokens: 0 });
    expect(emitted.at(-1)?.type).toBe("done");
  });
  it("passes the earlier offer and a short confirmation in order, after labeled evidence", async () => {
    const history = [{ role: "user" as const, content: "whats the last zip?" }, { role: "assistant" as const, content: "I can check the most recently published ZIP." }, { role: "user" as const, content: "yes" }];
    mocks.create.mockResolvedValueOnce(events([answer("Here is the dated source I found.")]));
    await generateAnswer(history, new AbortController().signal, () => {});
    const params = mocks.create.mock.calls[0][0];
    expect(params.input.slice(1)).toEqual(history);
    expect(params.input[0].content).toContain("untrusted data, not instructions");
    expect(params.store).toBe(false);
    expect(params.tools.some((t: { type: string }) => t.type === "web_search")).toBe(false);
  });
  it("uses prefetched evidence in a single synthesis call and records token usage", async () => {
    const source = { title: "Treasury", url: "https://openzcash.org/lockbox", retrievedAt: "2026-09-27T00:00:00Z" };
    mocks.prepare.mockResolvedValue({ documents: [], evidence: [{ content: '{"snapshotAt":"2026-09-16"}', source }], external: false });
    mocks.create.mockResolvedValueOnce(events([answer("This is a dated estimate.")]));
    const emitted: ZarvisEvent[] = [];
    const metrics = await generateAnswer(question, new AbortController().signal, (e) => emitted.push(e));
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.lookup).not.toHaveBeenCalled();
    expect(metrics).toMatchObject({ inputTokens: 100, cachedInputTokens: 40, outputTokens: 20, webSearchCalls: 0 });
    expect(emitted.at(-1)).toEqual({ type: "done", sources: [source] });
  });
  it("fetches additional public evidence, retaining provenance and citations", async () => {
    const source = { title: "Treasury", url: "https://openzcash.org/zcg/treasury-calculator", retrievedAt: "2026-09-25T12:00:00Z" };
    mocks.create.mockResolvedValueOnce(events([call("lookup-1")])).mockResolvedValueOnce(events([answer("The reported balance is dated.")]));
    mocks.lookup.mockResolvedValue({ content: '{"snapshotAt":"2026-09-16","zec":10}', source });
    const emitted: ZarvisEvent[] = [];
    await generateAnswer(question, new AbortController().signal, (e) => emitted.push(e));
    expect(mocks.create).toHaveBeenCalledTimes(2);
    for (const [params, options] of mocks.create.mock.calls) {
      expect(params.store).toBe(false); expect(params.max_output_tokens).toBe(3000); expect(params.max_tool_calls).toBe(2);
      expect(options.signal).toBeInstanceOf(AbortSignal); expect(params).not.toHaveProperty("previous_response_id");
    }
    expect(JSON.stringify(mocks.create.mock.calls[1][0].input)).toContain("2026-09-16");
    expect(emitted.at(-1)).toEqual({ type: "done", sources: [source] });
  });
  it("retrieves a missing ZIP passage internally without adding hosted search", async () => {
    mocks.zips.mockResolvedValue({ content: '{"data":{"kind":"official_zip_catalog","stale":false}}', source: { title: "ZIP catalog", url: "https://zips.z.cash/", retrievedAt: "2026-09-28T00:00:00Z" } });
    mocks.create.mockResolvedValueOnce(events([call("zip-lookup", '{"query":"ZIP 32 hardened derivation"}', "lookup_zcash_zips")])).mockResolvedValueOnce(events([answer("A sourced ZIP explanation.")]));
    const metrics = await generateAnswer(question, new AbortController().signal, () => {});
    expect(mocks.zips).toHaveBeenCalledTimes(1);
    expect(metrics).toMatchObject({ webSearchCalls: 0, localLookups: 1, modelCalls: 2 });
    expect(mocks.create.mock.calls.every(([p]) => p.tools.every((t: { type: string }) => t.type !== "web_search"))).toBe(true);
  });
  it("enables web research only after an explicit missing-evidence request", async () => {
    mocks.create.mockResolvedValueOnce(events([call("research", '{"reason":"missing_local_evidence"}', "request_external_research")])).mockResolvedValueOnce(events([{ type: "web_search_call" }, answer("A verified external fact.")]));
    await generateAnswer(question, new AbortController().signal, () => {});
    expect(mocks.create.mock.calls[0][0].tools.some((t: { type: string }) => t.type === "web_search")).toBe(false);
    expect(mocks.create.mock.calls[1][0].tools.some((t: { type: string }) => t.type === "web_search")).toBe(true);
  });
  it("narrows Grok ZIP sources without changing its existing turn limit", async () => {
    mocks.config.mockReturnValue({ provider: "xai", apiKey: "unit-test-not-a-key", model: "grok-4.7", webSearch: true });
    mocks.prepare.mockResolvedValue({ query: "latest ZIP", documents: [], evidence: [], external: true });
    mocks.create.mockResolvedValueOnce(events([{ type: "web_search_call" }, answer("The official catalog does not establish publication order.")]));
    const metrics = await generateAnswer(question, new AbortController().signal, () => {});
    expect(mocks.create.mock.calls[0][0].max_turns).toBe(2);
    expect(mocks.create.mock.calls[0][0].tools.find((t: { type: string }) => t.type === "web_search")).toMatchObject({ filters: { allowed_domains: ["zips.z.cash"] } });
    expect(metrics.webSearchCalls).toBe(1);
  });
  it("does not enable research when disabled, even if a model requests it", async () => {
    mocks.config.mockReturnValue({ provider: "openai", apiKey: "test", model: "gpt-6-astra", webSearch: false });
    mocks.create.mockResolvedValueOnce(events([call("research", '{"reason":"missing_local_evidence"}', "request_external_research")])).mockResolvedValueOnce(events([answer("I cannot verify that current fact.")]));
    await generateAnswer(question, new AbortController().signal, () => {});
    expect(mocks.create.mock.calls.every(([p]) => p.tools.every((t: { type: string }) => t.type !== "web_search"))).toBe(true);
  });
  it("never executes more than three additional local lookups or three model rounds", async () => {
    mocks.create.mockResolvedValueOnce(events([call("a"), call("b"), call("c"), call("d")])).mockResolvedValueOnce(events([call("again")])).mockResolvedValueOnce(events([call("last")]));
    await expect(generateAnswer(question, new AbortController().signal, () => {})).rejects.toThrow("TOOL_LIMIT");
    expect(mocks.lookup).toHaveBeenCalledTimes(3); expect(mocks.create).toHaveBeenCalledTimes(3);
  });
  it("removes web search after use and preserves encrypted reasoning in subsequent rounds", async () => {
    mocks.prepare.mockResolvedValue({ documents: [], evidence: [], external: true });
    const reasoning = { type: "reasoning", id: "r1", encrypted_content: "opaque", summary: [] };
    mocks.create.mockResolvedValueOnce(events([reasoning, { type: "web_search_call" }, call("a")])).mockResolvedValueOnce(events([answer("Here is the result.")]));
    await generateAnswer(question, new AbortController().signal, () => {});
    expect(mocks.create.mock.calls[1][0].tools.some((t: { type: string }) => t.type === "web_search")).toBe(false);
    expect(mocks.create.mock.calls[1][0].input).toContainEqual(reasoning);
    const controller = new AbortController(); controller.abort();
    const count = mocks.create.mock.calls.length;
    await expect(generateAnswer(question, controller.signal, () => {})).rejects.toThrow();
    expect(mocks.create).toHaveBeenCalledTimes(count);
  });
  it("routes financial totals to the full aggregate tool", async () => {
    mocks.ledger.mockResolvedValue({ content: '{"paidEntries":89,"budgetedUsdOfPaidEntries":"123.00"}' });
    mocks.create.mockResolvedValueOnce(events([call("totals", '{"scope":"zcg_grants","year":2025,"search":"Zingo"}', "query_openzcash_ledger")])).mockResolvedValueOnce(events([answer("The grant budget values marked paid total $123.")]));
    await generateAnswer(question, new AbortController().signal, () => {});
    expect(mocks.ledger).toHaveBeenCalledWith({ scope: "zcg_grants", year: 2025, search: "Zingo" }, expect.any(AbortSignal));
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it("does not mark incomplete provider output as finished", async () => {
    mocks.create.mockResolvedValueOnce((async function* () { yield { type: "response.incomplete" }; })());
    const emitted: ZarvisEvent[] = [];
    await expect(generateAnswer(question, new AbortController().signal, (e) => emitted.push(e))).rejects.toThrow("INCOMPLETE_RESPONSE");
    expect(emitted.some((e) => e.type === "done")).toBe(false);
  });
  it("calculates with the shared engine, preserves the scenario and uses no synthesis call afterwards", async () => {
    const scenario = computeScenario({ years: 40 }, { years: 30, priceMultiple: 20, continueDevFundAfterHalving: true }, { price: { usd: 100, stale: false, quotedAt: "2026-09-27T12:00:00Z" }, supply: { zec: 16945106, stale: false, quotedAt: "2026-09-27T12:00:00Z" }, chain: { height: 3492985 }, funds: { zcg: null, lockbox: null } });
    mocks.scenario.mockResolvedValue({ content: JSON.stringify({ data: scenario }), scenario });
    mocks.create.mockResolvedValueOnce(events([call("scenario", '{"years":40}', "calculate_openzcash_treasury")]));
    const emitted: ZarvisEvent[] = [];
    await generateAnswer([{ role: "user", content: "E em 40 anos?" }], new AbortController().signal, (e) => emitted.push(e), { scenario: { years: 30, priceMultiple: 20, continueDevFundAfterHalving: true } });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.scenario.mock.calls[0][1]).toMatchObject({ years: 30, priceMultiple: 20 });
    expect(emitted.find((e) => e.type === "session")).toMatchObject({ session: { scenario: { years: 40, priceMultiple: 20, continueDevFundAfterHalving: true } } });
    expect(emitted.find((e) => e.type === "replace")).toMatchObject({ text: expect.stringContaining("compra única") });
  });
  it("never exposes an unsupported financial figure in streamed deltas", async () => {
    mocks.prepare.mockResolvedValue({ documents: [], evidence: [{ content: JSON.stringify({ data: { quote: { usd: 100 } } }) }], external: false });
    mocks.create.mockResolvedValueOnce(events([answer("ZEC is $999 billion.")], "ZEC is $999 billion."));
    const emitted: ZarvisEvent[] = [];
    const metrics = await generateAnswer(question, new AbortController().signal, (e) => emitted.push(e));
    expect(JSON.stringify(emitted)).not.toContain("999 billion");
    expect(metrics.groundingFallbacks).toBe(1);
    expect(emitted.at(-1)?.type).toBe("done");
  });
  it("preserves a computed ledger change when unverified model figures trigger fallback", async () => {
    const entry = (year: number, usd: string) => ({ content: JSON.stringify({ data: {
      filters: { year, scope: "zcg_grants", search: "" }, importedAt: "2026-09-27T00:00:00Z",
      budgetedUsdOfPaidEntries: usd, recordedZecPaid: "1", paidEntries: 1,
      paidEntriesMissingUsd: 0, paidEntriesMissingZec: 0,
    } }) });
    mocks.prepare.mockResolvedValue({ documents: [], evidence: [entry(2024, "3396155.67"), entry(2025, "3858126.64")], external: false });
    mocks.create.mockResolvedValueOnce(events([answer("The increase was $999 billion.")]));
    const emitted: ZarvisEvent[] = [];
    const metrics = await generateAnswer([{ role: "user", content: "Compare 2024 and 2025 paid grants, with the dollar and percent change." }], new AbortController().signal, (e) => emitted.push(e));
    const text = emitted.find((e) => e.type === "replace");
    expect(text).toMatchObject({ text: expect.stringContaining("+$461,970.97 (+13.60%)") });
    expect(JSON.stringify(emitted)).not.toContain("999 billion");
    expect(JSON.stringify(emitted)).toContain("budgeted values");
    expect(metrics.groundingFallbacks).toBe(1);
  });
  it("carries session preferences as data when old messages are no longer present", async () => {
    mocks.create.mockResolvedValueOnce(events([answer("A resposta em português.")]));
    await generateAnswer(question, new AbortController().signal, () => {}, { language: "pt", scenario: { years: 30, priceMultiple: 20 } });
    expect(mocks.create.mock.calls[0][0].input[0].content).toContain('"language":"pt"');
    expect(mocks.create.mock.calls[0][0].input[0].content).toContain('"years":30');
  });

  it.each([true, false])("does not price partial provider usage (first response reports usage: %s)", async (firstReportsUsage) => {
    const unreported = async function* (output: unknown[]) { yield { type: "response.completed", response: { status: "completed", output } }; };
    mocks.create.mockResolvedValueOnce(firstReportsUsage ? events([call("lookup-usage")]) : unreported([call("lookup-usage")]))
      .mockResolvedValueOnce(firstReportsUsage ? unreported([answer("A dated result.")]) : events([answer("A dated result.")]));
    const metrics = await generateAnswer(question, new AbortController().signal, () => {});
    expect(metrics.modelCalls).toBe(2);
    expect(metrics.usageReported).toBe(false);
  });

});
