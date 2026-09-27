import { afterEach, describe, expect, it, vi } from "vitest";
import { readBoundedJson } from "./request-body";

function streamed(body: ReadableStream<Uint8Array>, signal?: AbortSignal) {
  return new Request("https://openzcash.org/api/zarvis", { method: "POST", headers: { "content-type": "application/json" }, body, signal, duplex: "half" } as RequestInit);
}
afterEach(() => vi.useRealTimers());
describe("Bounded public JSON upload", () => {
  it("decodes UTF-8 split across chunks", async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ question: "Zcash 🔐" }));
    const body = new ReadableStream<Uint8Array>({ start(out) { out.enqueue(bytes.slice(0, bytes.length - 4)); out.enqueue(bytes.slice(bytes.length - 4)); out.close(); } });
    expect(await readBoundedJson(streamed(body), 1024)).toEqual({ question: "Zcash 🔐" });
  });
  it("cancels a body that stays open after the absolute deadline", async () => {
    vi.useFakeTimers(); const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(out) { out.enqueue(new TextEncoder().encode("{")); }, cancel });
    const assertion = expect(readBoundedJson(streamed(body), 1024)).rejects.toThrow("BODY_READ_TIMEOUT");
    await vi.advanceTimersByTimeAsync(5000); await assertion;
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it("does not extend the deadline for a slow trickle of chunks", async () => {
    vi.useFakeTimers(); let out!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start(controller) { out = controller; } });
    const assertion = expect(readBoundedJson(streamed(body), 1024)).rejects.toThrow("BODY_READ_TIMEOUT");
    for (let n = 0; n < 4; n++) { out.enqueue(new TextEncoder().encode(" ")); await vi.advanceTimersByTimeAsync(1000); }
    await vi.advanceTimersByTimeAsync(1000); await assertion;
  });
  it("cancels a pending read when the client disconnects", async () => {
    const controller = new AbortController(), cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const assertion = expect(readBoundedJson(streamed(body, controller.signal), 1024)).rejects.toThrow("REQUEST_ABORTED");
    controller.abort(); await assertion; expect(cancel).toHaveBeenCalledTimes(1);
  });
  it("bounds bytes even without Content-Length and cancels the stream", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(out) { out.enqueue(new Uint8Array(1025)); }, cancel });
    await expect(readBoundedJson(streamed(body), 1024)).rejects.toThrow("BODY_TOO_LARGE");
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it("rejects JSON lookalike content types", async () => {
    await expect(readBoundedJson(new Request("https://openzcash.org", { method: "POST", headers: { "content-type": "application/jsonp" }, body: "{}" }), 1024)).rejects.toThrow("INVALID_REQUEST");
  });
});
