import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ create: vi.fn(), lookup: vi.fn() }));
vi.mock("openai", () => ({ default: class { responses = { create: mocks.create }; } }));
vi.mock("./config", () => ({ zarvisConfig: () => ({ apiKey: "unit-test-not-a-key", model: "gpt-5-mini", webSearch: true }) }));
vi.mock("./data", async (original) => ({ ...await original<object>(), lookupPublicData: mocks.lookup }));
import { generateAnswer } from "./openai";
import type { ZarvisEvent } from "./types";

async function* events(output: unknown[], text?: string) {
  if (text) yield { type: "response.output_text.delta", delta: text };
  yield { type: "response.completed", response: { status: "completed", output } };
}
const answer = (text: string) => ({ type: "message", role: "assistant", content: [{ type: "output_text", text, annotations: [] }] });
const call = (id: string, args = '{"topic":"treasuries","query":""}') => ({ type: "function_call", name: "lookup_openzcash", call_id: id, arguments: args });
beforeEach(() => { vi.clearAllMocks(); });
describe("Zarvis OpenAI orchestration", () => {
  it("fetches public evidence, passes provenance back and completes with citations", async () => {
    const url = "https://openzcash.org/zcg/treasury-calculator";
    mocks.create.mockResolvedValueOnce(events([call("lookup-1")])).mockResolvedValueOnce(events([answer(`The reported balance is dated. [Treasury](${url})`)]));
    mocks.lookup.mockResolvedValue({ content: '{"snapshotAt":"2026-09-16","zec":10}', source: { title: "Treasury", url, retrievedAt: "2026-09-25T12:00:00Z" } });
    const emitted: ZarvisEvent[] = [];
    await generateAnswer([{ role: "user", content: "What does ZCG hold?" }], new AbortController().signal, (event) => emitted.push(event));
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.lookup).toHaveBeenCalledTimes(1);
    for (const [params, options] of mocks.create.mock.calls) {
      expect(params.store).toBe(false); expect(params.max_output_tokens).toBe(3000); expect(params.max_tool_calls).toBe(1);
      expect(options.signal).toBeInstanceOf(AbortSignal);
      expect(params).not.toHaveProperty("previous_response_id");
    }
    expect(JSON.stringify(mocks.create.mock.calls[1][0].input)).toContain("2026-09-16");
    expect(emitted.at(-1)).toMatchObject({ type: "done", sources: [{ title: "Treasury", url }] });
  });
  it("never executes more than three local lookups or a second tool round", async () => {
    mocks.create.mockResolvedValueOnce(events([call("a"), call("b"), call("c"), call("d")])).mockResolvedValueOnce(events([call("again")]));
    mocks.lookup.mockResolvedValue({ content: "{}" });
    await expect(generateAnswer([{ role: "user", content: "Get public sources" }], new AbortController().signal, () => {})).rejects.toThrow("TOOL_LIMIT");
    expect(mocks.lookup).toHaveBeenCalledTimes(3); expect(mocks.create).toHaveBeenCalledTimes(2);
  });
  it("removes web search after a completed search and honors cancellation", async () => {
    mocks.create.mockResolvedValueOnce(events([{ type: "web_search_call" }, call("a")])).mockResolvedValueOnce(events([answer("Here is the result.")]));
    mocks.lookup.mockResolvedValue({ content: "{}" });
    await generateAnswer([{ role: "user", content: "Latest funding sources" }], new AbortController().signal, () => {});
    expect(mocks.create.mock.calls[1][0].tools).toEqual([]);
    const controller = new AbortController(); controller.abort();
    const count = mocks.create.mock.calls.length;
    await expect(generateAnswer([{ role: "user", content: "Stop" }], controller.signal, () => {})).rejects.toThrow();
    expect(mocks.create).toHaveBeenCalledTimes(count);
  });
  it("does not mark incomplete provider output as a finished answer", async () => {
    mocks.create.mockResolvedValueOnce((async function* () { yield { type: "response.incomplete", response: { status: "incomplete" } }; })());
    const emitted: ZarvisEvent[] = [];
    await expect(generateAnswer([{ role: "user", content: "Explain mining" }], new AbortController().signal, (event) => emitted.push(event))).rejects.toThrow("INCOMPLETE_RESPONSE");
    expect(emitted.some((event) => event.type === "done")).toBe(false);
  });
});
