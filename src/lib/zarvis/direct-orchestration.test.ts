import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn(), create: vi.fn(), lookup: vi.fn(), ledger: vi.fn(), zip: vi.fn() }));
vi.mock("openai", () => ({ default: class { constructor() { mocks.client(); } responses = { create: mocks.create }; } }));
vi.mock("./config", () => ({ zarvisConfig: () => ({ provider: "xai", apiKey: "unit-test-not-a-key", model: "grok-4.7", webSearch: true }) }));
vi.mock("./data", async original => ({ ...await original<object>(), lookupPublicData: mocks.lookup }));
vi.mock("./ledger", async original => ({ ...await original<object>(), queryLedger: mocks.ledger }));
vi.mock("./zips", async original => ({ ...await original<object>(), getZipCorpus: mocks.zip }));
import { generateAnswer } from "./openai";
import { bundledZipCorpus } from "./knowledge";
import type { ZarvisEvent, ChatMessage } from "./types";
import type { ZarvisSession } from "./session";
import type { ResponseDepth } from "./depth";
const user = (content: string): ChatMessage => ({ role: "user", content });
const history = (...q: string[]) => q.flatMap(content => [user(content), { role: "assistant" as const, content: "A sourced answer." }]).slice(0, -1);
const run = async (messages: ChatMessage[], session: ZarvisSession = {}, depth: ResponseDepth = "auto") => {
  const emitted: ZarvisEvent[] = [];
  const metrics = await generateAnswer(messages, new AbortController().signal, event => emitted.push(event), session, depth);
  return { metrics, emitted, text: emitted.flatMap(e => e.type === "replace" ? [e.text] : []).join("\n") };
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockImplementation(() => { throw new Error("UNEXPECTED_BILLED_CALL"); });
  mocks.zip.mockResolvedValue({ corpus: { ...bundledZipCorpus, retrievedAt: new Date().toISOString() }, stale: false });
  mocks.ledger.mockImplementation(async (filters) => ({ filters, importedAt: new Date().toISOString(), rows: 12, paidEntries: 10, budgetedUsdOfPaidEntries: "12345.67", recordedZecPaid: "20.25", paidEntriesMissingUsd: 0, paidEntriesMissingZec: 0, paidEntriesWithoutDate: 0, note: "Complete aggregate." }));
  mocks.lookup.mockResolvedValue({ content: JSON.stringify({ data: {
    quote: { usd: 100, quotedAt: new Date().toISOString(), stale: false },
    funds: { zcg: { zec: 50, cashUsd: 1000, snapshotAt: "2026-09-16", importedAt: new Date().toISOString(), updatesRequired: true }, lockbox: { estimatedZec: 80, estimateThroughBlock: 3500000, sourceAnchorBlock: 3400000, sourceAnchorDate: "2026-09-16", importedAt: new Date().toISOString(), updatesRequired: false } },
    price: { cents: 10000, quotedAt: new Date().toISOString(), stale: false },
  } }), source: { title: "Public data", url: "https://openzcash.org/lockbox", retrievedAt: new Date().toISOString() } });
});

