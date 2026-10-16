// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatEntryResponse, chatServiceOrigin, PRIVATE_CHAT_SERVICE_ORIGIN } from "./private-chat-entry";
import { APPS } from "./design-routes";

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn() })));
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); document.body.innerHTML = ""; window.history.replaceState(null, "", "/"); });

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
    expect(html).not.toMatch(/_next|<script[^>]+src=/i);
    expect(html).toContain('referrerpolicy="no-referrer"');
    document.documentElement.innerHTML = html;
    expect(document.querySelector('nav [aria-current="page"]')?.getAttribute("href")).toBe("/private-chat");
    for (const app of APPS.filter(app => !app.hidden && !app.admin)) {
      expect(document.querySelector(`nav a[href="${app.id === "zcg" ? "/zcg/participate" : app.href}"]`)).not.toBeNull();
      for (const page of app.pages.filter(page => !page.hidden)) expect(document.querySelector(`nav a[href="${page.href}"]`)).not.toBeNull();
    }
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
    expect(source).toBe(PRIVATE_CHAT_SERVICE_ORIGIN + "/private-chat?embedded=1&shell=portal");
    expect(send).not.toHaveBeenCalled();
    const ready = { type: "openzcash-chat-ready-v1" };
    window.dispatchEvent(new MessageEvent("message", { origin: "https://evil.example", source: frame.contentWindow, data: ready }));
    window.dispatchEvent(new MessageEvent("message", { origin: PRIVATE_CHAT_SERVICE_ORIGIN, source: window, data: ready }));
    expect(send).not.toHaveBeenCalled();
    const event = () => new MessageEvent("message", { origin: PRIVATE_CHAT_SERVICE_ORIGIN, source: frame.contentWindow, data: ready });
    window.dispatchEvent(event());
    const invitations = () => send.mock.calls.filter(([message]) => message.type === "openzcash-chat-invitation-v1");
    expect(invitations()).toEqual([[{ type: "openzcash-chat-invitation-v1", kind: "invite", token: "synthetic-invite" }, PRIVATE_CHAT_SERVICE_ORIGIN]]);
    window.dispatchEvent(event());
    expect(invitations()).toHaveLength(1);
    window.history.replaceState(null, "", "/private-chat#room=synthetic-room");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(send).toHaveBeenLastCalledWith({ type: "openzcash-chat-invitation-v1", kind: "room", token: "synthetic-room" }, PRIVATE_CHAT_SERVICE_ORIGIN);
    window.history.replaceState(null, "", "/private-chat#invite=" + "x".repeat(4097));
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(invitations()).toHaveLength(2);
    expect(window.location.hash).toBe("");
    for (const [type, listener] of listeners) window.removeEventListener(type, listener);
  });
  it("syncs only the theme, expands the menu, and waits for authenticated leave approval", async () => {
    vi.useFakeTimers();
    localStorage.setItem("oz-theme", "dark");
    document.documentElement.innerHTML = await chatEntryResponse("test-nonce").text();
    const frame = document.querySelector("iframe")!;
    Object.defineProperty(frame, "src", { set() {} });
    const send = vi.spyOn(frame.contentWindow!, "postMessage");
    const assign = vi.fn();
    const listeners: Array<[string, EventListenerOrEventListenerObject]> = [];
    const add = window.addEventListener.bind(window);
    vi.spyOn(window, "addEventListener").mockImplementation((type, listener, options) => { listeners.push([type, listener]); add(type, listener, options); });
    new Function("location", document.querySelector("script")!.textContent!)({ origin: window.location.origin, href: window.location.href, hash: "", assign });
    const receive = (data: unknown, origin = PRIVATE_CHAT_SERVICE_ORIGIN, source: Window = frame.contentWindow!) => window.dispatchEvent(new MessageEvent("message", { origin, source, data }));
    receive({ type: "openzcash-chat-ready-v1" });
    expect(send).toHaveBeenLastCalledWith({ type: "openzcash-chat-theme-v1", theme: "dark" }, PRIVATE_CHAT_SERVICE_ORIGIN);
    document.getElementById("theme")!.click();
    expect(send).toHaveBeenLastCalledWith({ type: "openzcash-chat-theme-v1", theme: "light" }, PRIVATE_CHAT_SERVICE_ORIGIN);
    document.querySelector<HTMLButtonElement>('[aria-controls="nav-zcg"]')!.click();
    expect(document.getElementById("nav-zcg")!.hidden).toBe(false);
    document.querySelector<HTMLAnchorElement>('a[href="/news"]')!.click();
    const request = send.mock.lastCall![0];
    expect(request.type).toBe("openzcash-chat-leave-request-v1");
    const approval = { type: "openzcash-chat-leave-result-v1", id: request.id, approved: true };
    receive(approval, "https://evil.example");
    receive(approval, PRIVATE_CHAT_SERVICE_ORIGIN, window);
    receive({ ...approval, id: "another-request" });
    receive({ ...approval, extra: "ignored" });
    expect(assign).not.toHaveBeenCalled();
    receive({ ...approval, approved: false });
    expect(assign).not.toHaveBeenCalled();
    document.querySelector<HTMLAnchorElement>('a[href="/news"]')!.click();
    receive({ ...approval, id: send.mock.lastCall![0].id });
    expect(assign).toHaveBeenCalledExactlyOnceWith(new URL("/news", window.location.href).href);
    receive(approval);
    expect(assign).toHaveBeenCalledTimes(1);
    for (const [type, listener] of listeners) window.removeEventListener(type, listener);
  });
});
