import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ create: vi.fn(), lookup: vi.fn(), prepare: vi.fn(), ledger: vi.fn(), config: vi.fn(), scenario: vi.fn(), zips: vi.fn() }));
vi.mock("openai", async (original) => ({ ...await original<object>(), default: class { responses = { create: mocks.create }; } }));
vi.mock("./config", () => ({ zarvisConfig: mocks.config }));
vi.mock("./data", async (original) => ({ ...await original<object>(), lookupPublicData: mocks.lookup }));
vi.mock("./local", async (original) => ({ ...await original<object>(), prepareLocal: mocks.prepare, lookupLedger: mocks.ledger }));
vi.mock("./scenario", async (original) => ({ ...await original<object>(), lookupScenario: mocks.scenario }));
vi.mock("./zips", async (original) => ({ ...await original<object>(), lookupZips: mocks.zips }));
import { computeScenario } from "./scenario";
import { BLOCK_SUBSIDY_ALLOCATION, compactData, derivedTreasuryFacts, treasuryContext } from "./data";
import { generateAnswer, streamable } from "./openai";
import { KNOWLEDGE } from "./sources";
import type { ZarvisEvent } from "./types";
async function* events(output: unknown[], text?: string) {
  if (text) yield { type: "response.output_text.delta", delta: text };
  yield { type: "response.completed", response: { status: "completed", output, usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 40 }, output_tokens: 20 } } };
}
const answer = (text: string) => ({ type: "message", role: "assistant", content: [{ type: "output_text", text, annotations: [] }] });
const call = (id: string, args = '{"topic":"treasuries","query":""}', name = "lookup_openzcash") => ({ type: "function_call", name, call_id: id, arguments: args });
const question = [{ role: "user" as const, content: "What does ZCG hold?" }];
// The live "treasuries" lookup shape with its derived site arithmetic; fixtures, not live values.
const treasuries = () => {
  const funds = { zcg: { paidMilestonesUsd: 21507071, zec: 88435, cashUsd: 8816950, snapshotAt: "2026-09-23T20:16:00Z", importedAt: "2026-09-27T03:00:00Z", updatesRequired: true, sourceUrl: "https://docs.google.com/spreadsheets/d/zcg" }, lockbox: { zec: 144333.7875, height: 3499201, baselineHeight: 3493796, snapshotAt: "2026-09-23T20:16:00Z", importedAt: "2026-09-27T03:00:00Z", updatesRequired: false, sourceUrl: "https://docs.google.com/spreadsheets/d/lockbox" } };
  const price = { cents: 159280, quotedAt: "2026-09-28T11:30:00Z", fetchedAt: "2026-09-28T11:30:00Z", stale: false }, supply = { zec: 16945106, quotedAt: "2026-09-28T11:30:00Z", fetchedAt: "2026-09-28T11:30:00Z", stale: false };
  return [{ content: JSON.stringify({ sourceUrl: "https://openzcash.org/zcg/treasury-calculator", retrievedAt: "2026-09-28T11:36:00Z", ...compactData({ funds: treasuryContext(funds), derived: derivedTreasuryFacts(funds, price, supply), allocation: BLOCK_SUBSIDY_ALLOCATION, price, supply }) }), source: { title: "OpenZcash · treasuries", url: "https://openzcash.org/zcg/treasury-calculator", retrievedAt: "2026-09-28T11:36:00Z" } }];
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.config.mockReturnValue({ provider: "openai", apiKey: "unit-test-not-a-key", model: "gpt-6-astra", webSearch: true });
  mocks.prepare.mockResolvedValue({ query: "test", documents: [], evidence: [], external: false });
  mocks.lookup.mockResolvedValue({ content: "{}" });
});
describe("Streamable text", () => {
  it("withholds an open citation marker until it closes and strips closed ones", () => {
    expect(streamable("Hello \uE200render_inline_citation")).toEqual(["Hello ", "\uE200render_inline_citation"]);
    expect(streamable("\uE200render_inline_citation{\"id\":1}\u0081 world")).toEqual([" world", ""]);
    expect(streamable("a\uE200x\uE201b")).toEqual(["ab", ""]);
  });
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
    expect(emitted.at(-1)).toEqual({ type: "done", sources: [source], provenance: { route: "model", model: "gpt-6-astra", webSearch: false, groundingFallback: false, withheldFigures: 0, language: "en" } });
    expect(mocks.create.mock.calls[0][0].instructions).toContain("Reply in the user's language");
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
    expect(emitted.at(-1)).toMatchObject({ type: "done", sources: [source], provenance: { route: "model", model: "gpt-6-astra" } });
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
    const emitted: ZarvisEvent[] = [];
    const metrics = await generateAnswer(question, new AbortController().signal, (e) => emitted.push(e));
    expect(mocks.create.mock.calls[0][0].max_turns).toBe(2);
    expect(mocks.create.mock.calls[0][0].tools.find((t: { type: string }) => t.type === "web_search")).toMatchObject({ filters: { allowed_domains: ["zips.z.cash"] } });
    expect(metrics.webSearchCalls).toBe(1);
    expect(emitted.at(-1)).toMatchObject({ type: "done", provenance: { route: "model", model: "grok-4.7", webSearch: true } });
  });
  it("passes mining sources to the first research round and preserves their citations", async () => {
    mocks.config.mockReturnValue({ provider: "xai", apiKey: "unit-test-not-a-key", model: "grok-4.7", webSearch: true });
    mocks.prepare.mockResolvedValue({ query: "current Zcash hashrate", documents: [], evidence: [], external: true });
    mocks.create.mockResolvedValueOnce(events([{ type: "web_search_call" }, answer("A dated estimate from [ZecStats](https://zecstats.com/chart/hashrate).") ]));
    const metrics = await generateAnswer(question, new AbortController().signal, () => {});
    expect(mocks.create.mock.calls[0][0].tools.find((t: { type: string }) => t.type === "web_search")).toMatchObject({ filters: { allowed_domains: expect.arrayContaining(["zcashinfo.com", "zecstats.com"]) } });
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
  it("lets a lookup, a research request and the search all fit in Quick, then reserves a tool-less final round", async () => {
    mocks.create.mockResolvedValueOnce(events([call("a")]))
      .mockResolvedValueOnce(events([call("research-final", '{"reason":"missing_local_evidence"}', "request_external_research")]))
      .mockResolvedValueOnce(events([{ type: "web_search_call" }, call("after-search")]))
      .mockResolvedValueOnce(events([answer("The available evidence establishes this scoped fact.")]));
    const metrics = await generateAnswer(question, new AbortController().signal, () => {});
    const tools = mocks.create.mock.calls.map(([p]) => p.tools.map((t: { type: string; name?: string }) => t.name ?? t.type));
    expect(tools[0]).toContain("request_external_research"); expect(tools[0]).not.toContain("web_search");
    expect(tools[1]).toContain("request_external_research");
    expect(tools[2]).toContain("web_search"); expect(tools[2]).not.toContain("request_external_research");
    expect(tools[3]).toEqual([]);
    expect(JSON.stringify(mocks.create.mock.calls[3][0].input)).toContain("Final synthesis round");
    expect(JSON.stringify(mocks.create.mock.calls[2][0].input)).not.toContain("Final synthesis round");
    expect(metrics).toMatchObject({ modelCalls: 4, webSearchCalls: 1, depth: "quick" });
  });
  it("keeps Quick at three rounds when no research request is granted", async () => {
    mocks.create.mockResolvedValueOnce(events([call("a")])).mockResolvedValueOnce(events([call("b")])).mockResolvedValueOnce(events([answer("Answered on the third round.")]));
    await generateAnswer(question, new AbortController().signal, () => {});
    expect(mocks.create).toHaveBeenCalledTimes(3);
    expect(mocks.create.mock.calls[1][0].tools).not.toEqual([]);
    expect(mocks.create.mock.calls[2][0].tools).toEqual([]);
  });
  it("keeps the extra round after the granted search ran, so the model can still read a record before synthesis", async () => {
    mocks.create.mockResolvedValueOnce(events([call("research", '{"reason":"missing_local_evidence"}', "request_external_research")]))
      .mockResolvedValueOnce(events([{ type: "web_search_call" }, call("c")]))
      .mockResolvedValueOnce(events([call("d")]))
      .mockResolvedValueOnce(events([answer("Searched, read, then answered.")]));
    const metrics = await generateAnswer(question, new AbortController().signal, () => {});
    expect(mocks.create).toHaveBeenCalledTimes(4);
    expect(mocks.create.mock.calls[2][0].tools.map((t: { name?: string; type: string }) => t.name ?? t.type)).toEqual(["lookup_openzcash", "query_openzcash_ledger", "calculate_openzcash_treasury", "lookup_zcash_zips", "query_project_history", "query_project_activity", "query_zcash_analytics", "read_grant_application"]);
    expect(mocks.create.mock.calls[3][0].tools).toEqual([]);
    expect(metrics).toMatchObject({ modelCalls: 4, webSearchCalls: 1, localLookups: 2 });
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
  it.each([false, true])("preserves scenario facts AND requested analysis, with numeric safety (unsupported: %s)", async (unsupported) => {
    const scenario = computeScenario({ years: 20, priceMultiple: 20 }, {}, { price: { usd: 100, stale: false, quotedAt: "2026-09-27T12:00:00Z" }, supply: { zec: 16945106, stale: false, quotedAt: "2026-09-27T12:00:00Z" }, chain: { height: 3492985 }, funds: { zcg: null, lockbox: null } });
    mocks.scenario.mockResolvedValue({ content: JSON.stringify({ data: scenario }), scenario });
    const analysis = unsupported ? "The treasury has $999 billion ready to spend." : "Valuation is not spendable cash. Separate authority, liquidity and expense growth limit this hypothesis. For sensitivity, vary the annual budget while holding the price fixed.";
    mocks.create.mockResolvedValueOnce(events([call("scenario-analysis", '{"years":20}', "calculate_openzcash_treasury")], "A premature $999 billion guess."))
      .mockResolvedValueOnce(events([answer(analysis)]));
    if (unsupported) mocks.create.mockResolvedValueOnce(events([answer("Still $999 billion after restating.")]));
    const emitted: ZarvisEvent[] = [];
    const metrics = await generateAnswer([{ role: "user", content: "Analyze a treasury scenario and its limitations. Suggest a sensitivity test." }], new AbortController().signal, (e) => emitted.push(e));
    expect(mocks.create).toHaveBeenCalledTimes(unsupported ? 3 : 2);
    expect(mocks.create.mock.calls[0][0].reasoning).toEqual({ effort: "medium" });
    expect(mocks.create.mock.calls[1][0].input).toContainEqual(expect.objectContaining({ type: "function_call_output", call_id: "scenario-analysis" }));
    const result = emitted.find((e) => e.type === "replace");
    expect(result).toMatchObject({ text: expect.stringContaining("one purchase at the end") });
    expect(JSON.stringify(emitted)).not.toContain("999 billion");
    if (!unsupported) expect(result).toMatchObject({ text: expect.stringContaining("For sensitivity") });
    else expect(metrics.groundingFallbacks).toBe(1);
    expect(emitted.filter(e => e.type === "done")).toHaveLength(1);
  });
  it("never exposes an unsupported financial figure in streamed deltas", async () => {
    mocks.prepare.mockResolvedValue({ documents: [], evidence: [{ content: JSON.stringify({ data: { quote: { usd: 100 } } }) }], external: false });
    mocks.create.mockResolvedValueOnce(events([answer("ZEC is $999 billion.")], "ZEC is $999 billion."));
    const emitted: ZarvisEvent[] = [];
    const metrics = await generateAnswer(question, new AbortController().signal, (e) => emitted.push(e));
    expect(JSON.stringify(emitted)).not.toContain("999 billion");
    expect(metrics.groundingFallbacks).toBe(1);
    expect(emitted.at(-1)).toMatchObject({ type: "done", provenance: { route: "model", groundingFallback: true, withheldFigures: 1, language: "en" } });
  });
  it("writes the grounding fallback in the question's language, with the withheld count and no withheld text", async () => {
    mocks.prepare.mockResolvedValue({ documents: [], evidence: [{ content: JSON.stringify({ data: { quote: { usd: 100 } } }) }], external: false });
    mocks.create.mockResolvedValueOnce(events([answer("O ZEC vale $999 bilhões e subiu 500%.")]));
    const emitted: ZarvisEvent[] = [];
    await generateAnswer([{ role: "user", content: "Como está o ZEC comparado ao ano passado?" }], new AbortController().signal, (e) => emitted.push(e));
    expect(emitted.find((e) => e.type === "replace")).toMatchObject({ text: expect.stringContaining("Não consegui validar") });
    expect(emitted.at(-1)).toMatchObject({ type: "done", provenance: { groundingFallback: true, withheldFigures: 2, language: "pt" } });
    expect(JSON.stringify(emitted)).not.toMatch(/999|500%/);
  });
  it("keeps the deterministic scenario block in Portuguese for a Portuguese analytical question without keyword shortcuts", async () => {
    const scenario = computeScenario({ years: 20, priceMultiple: 20 }, {}, { price: { usd: 100, stale: false, quotedAt: "2026-09-27T12:00:00Z" }, supply: { zec: 16945106, stale: false, quotedAt: "2026-09-27T12:00:00Z" }, chain: { height: 3492985 }, funds: { zcg: null, lockbox: null } });
    mocks.scenario.mockResolvedValue({ content: JSON.stringify({ data: scenario }), scenario });
    mocks.create.mockResolvedValueOnce(events([call("scenario-pt", '{"years":20}', "calculate_openzcash_treasury")])).mockResolvedValueOnce(events([answer("A valorização não é caixa disponível.")]));
    const emitted: ZarvisEvent[] = [];
    await generateAnswer([{ role: "user", content: "Analise as limitações dessa tesouraria comunitária se o ZEC subir 20 vezes. Sugira um teste de sensibilidade." }], new AbortController().signal, (e) => emitted.push(e));
    const result = emitted.find((e) => e.type === "replace");
    expect(result).toMatchObject({ text: expect.stringContaining("compra única") });
    expect(result).toMatchObject({ text: expect.stringContaining("### Análise") });
    expect(result).not.toMatchObject({ text: expect.stringContaining("one purchase") });
    expect(emitted.at(-1)).toMatchObject({ type: "done", provenance: { route: "model", language: "pt" } });
  });
  it("accepts the site's derived treasury arithmetic without any fallback", async () => {
    mocks.prepare.mockResolvedValue({ documents: [], evidence: treasuries(), external: false });
    const text = "ZCG's 88,435 ZEC are worth about $140.9 million at $1,592.80; with $8.82 million cash that is $149.7 million. The Lockbox's 144,333.79 ZEC add $229.9 million, so the combined gross value is roughly $379.6 million, about 1.37% of circulating supply. ZCG receives 8% and the Lockbox 12% of each block subsidy.";
    mocks.create.mockResolvedValueOnce(events([answer(text)]));
    const emitted: ZarvisEvent[] = [];
    const metrics = await generateAnswer([{ role: "user", content: "What do the latest ZCG and Lockbox balances tell us, and how old are the data?" }], new AbortController().signal, (e) => emitted.push(e));
    expect(metrics.groundingFallbacks).toBeUndefined();
    expect(emitted.find((e) => e.type === "replace")).toEqual({ type: "replace", text });
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

  const zooko = [{ role: "user" as const, content: "Who is Zooko?" }];
  it("streams deltas for a non-financial answer and still sends the authoritative replace last before done", async () => {
    mocks.prepare.mockResolvedValue({ query: "Who is Zooko?", documents: [{ id: "zooko-background", title: "Zooko", url: "https://z.cash/learn/who-created-zcash/", text: "Zooko Wilcox.", kind: "reference" }], evidence: [], external: false });
    mocks.create.mockResolvedValueOnce((async function* () {
      yield { type: "response.output_text.delta", delta: "Zooko Wilcox " }; yield { type: "response.output_text.delta", delta: "co-founded ECC\uE200citation" }; yield { type: "response.output_text.delta", delta: "\uE201 in 2015." };
      yield { type: "response.completed", response: { status: "completed", output: [answer("Zooko Wilcox co-founded ECC in 2015.")], usage: { input_tokens: 10, output_tokens: 5 } } };
    })());
    const emitted: ZarvisEvent[] = [];
    await generateAnswer(zooko, new AbortController().signal, (e) => emitted.push(e));
    const deltas = emitted.filter((e) => e.type === "delta").map((e) => (e as { text: string }).text);
    expect(deltas.join("")).toBe("Zooko Wilcox co-founded ECC in 2015.");
    expect(JSON.stringify(deltas)).not.toMatch(/\uE200|\uE201|citation/);
    expect(emitted.map((e) => e.type).slice(-2)).toEqual(["replace", "done"]);
    expect(emitted.findIndex((e) => e.type === "replace")).toBeGreaterThan(emitted.findLastIndex((e) => e.type === "delta"));
    expect(emitted.some((e) => e.type === "status" && /Checking \d+ figure/.test(e.message))).toBe(false);
  });
  it("clears a streamed tool preamble before the next round and never streams after financial evidence arrives", async () => {
    mocks.prepare.mockResolvedValue({ query: "Who is Zooko?", documents: [], evidence: [], external: false });
    mocks.lookup.mockResolvedValue({ content: JSON.stringify({ data: { quote: { usd: 100 } } }) });
    mocks.create.mockResolvedValueOnce(events([call("price", '{"topic":"price","query":""}')], "Let me check the quote.")).mockResolvedValueOnce(events([answer("ZEC is $100.")], "ZEC is $100."));
    const emitted: ZarvisEvent[] = [];
    await generateAnswer(zooko, new AbortController().signal, (e) => emitted.push(e));
    const types = emitted.map((e) => e.type);
    expect(emitted[types.indexOf("delta")]).toEqual({ type: "delta", text: "Let me check the quote." });
    expect(emitted.filter((e) => e.type === "replace")).toEqual([{ type: "replace", text: "" }, { type: "replace", text: "ZEC is $100." }]);
    expect(emitted.filter((e) => e.type === "delta")).toHaveLength(1);
    expect(emitted.some((e) => e.type === "status" && e.message === "Checking 1 figure against the sources…")).toBe(true);
  });
  it.each([
    ["treasury evidence", () => treasuries(), "What do the balances tell us?"],
    ["ledger evidence", () => [{ content: JSON.stringify({ data: { filters: { year: 2025, scope: "zcg_grants", search: "" }, importedAt: "2026-09-27T00:00:00Z", budgetedUsdOfPaidEntries: "3858126.64", recordedZecPaid: "1", paidEntries: 1, paidEntriesMissingUsd: 0, paidEntriesMissingZec: 0 } }) }], "Who reads the ledger?"],
    ["a money question with no evidence yet", () => [], "How much did ZCG pay in grants to everyone?"],
  ])("buffers instead of streaming for %s", async (_label, evidence, content) => {
    mocks.prepare.mockResolvedValue({ query: content, documents: [], evidence: evidence(), external: false });
    mocks.create.mockResolvedValueOnce(events([answer("ZCG's 88,435 ZEC are dated.")], "ZCG's 88,435 ZEC are dated."));
    const emitted: ZarvisEvent[] = [];
    await generateAnswer([{ role: "user", content }], new AbortController().signal, (e) => emitted.push(e));
    expect(emitted.some((e) => e.type === "delta")).toBe(false);
    expect(emitted.map((e) => e.type).slice(-2)).toEqual(["replace", "done"]);
  });
  it("repairs an unsupported figure in one tool-less round instead of discarding the answer", async () => {
    mocks.prepare.mockResolvedValue({ query: "What does ZCG hold?", documents: [], evidence: treasuries(), external: false });
    mocks.create.mockResolvedValueOnce(events([answer("ZCG holds 88,435 ZEC worth about $175 million.")]))
      .mockResolvedValueOnce(events([answer("ZCG holds 88,435 ZEC worth about $141 million at $1,592.80.")]));
    const emitted: ZarvisEvent[] = [];
    const metrics = await generateAnswer(question, new AbortController().signal, (e) => emitted.push(e));
    expect(mocks.create).toHaveBeenCalledTimes(2);
    const repair = mocks.create.mock.calls[1][0];
    expect(repair.tools).toEqual([]);
    expect(repair.input.at(-1)).toMatchObject({ role: "developer", content: expect.stringContaining('These figures are not in the evidence: "about $175 million"') });
    expect(repair.input.some((item: { type?: string; role?: string }) => item.type === "message" || item.role === "assistant")).toBe(true);
    expect(emitted.find((e) => e.type === "replace")).toEqual({ type: "replace", text: "ZCG holds 88,435 ZEC worth about $141 million at $1,592.80." });
    expect(emitted.some((e) => e.type === "status" && e.message === "Checking 2 figures against the sources…")).toBe(true);
    expect(metrics).toMatchObject({ repairRounds: 1, modelCalls: 2 });
    expect(metrics.groundingFallbacks).toBeUndefined();
    expect(emitted.at(-1)).toMatchObject({ type: "done", provenance: { groundingFallback: false, withheldFigures: 0 } });
  });
  it("keeps verified sentences when the repair still carries an unsupported figure, counting it in provenance", async () => {
    mocks.prepare.mockResolvedValue({ query: "What does ZCG hold?", documents: [], evidence: treasuries(), external: false });
    mocks.create.mockResolvedValueOnce(events([answer("ZCG holds 88,435 ZEC. Its cash is $999 billion.")]))
      .mockResolvedValueOnce(events([answer("ZCG holds 88,435 ZEC as of the September 23, 2026 report. Its cash is $999 billion.")]));
    const emitted: ZarvisEvent[] = [];
    const metrics = await generateAnswer(question, new AbortController().signal, (e) => emitted.push(e));
    expect(emitted.find((e) => e.type === "replace")).toEqual({ type: "replace", text: "ZCG holds 88,435 ZEC as of the September 23, 2026 report." });
    expect(JSON.stringify(emitted)).not.toContain("999");
    expect(metrics).toMatchObject({ repairRounds: 1, groundingFallbacks: 1, modelCalls: 2 });
    expect(emitted.at(-1)).toMatchObject({ type: "done", provenance: { groundingFallback: true, withheldFigures: 1 } });
  });
  it("falls back to the grounded text when nothing verified survives, and survives a failed repair round", async () => {
    mocks.prepare.mockResolvedValue({ query: "What does ZCG hold?", documents: [], evidence: [{ content: JSON.stringify({ data: { quote: { usd: 100 } } }) }], external: false });
    mocks.create.mockResolvedValueOnce(events([answer("ZEC is $999 billion.")])).mockResolvedValueOnce((async function* () { yield { type: "response.failed" }; })());
    const emitted: ZarvisEvent[] = [];
    const metrics = await generateAnswer(question, new AbortController().signal, (e) => emitted.push(e));
    expect(emitted.find((e) => e.type === "replace")).toMatchObject({ text: expect.stringContaining("I could not validate") });
    expect(JSON.stringify(emitted)).not.toContain("999");
    expect(metrics).toMatchObject({ repairRounds: 1, groundingFallbacks: 1, modelCalls: 2, usageReported: false });
  });
  it("skips the repair round when the deadline is near and still answers from the fallback", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      mocks.prepare.mockResolvedValue({ query: "What does ZCG hold?", documents: [], evidence: treasuries(), external: false });
      mocks.create.mockResolvedValueOnce((async function* () { vi.setSystemTime(Date.now() + 45_000); yield* events([answer("ZCG holds 88,435 ZEC as of September 23, 2026. Its cash is $999 billion.")]); })());
      const emitted: ZarvisEvent[] = [];
      const metrics = await generateAnswer(question, new AbortController().signal, (e) => emitted.push(e));
      expect(mocks.create).toHaveBeenCalledTimes(1);
      expect(emitted.find((e) => e.type === "replace")).toEqual({ type: "replace", text: "ZCG holds 88,435 ZEC as of September 23, 2026." });
      expect(emitted.some((e) => e.type === "status" && e.message === "Restating unverified figures…")).toBe(false);
      expect(JSON.stringify(emitted)).not.toContain("999");
      expect(metrics).toMatchObject({ groundingFallbacks: 1, modelCalls: 1, usageReported: true });
      expect(metrics.repairRounds).toBeUndefined();
    } finally { vi.useRealTimers(); }
  });
  it("time-boxes the repair round under the request signal and falls back when the box expires", async () => {
    mocks.prepare.mockResolvedValue({ query: "What does ZCG hold?", documents: [], evidence: treasuries(), external: false });
    const controller = new AbortController();
    let repairSignal: AbortSignal | undefined;
    mocks.create.mockResolvedValueOnce(events([answer("ZCG holds 88,435 ZEC. Its cash is $999 billion.")]))
      .mockImplementationOnce((_params: unknown, options: { signal: AbortSignal }) => { repairSignal = options.signal; throw Object.assign(new Error("The user aborted a request."), { name: "AbortError" }); });
    const emitted: ZarvisEvent[] = [];
    const metrics = await generateAnswer(question, controller.signal, (e) => emitted.push(e));
    expect(mocks.create.mock.calls[0][1].signal).toBe(controller.signal);
    expect(repairSignal).toBeInstanceOf(AbortSignal); expect(repairSignal).not.toBe(controller.signal); expect(repairSignal?.aborted).toBe(false);
    expect(emitted.find((e) => e.type === "replace")).toEqual({ type: "replace", text: "ZCG holds 88,435 ZEC." });
    expect(metrics).toMatchObject({ repairRounds: 1, groundingFallbacks: 1, modelCalls: 2 });
    controller.abort();
    expect(repairSignal?.aborted).toBe(true);
  });
  it("still propagates the request's own abort during the repair round", async () => {
    mocks.prepare.mockResolvedValue({ query: "What does ZCG hold?", documents: [], evidence: treasuries(), external: false });
    const controller = new AbortController();
    mocks.create.mockResolvedValueOnce(events([answer("ZCG holds 88,435 ZEC. Its cash is $999 billion.")]))
      .mockImplementationOnce(() => { controller.abort(); throw Object.assign(new Error("The user aborted a request."), { name: "AbortError" }); });
    await expect(generateAnswer(question, controller.signal, () => {})).rejects.toMatchObject({ errorClass: "aborted" });
  });
  it("lets the selected reviewed notes vouch for protocol constants beside treasury evidence", async () => {
    const note = KNOWLEDGE.find((n) => n.id === "issuance")!;
    mocks.prepare.mockResolvedValue({ query: "What does ZCG hold?", documents: [{ id: note.id, title: note.title, url: note.url, text: `${note.keywords}\n${note.text}`, kind: "reference" }], evidence: treasuries(), external: false });
    const text = "ZCG's 88,435 ZEC are 0.52% of circulating supply against a 21 million ZEC cap; 5% of the cap is 1,050,000 ZEC, and ZCG receives 8% of each 0.52083333 ZEC subsidy since NU7 (1.5625 ZEC before it).";
    mocks.create.mockResolvedValueOnce(events([answer(text)]));
    const emitted: ZarvisEvent[] = [];
    const metrics = await generateAnswer(question, new AbortController().signal, (e) => emitted.push(e));
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(metrics.repairRounds).toBeUndefined(); expect(metrics.groundingFallbacks).toBeUndefined();
    expect(emitted.find((e) => e.type === "replace")).toEqual({ type: "replace", text });
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
