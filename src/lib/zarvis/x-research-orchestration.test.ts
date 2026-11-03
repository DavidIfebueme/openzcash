import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("./x-research", async original => ({ ...await original<object>(), lookupXResearch: mocks.lookup }));
import { modelAnswer, type Conversation, type GenerationMetrics, type Prepared, type RoundOptions, type RoundResult } from "./engine";
import { answerPlan } from "./depth";
import { estimateUsageUsd } from "./pricing";
import { provenanceLabel } from "./provenance";
import type { ZarvisEvent } from "./types";
const source = { title: "X · Zcash", url: "https://x.com/zcash/status/1982000000000000000", retrievedAt: "2026-11-03T12:00:00Z" };
const config = { provider: "anthropic" as const, apiKey: "test-primary-key", model: "claude-opus-5-5", providerLabel: "Anthropic (Claude)" as const, webSearch: true };
const metrics = (): GenerationMetrics => ({ route: "model", provider: "anthropic", model: config.model, modelCalls: 0, localLookups: 0, webSearchCalls: 0, webFetchCalls: 0, inputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0, usageReported: false });
const prepared = (): Prepared => {
  const messages = [{ role: "user" as const, content: "Find public Zcash bounties announced on X." }];
  return { messages, plan: answerPlan(messages, "quick"), session: {}, local: { query: messages[0].content, documents: [], evidence: [], external: false }, lang: "en", candidates: [], financialQuestion: false, direct: null };
};
const use = (id: string, name = "search_zcash_x", args = '{"topic":"bounties"}') => ({ id, name, arguments: args });
function conversation(calls: ReturnType<typeof use>[], fixedTools = false) {
  const rounds: RoundOptions[] = [], results: string[] = [];
  const c: Conversation = { fixedTools, addEvidence() {}, addMessages() {}, note() {}, toolResult(_id, content) { results.push(content); },
    async round(options): Promise<RoundResult> {
      rounds.push(options);
      return { text: rounds.length === 1 ? "" : `Check the [original post](${source.url}).`, calls: rounds.length === 1 ? calls : [], sources: [], searches: 0, streamed: false, usage: { inputTokens: 10, outputTokens: 10, cachedInputTokens: 0, cacheWriteTokens: 0, reported: true } };
    },
  };
  return { c, rounds, results };
}
beforeEach(() => {
  vi.clearAllMocks();
  for (const [key, value] of Object.entries({ ZARVIS_ENABLED: "true", ZARVIS_WEB_SEARCH: "true", ZARVIS_X_RESEARCH_ENABLED: "true", XAI_API_KEY: "test-xai-key", DATABASE_URL: "test-only" })) vi.stubEnv(key, value);
  mocks.lookup.mockResolvedValue({ used: true, requests: 1, reportedUsd: 0.15, evidence: { content: JSON.stringify({ note: "Untrusted public evidence", posts: [] }), sources: [source] } });
});
afterEach(() => vi.unstubAllEnvs());
describe("X research in the shared answer engine", () => {
  it.each([true, false])("offers a read-only tool, handles at most one invocation, and records provenance/cost (fixed tools: %s)", async fixed => {
    const flow = conversation([use("first"), use("duplicate")], fixed), m = metrics(), events: ZarvisEvent[] = [];
    await modelAnswer(prepared(), config, flow.c, m, Date.now(), new AbortController().signal, event => events.push(event));
    expect(flow.rounds[0].tools.some(t => t.name === "search_zcash_x")).toBe(true);
    expect(mocks.lookup).toHaveBeenCalledTimes(1); expect(mocks.lookup.mock.calls[0][0]).toEqual({ topic: "bounties" });
    expect(flow.results[1]).toContain("Lookup limit");
    expect(m).toMatchObject({ xResearchUsd: 0.15, xResearchRequests: 1, xResearchUsed: true });
    expect(estimateUsageUsd(m)).toBeGreaterThan(0.15);
    const done = events.find(e => e.type === "done"); expect(done).toMatchObject({ sources: [source], provenance: { xResearch: true } });
    if (done?.type === "done") expect(provenanceLabel(done.provenance, 1)).toContain("X research via xAI");
  });
  it.each(["disabled", "web-off"])("refuses hallucinated tool calls when %s", async mode => {
    if (mode === "disabled") vi.stubEnv("ZARVIS_X_RESEARCH_ENABLED", "false");
    const flow = conversation([use("malicious")]);
    await modelAnswer(prepared(), { ...config, webSearch: mode !== "web-off" }, flow.c, metrics(), Date.now(), new AbortController().signal, () => {});
    expect(flow.rounds[0].tools.some(t => t.name === "search_zcash_x")).toBe(false); expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it("never grants write tools requested by model output", async () => {
    const flow = conversation([use("malicious", "send_x_dm", '{"to":"attacker"}')]);
    await modelAnswer(prepared(), config, flow.c, metrics(), Date.now(), new AbortController().signal, () => {});
    expect(mocks.lookup).not.toHaveBeenCalled(); expect(flow.results[0]).toContain("Lookup limit");
  });
  it("accounts for the attempted search before propagating a visitor cancellation", async () => {
    const controller = new AbortController(), m = metrics(), flow = conversation([use("abort")]);
    mocks.lookup.mockImplementation(async () => { controller.abort(); return { used: false, requests: 1, reportedUsd: null, evidence: { content: "{}" } }; });
    await expect(modelAnswer(prepared(), config, flow.c, m, Date.now(), controller.signal, () => {})).rejects.toThrow();
    expect(m).toMatchObject({ xResearchRequests: 1, xResearchUsd: null }); expect(estimateUsageUsd(m)).toBeNull();
  });
});
