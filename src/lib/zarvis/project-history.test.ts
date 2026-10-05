import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ read: vi.fn(), directory: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/project-history/data", () => ({ projectHistoryDirectory: mocks.directory, readProjectHistory: mocks.read }));
vi.mock("openai", async original => ({ ...await original<object>(), default: class { responses = { create: mocks.create }; } }));
vi.mock("./config", () => ({ zarvisConfig: () => ({ provider: "openai", apiKey: "unit-test-placeholder", model: "test-model", webSearch: false }) }));
import { lookupProjectHistory, directProjectHistoryQuery, projectHistoryAnswer } from "./project-history";
import { generateAnswer } from "./openai";
import { isFinancialEvidence, numericFacts } from "./grounding";
import type { ProjectHistory } from "@/lib/project-history/types";
import type { ZarvisEvent } from "./types";

const data: ProjectHistory = {
  schemaVersion: 1, project: { id: "alpha", name: "Alpha", category: "Infrastructure", description: "Synthetic project", website: "https://example.org", communityId: null },
  assembledAt: "2026-10-02T00:00:00Z", registryCheckedAt: "2026-09-08", repositorySnapshotAt: "2026-09-08", ledgerImportedAt: null,
  coverage: { proposalsAvailable: false, paymentsAvailable: false, releasesComplete: false }, grants: [], timeline: [],
  gaps: ["No milestone acceptance evidence is linked."], reviews: [], reportLinks: [], sources: [], repositories: [], notes: ["Missing is not zero."],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.directory.mockReturnValue([{ id: "alpha", name: "Alpha", category: "Infrastructure" }]);
  mocks.read.mockResolvedValue(data);
  mocks.create.mockRejectedValue(new Error("Unexpected provider request"));
});
describe("Zarvis project history", () => {
  it.each(["Show project history for Alpha.", "Mostre a ficha histórica de Alpha.", "Muestra el historial de Alpha."])("answers %s without a provider call", async question => {
    const events: ZarvisEvent[] = [];
    const metrics = await generateAnswer([{ role: "user", content: question }], new AbortController().signal, event => events.push(event), {}, "auto", { localOnly: true });
    expect(metrics).toMatchObject({ route: "local", modelCalls: 0 });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(events.find(event => event.type === "replace")).toMatchObject({ text: expect.stringContaining("https://openzcash.org/ecosystem/history/alpha") });
    expect(events.at(-1)).toMatchObject({ type: "done", sources: [expect.objectContaining({ url: "https://openzcash.org/ecosystem/history/alpha" })] });
  });
  it("does not absorb a causal or evaluative question into the factual shortcut", () => {
    expect(directProjectHistoryQuery("Did funding Alpha increase adoption?")).toBeUndefined();
    expect(directProjectHistoryQuery("Show project history for Alpha and explain why it failed?")).toBeUndefined();
  });
  it("returns choices without querying finance for ambiguous project names", async () => {
    mocks.directory.mockReturnValue([{ id: "alpha-core", name: "Alpha Core", category: "Other" }, { id: "alpha-wallet", name: "Alpha Wallet", category: "Wallets" }]);
    const result = await lookupProjectHistory({ query: "alpha", month: null }, new AbortController().signal);
    expect(JSON.parse(result.content).data.matchCount).toBe(2);
    expect(projectHistoryAnswer(result, "en")).toContain("Alpha Wallet");
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("rejects invalid tool parameters and preserves cancellation", async () => {
    expect(JSON.parse((await lookupProjectHistory({ query: "alpha", month: "2026-19" }, new AbortController().signal)).content)).toHaveProperty("error");
    expect(mocks.read).not.toHaveBeenCalled();
    const controller = new AbortController(); controller.abort();
    await expect(lookupProjectHistory({ query: "alpha", month: null }, controller.signal)).rejects.toThrow();
  });
  it("caps excerpts with complete counts and keeps monetary fields in the numeric guard", async () => {
    const amount = { known: "12345", records: 1, missing: 0 };
    mocks.read.mockResolvedValue({ ...data, grants: Array.from({ length: 12 }, (_, id) => ({ id: String(id), title: `Grant ${id}`, requestedUsdCents: "50000", budgetUsdCents: amount, paidBudgetUsdCents: amount, recordedZecZat: { ...amount, known: "100000000" }, milestones: [] })) });
    const result = await lookupProjectHistory({ query: "alpha", month: null }, new AbortController().signal);
    expect(JSON.parse(result.content).data).toMatchObject({ counts: { grants: 12 }, excerpt: { grantsShown: 10 } });
    expect(isFinancialEvidence([result])).toBe(true);
    expect(numericFacts([result])).toContainEqual({ unit: "USD", value: 123.45 });
    expect(numericFacts([result])).toContainEqual({ unit: "ZEC", value: 1 });
  });
  it("dispatches the registered function when the model requests a project record", async () => {
    async function* stream(output: unknown[]) {
      yield { type: "response.completed", response: { status: "completed", output, usage: { input_tokens: 10, output_tokens: 10 } } };
    }
    mocks.create.mockResolvedValueOnce(stream([{ type: "function_call", name: "query_project_history", call_id: "history-call", arguments: JSON.stringify({ query: "alpha", month: null }) }]))
      .mockResolvedValueOnce(stream([{ type: "message", role: "assistant", content: [{ type: "output_text", text: "The source coverage is incomplete. [History](https://openzcash.org/ecosystem/history/alpha)", annotations: [] }] }]));
    const metrics = await generateAnswer([{ role: "user", content: "Assess Alpha's evidence gaps." }], new AbortController().signal, () => {});
    expect(mocks.read).toHaveBeenCalledWith("alpha");
    expect(metrics).toMatchObject({ route: "model", modelCalls: 2 });
    expect(mocks.create.mock.calls[1][0].input).toContainEqual(expect.objectContaining({ type: "function_call_output", call_id: "history-call", output: expect.stringContaining("project_history") }));
  });
});
