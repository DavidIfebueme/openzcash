import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ config: vi.fn(), reserve: vi.fn(), answer: vi.fn() }));
vi.mock("@/lib/zarvis/config", () => ({ zarvisConfig: mocks.config }));
vi.mock("@/lib/zarvis/usage", () => ({ reserveZarvisRequest: mocks.reserve }));
vi.mock("@/lib/zarvis/openai", () => ({ generateAnswer: mocks.answer }));
import { GET, POST } from "./route";
function request(body: unknown = { messages: [{ role: "user", content: "Explain shielded Zcash" }] }, origin = "https://openzcash.org") {
  return new Request("https://openzcash.org/api/zarvis", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.config.mockReturnValue({ enabled: true, webSearch: true });
  mocks.reserve.mockResolvedValue({ allowed: true });
  mocks.answer.mockImplementation(async (_messages, _signal, emit) => { emit({ type: "delta", text: "A grounded answer." }); emit({ type: "done", sources: [] }); });
});
describe("Zarvis API", () => {
  it("only exposes public readiness, never configuration or keys", async () => {
    mocks.config.mockReturnValue({ enabled: false, apiKey: "secret-sentinel", webSearch: true });
    const response = GET();
    expect(await response.json()).toEqual({ available: false, provider: "OpenAI", webSearch: true });
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
    mocks.answer.mockRejectedValueOnce(new Error("provider-secret-sentinel"));
    const failure = await (await POST(request())).text();
    expect(failure).toContain('"type":"error"'); expect(failure).not.toContain("provider-secret");
  });
});