describe("Real local planner through the answer orchestrator, provider forbidden", () => {
  it.each([
    ["What is Zcash?"], ["What is a full viewing key?"], ["Where is the treasury calculator?"],
    ["What is solrate?"], ["O que é um pool de mineração?"], ["Where can I find Zcash mining data?"],
    ["Why do ZcashInfo and ZecStats show different hashrates?"],
    ["Qual é o hashrate atual da rede Zcash? Cite a fonte, a data e a janela de medição."],
    ["O ZcashInfo e o ZecStats mostram hashrates diferentes. Isso significa que um está errado? Como comparar os dois corretamente?"],
    ["Qual é o preço do ZEC?"], ["How much has ZCG paid in grants?"],
    ["How much did coinholders pay in grants to Zingo in 2024?", "e em 2025?"],
    ["What does ZCG hold?", "e o Lockbox?"], ["What are the ZCG and Lockbox balances?"],
    ["What is ZIP 317?", "When was it created?"], ["What is the latest ZIP?", "and ZIP 32?"],
    ["What is a viewing key?", "Can it spend my ZEC?"], ["Olá"], ["Obrigado"],
    ["Responda em português", "What is Zcash?"], ["Use USD", "ZEC price"], ["Be brief", "What is ZCG?"],
  ])("finishes with zero model calls for %j", async (...questions) => {
    const result = await run(history(...questions));
    expect(result.metrics).toMatchObject({ route: "local", modelCalls: 0, inputTokens: 0, outputTokens: 0, webSearchCalls: 0 });
    expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
    expect(result.text).toBeTruthy(); expect(result.text).not.toMatch(/NaN|undefined/); expect(result.emitted.at(-1)?.type).toBe("done");
  });
  it("respects stored Portuguese and preserves source links", async () => {
    const result = await run([user("What is Zcash?")], { language: "pt", currency: "USD", detail: "brief" });
    expect(result.text).toContain("Zcash é uma rede");
    expect(result.emitted.at(-1)).toMatchObject({ type: "done", sources: [expect.objectContaining({ url: "https://z.cash/learn/how-to-use-zcash/" })] });
  });
  it("acknowledges only the preference actually set", async () => {
    expect((await run([user("Por favor responda em português")])).text).toBe("Combinado. Vou responder em português.");
    expect((await run([user("Use USD")])).text).toBe("Understood. I'll use USD for monetary amounts.");
    expect((await run([user("Be brief")])).text).toBe("Understood. I'll keep answers concise.");
  });
  it.each(["Answer in Portuguese?", "Reply in Portuguese, please.", "Responda em português por favor."])("does not acknowledge a language setting without retaining it: %s", async (question) => {
    const result = await run(history(question, "What is Zcash?"));
    expect(result.text).toContain("Zcash é uma rede");
    expect(result.emitted.find(e => e.type === "session")).toMatchObject({ session: { language: "pt" } });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("uses no provider to announce a data outage, instead of inventing zero", async () => {
    mocks.ledger.mockRejectedValueOnce(new Error("unavailable"));
    const result = await run([user("How much has ZCG paid in grants?")]);
    expect(result.text).toContain("does not mean the total is zero"); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects malformed totals without NaN or a fictitious zero", async () => {
    mocks.ledger.mockResolvedValueOnce({ filters: { scope: "zcg_grants", year: null, search: "" }, importedAt: "invalid", budgetedUsdOfPaidEntries: null });
    const result = await run([user("How much has ZCG paid in grants?")]);
    expect(result.text).toContain("unavailable"); expect(result.text).not.toMatch(/NaN|\$0\.00/); expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each([
    { question: "What is Zcash?", session: { language: "fr" } },
    { question: "ZEC price", session: { currency: "BRL" } },
    { question: "What is Zcash?", session: { detail: "detailed" } },
    { question: "What is Zcash?", depth: "deep" },
    { question: "Compare Zcash privacy and Bitcoin privacy" },
    { question: "Is ZIP 259 activated?" },
  ] as Array<{ question: string; session?: ZarvisSession; depth?: ResponseDepth }>) ("retains model synthesis for unsupported/deep semantics: $question $session $depth", async ({ question, session, depth }) => {
    mocks.create.mockResolvedValueOnce((async function* () { yield { type: "response.completed", response: { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "A contextual answer with the requested analysis.", annotations: [] }] }], usage: { input_tokens: 100, output_tokens: 20 } } }; })());
    const result = await run([user(question)], session, depth);
    expect(result.metrics).toMatchObject({ route: "model", modelCalls: 1 }); expect(mocks.create).toHaveBeenCalledOnce();
  });
  it("does not discard earlier formatting constraints or turn a yes into a repeated answer", async () => {
    await expect(run(history("Answer only in JSON", "What is Zcash?"))).rejects.toThrow("UNEXPECTED_BILLED_CALL");
    await expect(run(history("What is the latest ZIP?", "yes"))).rejects.toThrow("UNEXPECTED_BILLED_CALL");
  });
});
