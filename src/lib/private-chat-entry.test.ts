// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { chatEntryResponse, chatServiceOrigin, PRIVATE_CHAT_SERVICE_ORIGIN } from "./private-chat-entry";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); document.body.innerHTML = ""; window.history.replaceState(null, "", "/"); });

describe("isolated chat entry document", () => {
  it("pins the production service and restricts preview overrides to loopback", () => {
    expect(chatServiceOrigin({ NODE_ENV: "production", PRIVATE_CHAT_LOCAL_ORIGIN: "https://evil.example" })).toBe(PRIVATE_CHAT_SERVICE_ORIGIN);
    expect(chatServiceOrigin({ NODE_ENV: "development", PRIVATE_CHAT_LOCAL_ORIGIN: "http://127.0.0.1:4431" })).toBe("http://127.0.0.1:4431");
    for (const url of ["https://evil.example", "http://user@127.0.0.1:4431", "http://127.0.0.1:4431/path", "http://127.0.0.1:4431?x=1"])
      expect(() => chatServiceOrigin({ NODE_ENV: "development", PRIVATE_CHAT_LOCAL_ORIGIN: url })).toThrow();
  });
  it("serves only a nonce-protected wrapper, without the portal runtime or network access", async () => {
    const response = chatEntryResponse("test-nonce");
    const html = await response.text();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("content-security-policy")).toContain("connect-src 'none'");
    expect(response.headers.get("content-security-policy")).toContain("script-src 'nonce-test-nonce'");
    expect(html).not.toMatch(/_next|zarvis|treasury|<script[^>]+src=/i);
    expect(html).toContain('referrerpolicy="no-referrer"');
  });
  it("clears fragments and forwards them only once after the expected frame is ready", async () => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/private-chat#invite=synthetic-invite");
    const html = await chatEntryResponse("test-nonce").text();
    document.documentElement.innerHTML = html;
    const frame = document.querySelector("iframe")!;
    // Intercept src assignment to keep the synthetic frame stable in jsdom.
    let source = "";
    Object.defineProperty(frame, "src", { get: () => source, set: value => { source = value; } });
    const send = vi.spyOn(frame.contentWindow!, "postMessage");
    const listeners: Array<[string, EventListenerOrEventListenerObject]> = [];
    const add = window.addEventListener.bind(window);
    vi.spyOn(window, "addEventListener").mockImplementation((type, listener, options) => {
      listeners.push([type, listener]); add(type, listener, options);
    });
    const script = document.querySelector("script")!.textContent!;
    new Function(script)();
    expect(window.location.hash).toBe("");
    expect(source).toBe(PRIVATE_CHAT_SERVICE_ORIGIN + "/private-chat?embedded=1");
    expect(send).not.toHaveBeenCalled();
    const ready = { type: "openzcash-chat-ready-v1" };
    window.dispatchEvent(new MessageEvent("message", { origin: "https://evil.example", source: frame.contentWindow, data: ready }));
    window.dispatchEvent(new MessageEvent("message", { origin: PRIVATE_CHAT_SERVICE_ORIGIN, source: window, data: ready }));
    expect(send).not.toHaveBeenCalled();
    const event = () => new MessageEvent("message", { origin: PRIVATE_CHAT_SERVICE_ORIGIN, source: frame.contentWindow, data: ready });
    window.dispatchEvent(event());
    expect(send).toHaveBeenCalledExactlyOnceWith({ type: "openzcash-chat-invitation-v1", kind: "invite", token: "synthetic-invite" }, PRIVATE_CHAT_SERVICE_ORIGIN);
    window.dispatchEvent(event());
    expect(send).toHaveBeenCalledTimes(1);
    window.history.replaceState(null, "", "/private-chat#room=synthetic-room");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(send).toHaveBeenLastCalledWith({ type: "openzcash-chat-invitation-v1", kind: "room", token: "synthetic-room" }, PRIVATE_CHAT_SERVICE_ORIGIN);
    window.history.replaceState(null, "", "/private-chat#invite=" + "x".repeat(4097));
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(send).toHaveBeenCalledTimes(2);
    expect(window.location.hash).toBe("");
    for (const [type, listener] of listeners) window.removeEventListener(type, listener);
  });
});
