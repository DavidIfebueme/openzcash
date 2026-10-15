import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ config: vi.fn(), voice: vi.fn(), reserve: vi.fn(), getDb: vi.fn() }));
vi.mock("@/lib/zarvis/config", () => ({ zarvisConfig: mocks.config }));
vi.mock("@/lib/zarvis/usage", () => ({ reserveVoiceRequest: mocks.reserve }));
vi.mock("@/lib/db/client", () => ({ getDb: mocks.getDb }));
vi.mock("@/lib/zarvis/voice", async (original) => ({ ...(await original<typeof import("@/lib/zarvis/voice")>()), voiceConfig: mocks.voice }));
import { POST } from "./route";
import { resetStoreForTests } from "@/lib/zarvis/metrics-store";

const audio = (bytes = 4_000) => new Uint8Array(bytes).fill(7);
function request(body: Uint8Array<ArrayBuffer> = audio(), type = "audio/webm;codecs=opus", origin = "https://openzcash.org") {
  return new Request("https://openzcash.org/api/zarvis/transcribe", { method: "POST", headers: { origin, "content-type": type }, body });
}
const scribe = (body: unknown, status = 200) => vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const logLines = (info: { mock: { calls: unknown[][] } }) => info.mock.calls.map((call) => String(call[0])).filter((line) => line.startsWith("{")).map((line) => JSON.parse(line) as Record<string, unknown>).filter((entry) => entry.event === "zarvis.voice");

beforeEach(() => {
  vi.restoreAllMocks(); vi.clearAllMocks(); resetStoreForTests();
  vi.spyOn(console, "info").mockImplementation(() => {});
  mocks.config.mockReturnValue({ enabled: true, dailyUsdCap: null });
  mocks.voice.mockReturnValue({ enabled: true, apiKey: "eleven-test", model: "scribe_v2" });
  mocks.reserve.mockResolvedValue({ allowed: true, retryAfter: 0 });
  mocks.getDb.mockImplementation(() => { throw new Error("no database in unit tests"); });
});

describe("Zarvis dictation", () => {
  it("returns the transcript and detected language, sending Zcash keyterms and never logging the text", async () => {
    const fetch = scribe({ text: "  Como funciona a votação\n dos coinholders?  ", language_code: "por", audio_duration_secs: 4.2 });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: "Como funciona a votação dos coinholders?", language: "por" });
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.elevenlabs.io/v1/speech-to-text");
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe("eleven-test");
    const form = init.body as FormData;
    expect(form.get("model_id")).toBe("scribe_v2");
    expect(form.getAll("keyterms")).toContain("Zcash");
    expect((form.get("file") as File).type).toBe("audio/webm");
    const lines = logLines(console.info as unknown as { mock: { calls: unknown[][] } });
    expect(lines).toEqual([expect.objectContaining({ outcome: "completed", lang: "por", audioSeconds: 4.2 })]);
    expect(JSON.stringify(lines)).not.toContain("coinholders");
    expect(mocks.reserve).toHaveBeenCalledWith(expect.any(Headers), expect.objectContaining({ networkWindowLimit: expect.any(Number) }));
  });

  it("rejects foreign origins, non-audio bodies, oversized and too-short recordings before any paid call", async () => {
    const fetch = scribe({ text: "x" });
    expect((await POST(request(audio(), "audio/webm", "https://elsewhere.example"))).status).toBe(403);
    expect((await POST(request(audio(), "application/json"))).status).toBe(415);
    expect((await POST(request(audio(2_000_001)))).status).toBe(413);
    expect((await POST(request(audio(100)))).status).toBe(422);
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.reserve).not.toHaveBeenCalled();
  });

  it("stays off when Zarvis or the transcription key is not configured", async () => {
    mocks.voice.mockReturnValue({ enabled: false, apiKey: "", model: "scribe_v2" });
    expect((await POST(request())).status).toBe(503);
    mocks.voice.mockReturnValue({ enabled: true, apiKey: "k", model: "scribe_v2" }); mocks.config.mockReturnValue({ enabled: false, dailyUsdCap: null });
    expect((await POST(request())).status).toBe(503);
  });

  it("honours its own quota with Retry-After and fails closed when the counters are unavailable", async () => {
    const fetch = scribe({ text: "x" });
    mocks.reserve.mockResolvedValueOnce({ allowed: false, retryAfter: 120 });
    const limited = await POST(request());
    expect(limited.status).toBe(429); expect(limited.headers.get("retry-after")).toBe("120");
    mocks.reserve.mockRejectedValueOnce(new Error("db down"));
    expect((await POST(request())).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stops at the daily spend ceiling", async () => {
    mocks.config.mockReturnValue({ enabled: true, dailyUsdCap: -1 });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect((await response.json()).error).toMatch(/today's limit/);
  });

  it("maps provider failures and silence to fixed messages without leaking the provider's text", async () => {
    scribe({ detail: "internal provider detail" }, 500);
    const failed = await POST(request());
    expect(failed.status).toBe(502); expect(JSON.stringify(await failed.json())).not.toContain("provider detail");
    scribe({ text: "   ", audio_duration_secs: 2 });
    const silent = await POST(request());
    expect(silent.status).toBe(422); expect((await silent.json()).error).toMatch(/could not hear/);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    expect((await POST(request())).status).toBe(502);
  });

  it("gives the quota unit back when the provider fails, but not for a recording it transcribed", async () => {
    const refund = vi.fn(async () => true);
    mocks.reserve.mockResolvedValue({ allowed: true, retryAfter: 0, refund });
    scribe({ detail: "down" }, 503);
    await POST(request());
    expect(refund).toHaveBeenCalledTimes(1);
    scribe({ text: "", audio_duration_secs: 3 });
    await POST(request());
    scribe({ text: "What is Orchard?", audio_duration_secs: 3 });
    await POST(request());
    expect(refund).toHaveBeenCalledTimes(1);
  });
});
