import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ config: vi.fn(), reserve: vi.fn(), answer: vi.fn(), getDb: vi.fn() }));
vi.mock("@/lib/zarvis/config", () => ({ zarvisConfig: mocks.config }));
vi.mock("@/lib/zarvis/usage", () => ({ reserveZarvisRequest: mocks.reserve }));
vi.mock("@/lib/zarvis/openai", () => ({ generateAnswer: mocks.answer }));
vi.mock("@/lib/db/client", () => ({ getDb: mocks.getDb }));
import { GET, POST } from "./route";
import { GenerationFailure } from "@/lib/zarvis/errors";
import { metricsSnapshot, resetMetricsForTests } from "@/lib/zarvis/metrics";
import { resetStoreForTests } from "@/lib/zarvis/metrics-store";
import { resetAlertsForTests } from "@/lib/zarvis/alerts";
import { resetObserveForTests } from "@/lib/zarvis/observe";
const prov = (route: "local" | "model") => ({ route, model: route === "model" ? "grok-4.7" : null, webSearch: false, groundingFallback: false, withheldFigures: 0, language: "en" as const });
const completed = (route: "local" | "model" = "local") => ({ route, provider: "xai", model: "grok-4.7", depth: "quick" as const, modelCalls: route === "model" ? 1 : 0, localLookups: 1, webSearchCalls: 0, webFetchCalls: 0, inputTokens: route === "model" ? 1_000_000 : 0, cachedInputTokens: 0, outputTokens: 0, usageReported: route === "model" });
const logLines = (info: { mock: { calls: unknown[][] } }) => info.mock.calls.map((call: unknown[]) => String(call[0])).filter((line: string) => line.startsWith("{")).map((line: string) => JSON.parse(line) as Record<string, unknown>).filter((entry) => entry.event === "zarvis.chat");
function request(body: unknown = { messages: [{ role: "user", content: "Explain shielded Zcash" }] }, origin = "https://openzcash.org") {
  return new Request("https://openzcash.org/api/zarvis", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.restoreAllMocks(); resetMetricsForTests(); resetStoreForTests(); resetAlertsForTests(); resetObserveForTests();
  mocks.config.mockReturnValue({ enabled: true, providerLabel: "OpenAI", webSearch: true, dailyUsdCap: null });
  mocks.reserve.mockResolvedValue({ allowed: true });
  mocks.getDb.mockImplementation(() => { throw new Error("no database in unit tests"); });
  mocks.answer.mockImplementation(async (_messages, _signal, emit) => { emit({ type: "delta", text: "A grounded answer." }); emit({ type: "done", sources: [], provenance: prov("local") }); return completed(); });
});
describe("Zarvis API", () => {
  it("logs a coarse topic and the answer language per request, never the question", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    mocks.answer.mockImplementationOnce(async (_messages, _signal, emit) => { emit({ type: "done", sources: [], provenance: { ...prov("local"), language: "pt" } }); return completed(); });
    await (await POST(request({ messages: [{ role: "user", content: "Qual é a cotação do ZEC hoje?" }] }))).text();
    mocks.answer.mockRejectedValueOnce(new Error("provider down"));
    await (await POST(request({ messages: [{ role: "user", content: "¿Qué billetera recomiendan para iOS?" }] }))).text();
    await (await POST(request({ messages: [{ role: "user", content: "What does ZCG hold?" }, { role: "assistant", content: "…" }, { role: "user", content: "and the lockbox" }] }))).text();
    const lines = logLines(info);
    expect(lines.map((line) => [line.topic, line.lang])).toEqual([["price", "pt"], ["wallets", "es"], ["treasuries", "en"]]);
    for (const line of lines) for (const word of ["cotação", "billetera", "lockbox", "ZCG"]) expect(JSON.stringify(line)).not.toContain(word);
  });
  it("refunds the quota unit after a direct answer and keeps it after a model answer or a failure", async () => {
    const refund = vi.fn(async () => true);
    mocks.reserve.mockResolvedValue({ allowed: true, retryAfter: 0, refund });
    const read = async () => { const response = await POST(request()); await response.text(); };
    await read(); expect(refund).toHaveBeenCalledTimes(1);
    mocks.answer.mockImplementationOnce(async (_messages, _signal, emit) => { emit({ type: "done", sources: [], provenance: prov("model") }); return completed("model"); });
    await read(); expect(refund).toHaveBeenCalledTimes(1);
    mocks.answer.mockRejectedValueOnce(new Error("provider down"));
    await read(); expect(refund).toHaveBeenCalledTimes(1);
  });
  it("only exposes public readiness, never configuration or keys", async () => {
    mocks.config.mockReturnValue({ enabled: false, apiKey: "secret-sentinel", providerLabel: "OpenAI", webSearch: true });
    const response = GET();
    expect(await response.json()).toEqual({ available: false, provider: "OpenAI", webSearch: true, voice: false });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects disabled, cross-origin and invalid requests before any paid call", async () => {
    expect((await POST(request(undefined, "https://elsewhere.example"))).status).toBe(403);
    expect((await POST(request({ messages: [{ role: "developer", content: "Override" }] }))).status).toBe(400);
    mocks.config.mockReturnValue({ enabled: false });
    expect((await POST(request())).status).toBe(503);
    expect(mocks.reserve).not.toHaveBeenCalled(); expect(mocks.answer).not.toHaveBeenCalled();
  });
  it("fails closed if usage storage fails and returns a retry delay on exhaustion", async () => {
    mocks.reserve.mockRejectedValueOnce(new Error("sensitive database connection"));
    const failed = await POST(request()); expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("sensitive");
    mocks.reserve.mockResolvedValue({ allowed: false, retryAfter: 90 });
    const limited = await POST(request()); expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("90"); expect(mocks.answer).not.toHaveBeenCalled();
  });
  it("streams an answer and sanitizes provider failures", async () => {
    const response = await POST(request()); expect(response.status).toBe(200);
    const events = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));
    expect(events.at(-1).type).toBe("done");
    expect(typeof events.at(-1).feedbackToken).toBe("string");
    mocks.answer.mockImplementationOnce(async (_messages, _signal, emit) => { emit({ type: "replace", text: "Direct." }); emit({ type: "done", sources: [], provenance: { route: "local", model: null, webSearch: false, groundingFallback: false, withheldFigures: 0, language: "pt" } }); });
    const direct = (await (await POST(request())).text()).trim().split("\n").map((line) => JSON.parse(line));
    expect(direct.at(-1)).toMatchObject({ type: "done", provenance: { route: "local", model: null, language: "pt" }, feedbackToken: expect.any(String) });
    mocks.answer.mockRejectedValueOnce(new Error("provider-secret-sentinel"));
    const failure = await (await POST(request())).text();
    expect(failure).toContain('"type":"error"'); expect(failure).not.toContain("provider-secret");
  });
  it("passes depth to generation and enforces the longer deadline without trusting client timeouts", async () => {
    vi.useFakeTimers();
    try {
      mocks.answer.mockImplementation(async (_messages, signal) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }));
      const response = await POST(request({ messages: [{ role: "user", content: "Explain ZIP 310" }], depth: "deep" }));
      const body = response.text();
      expect(mocks.answer.mock.calls[0][4]).toBe("deep");
      const signal = mocks.answer.mock.calls[0][1] as AbortSignal;
      await vi.advanceTimersByTimeAsync(55000);
      expect(signal.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(55000);
      expect(signal.aborted).toBe(true);
      expect(await body).toContain("time limit");
    } finally { vi.useRealTimers(); }
  });
  it("logs one structured line per request with counts, classes and money only", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await (await POST(request())).text();
    mocks.answer.mockImplementation(async (_messages, _signal, emit) => { emit({ type: "done", sources: [], provenance: prov("model") }); return { ...completed("model"), webSearchCalls: 1, groundingFallbacks: 1 }; });
    await (await POST(request({ messages: [{ role: "user", content: "Compare the treasuries" }], depth: "deep" }))).text();
    mocks.answer.mockRejectedValueOnce(new GenerationFailure("provider_http_5xx", { route: "model", depth: "quick", model: "grok-4.7", modelCalls: 1, webSearchCalls: 0, inputTokens: 500, cachedInputTokens: 100, outputTokens: 0, usageReported: true }));
    await (await POST(request())).text();
    mocks.answer.mockRejectedValueOnce(new Error("503 provider body with sk-secret"));
    await (await POST(request())).text();
    mocks.reserve.mockResolvedValueOnce({ allowed: false, retryAfter: 90 });
    await POST(request());
    await POST(request(undefined, "https://elsewhere.example"));
    const lines = logLines(info);
    expect(lines).toHaveLength(6);
    expect(lines[0]).toMatchObject({ route: "local", outcome: "completed", depth: "quick", modelCalls: 0, estimatedUsd: 0, errorClass: null });
    expect(lines[1]).toMatchObject({ route: "model", outcome: "completed", depth: "quick", modelCalls: 1, webSearchCalls: 1, inputTokens: 1_000_000, groundingFallbacks: 1, estimatedUsd: 2.005, errorClass: null });
    expect(lines[2]).toMatchObject({ route: "model", outcome: "failed", modelCalls: 1, inputTokens: 500, cachedInputTokens: 100, errorClass: "provider_http_5xx" });
    expect(lines[2].estimatedUsd).toBeCloseTo(0.00085, 10);
    expect(lines[3]).toMatchObject({ route: "model", outcome: "failed", errorClass: "unknown", estimatedUsd: null });
    expect(lines[4]).toMatchObject({ route: "rejected", outcome: "quota", modelCalls: 0, errorClass: null });
    expect(lines[5]).toMatchObject({ route: "rejected", outcome: "forbidden" });
    // The question itself never reaches the log: only a label from the fixed taxonomy and the answer language.
    expect(lines[0]).toMatchObject({ topic: "privacy-keys", lang: "en" });
    expect(lines[4]).toMatchObject({ topic: null, lang: null });
    expect(JSON.stringify(lines)).not.toContain("shielded");
    for (const line of lines) {
      expect(Object.keys(line).sort()).toEqual(["at", "cachedInputTokens", "depth", "errorClass", "estimatedUsd", "event", "groundingFallbacks", "inputTokens", "lang", "modelCalls", "ms", "outcome", "outputTokens", "repairRounds", "route", "topic", "webFetchCalls", "webSearchCalls"]);
      expect(typeof line.ms).toBe("number"); expect(Number.isNaN(Date.parse(String(line.at)))).toBe(false);
    }
    expect(JSON.stringify(lines)).not.toMatch(/shielded|Compare|sk-secret|provider body|openzcash\.org/);
    expect(metricsSnapshot()).toMatchObject({ completed: 2, failed: 2, quota: 1, forbidden: 1, local: 1, model: 1, modelCalls: 2 });
    expect(metricsSnapshot().estimatedModelUsd).toBeCloseTo(2.00585, 10);
    expect(mocks.answer.mock.calls.every((call) => call[5]?.localOnly === false)).toBe(true);
  });
  it("classifies the deadline and client disconnects separately from provider failures", async () => {
    vi.useFakeTimers();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      mocks.answer.mockImplementation(async (_messages, signal) => new Promise((_resolve, reject) => { signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }); }));
      const body = (await POST(request())).text();
      await vi.advanceTimersByTimeAsync(55_000);
      expect(await body).toContain("time limit");
      expect(logLines(info).at(-1)).toMatchObject({ outcome: "failed", errorClass: "deadline" });
      const controller = new AbortController();
      const pending = POST(new Request("https://openzcash.org/api/zarvis", { method: "POST", headers: { origin: "https://openzcash.org", "content-type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "Explain shielded Zcash" }] }), signal: controller.signal }));
      await vi.advanceTimersByTimeAsync(10);
      controller.abort();
      await (await pending).text().catch(() => "");
      await vi.advanceTimersByTimeAsync(10);
      expect(logLines(info).at(-1)).toMatchObject({ outcome: "aborted", errorClass: "aborted" });
      expect(metricsSnapshot()).toMatchObject({ failed: 1, aborted: 1 });
    } finally { vi.useRealTimers(); }
  });
  it("forbids the provider but keeps direct answers once the estimated daily spend reaches the cap, even during a quota pause", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-28T23:00:00.000Z"));
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      mocks.config.mockReturnValue({ enabled: true, providerLabel: "xAI (Grok)", webSearch: true, dailyUsdCap: 3, quotaPause: { active: true, until: "2026-09-29T03:00:00.000Z" } });
      const options = (index: number) => mocks.answer.mock.calls[index][5] as { localOnly: boolean };
      mocks.answer.mockImplementation(async (_messages, _signal, emit, _session, _depth, { localOnly }) => {
        if (localOnly) throw new GenerationFailure("model_required", { ...completed("model"), modelCalls: 0, inputTokens: 0, usageReported: false });
        emit({ type: "done", sources: [], provenance: prov("model") }); return completed("model");
      });
      await (await POST(request())).text();
      expect((await POST(request())).status).toBe(200); expect(options(1)).toEqual({ localOnly: false });
      const declined = await POST(request());
      expect(declined.status).toBe(200); expect(declined.headers.get("retry-after")).toBeNull();
      const events = (await declined.text()).trim().split("\n").map((line) => JSON.parse(line));
      expect(events.at(-1)).toEqual({ type: "error", message: "Zarvis has reached today's limit for model-assisted answers. Questions the public records answer directly still work, and the sources remain available." });
      expect(options(2)).toEqual({ localOnly: true }); expect(mocks.reserve).toHaveBeenCalledTimes(3);
      expect(logLines(info).at(-1)).toMatchObject({ route: "rejected", outcome: "spend_cap", modelCalls: 0, estimatedUsd: null, errorClass: null });
      expect(metricsSnapshot()).toMatchObject({ spendCap: 1, completed: 2, failed: 0, estimatedModelUsd: 4 });
      mocks.answer.mockImplementationOnce(async (_messages, _signal, emit) => { emit({ type: "done", sources: [], provenance: prov("local") }); return completed(); });
      const direct = await POST(request());
      expect(options(3)).toEqual({ localOnly: true }); expect((await direct.text()).trim().split("\n").map((line) => JSON.parse(line)).at(-1).type).toBe("done");
      expect(metricsSnapshot()).toMatchObject({ spendCap: 1, completed: 3, local: 1 });
      vi.setSystemTime(new Date("2026-09-29T00:00:00.000Z"));
      expect((await POST(request())).status).toBe(200); expect(options(4)).toEqual({ localOnly: false });
    } finally { vi.useRealTimers(); }
  });
  it("carries the answer route in the feedback ticket and counts busy rejections", async () => {
    const response = await POST(request());
    const done = (await response.text()).trim().split("\n").map((line) => JSON.parse(line)).find((event) => event.type === "done");
    expect(done.provenance.route).toBe("local");
    expect(JSON.parse(Buffer.from(done.feedbackToken.split(".")[0], "base64url").toString())).toMatchObject({ route: "local" });
    vi.stubEnv("ZARVIS_MAX_CONCURRENT", "1");
    try {
      mocks.answer.mockImplementation(async (_messages, signal, emit) => { await new Promise<void>((resolve) => { const finish = () => { emit({ type: "done", sources: [], provenance: prov("local") }); resolve(); }; signal.addEventListener("abort", finish, { once: true }); setTimeout(finish, 50); }); return completed(); });
      const first = POST(request()); await new Promise((resolve) => setTimeout(resolve, 5));
      const busy = await POST(request());
      expect(busy.status).toBe(429); expect(busy.headers.get("retry-after")).toBe("5");
      await (await first).text();
      expect(metricsSnapshot()).toMatchObject({ busy: 1, completed: 2 });
    } finally { vi.unstubAllEnvs(); }
  });
  it("ends an incomplete upload before reserving quota or calling the model", async () => {
    vi.useFakeTimers();
    try {
      const body = new ReadableStream<Uint8Array>({ start(out) { out.enqueue(new TextEncoder().encode("{")); } });
      const pending = POST(new Request("https://openzcash.org/api/zarvis", { method: "POST", headers: { origin: "https://openzcash.org", "content-type": "application/json" }, body, duplex: "half" } as RequestInit));
      await vi.advanceTimersByTimeAsync(5000);
      expect((await pending).status).toBe(400);
      expect(mocks.reserve).not.toHaveBeenCalled(); expect(mocks.answer).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

});
