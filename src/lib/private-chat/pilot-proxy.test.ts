import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";
function pilot() {
  const env = {
    NODE_ENV:"production", PRIVATE_CHAT_DEPLOYMENT:"pilot", NEXT_PUBLIC_PRIVATE_CHAT_PILOT:"true",
    PRIVATE_CHAT_ORIGIN:"https://chat.example", PRIVATE_CHAT_ISOLATED:"true",
    NEXT_PUBLIC_PRIVATE_CHAT_GATEWAY_ORIGIN:"wss://gateway.example:9001", NEXT_PUBLIC_PRIVATE_CHAT_GATEWAY_ID:"1".repeat(44),
    PRIVATE_CHAT_DIRECTORY_ADDRESS:"1".repeat(44)+"."+"2".repeat(44)+"@"+"3".repeat(44),
    PRIVATE_CHAT_DIRECTORY_PUBLIC_KEY:"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  };
  for (const [key,value] of Object.entries(env)) vi.stubEnv(key,value);
}
afterEach(()=>vi.unstubAllEnvs());
describe("isolated pilot boundary", () => {
  it("allows only the official portal to frame the explicit embedded entry", () => {
    pilot();
    const policy = (query: string) => proxy(new NextRequest("https://chat.example/private-chat" + query)).headers.get("content-security-policy");
    expect(policy("")).toContain("frame-ancestors 'none'");
    expect(policy("?embedded=1")).toContain("frame-ancestors https://openzcash.org;");
    expect(policy("?embedded=https://evil.example")).toContain("frame-ancestors 'none'");
    expect(policy("?embedded=1&parent=https://evil.example")).not.toContain("evil.example");
  });
  it("fails closed by default and rejects an unintended origin", () => {
    vi.stubEnv("NODE_ENV","production");
    vi.stubEnv("PRIVATE_CHAT_DEPLOYMENT","");
    expect(proxy(new NextRequest("https://openzcash.org/private-chat")).status).toBe(404);
    pilot();
    expect(proxy(new NextRequest("https://openzcash.org/private-chat")).status).toBe(404);
    expect(proxy(new NextRequest("http://chat.example/private-chat")).status).toBe(404);
  });
  it("keeps unrelated pages/APIs out of the isolated chat origin", () => {
    pilot();
    vi.stubEnv("PRIVATE_CHAT_ISOLATED", "");
    for (const path of ["/", "/zcg", "/private-chat/missing", "/api/zarvis/chat", "/api/private-chat/presence", "/api/private-chat/network-status/other", "/participate"])
      expect(proxy(new NextRequest("https://chat.example"+path)).status).toBe(404);
    for (const path of ["/private-chat","/private-chat-nym/worker.js","/logos/nym.svg", "/api/private-chat/network-status"])
      expect(proxy(new NextRequest("https://chat.example"+path)).status).toBe(200);
  });
  it("keeps network status on the canonical chat origin and disabled outside the chat", () => {
    pilot();
    const response = proxy(new NextRequest("https://chat.example/api/private-chat/network-status"));
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("content-security-policy")).toBe("default-src 'none'; frame-ancestors 'none'");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(proxy(new NextRequest("https://openzcash.org/api/private-chat/network-status")).status).toBe(404);
    vi.stubEnv("PRIVATE_CHAT_DEPLOYMENT", "");
    expect(proxy(new NextRequest("https://chat.example/api/private-chat/network-status")).status).toBe(404);
  });
  it("accepts the public Host behind a local server and ignores forged forwarding hosts", () => {
    pilot();
    expect(proxy(new NextRequest("https://localhost:4435/private-chat", {headers: {
      host: "chat.example", "x-forwarded-host": "unintended.example",
    }})).status).toBe(200);
    for (const host of ["unintended.example", "user@chat.example", "chat.example/path", "chat.example?query=1"])
      expect(proxy(new NextRequest("https://localhost:4435/private-chat", {headers: {
        host, "x-forwarded-host": "chat.example",
      }})).status).toBe(404);
    expect(proxy(new NextRequest("http://localhost:4435/private-chat", {headers: {
      host: "chat.example", "x-forwarded-proto": "https",
    }})).status).toBe(404);
  });
  it("sets a fresh CSP nonce in both the renderer request and the document response", () => {
    pilot();
    const request = new NextRequest("https://chat.example/private-chat", {headers: {
      "content-security-policy":"script-src *", "x-nonce":"attacker", "x-pathname":"/zarvis"}});
    const first = proxy(request), second = proxy(request);
    const csp = first.headers.get("content-security-policy")!;
    expect(csp).toContain("'nonce-");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("wss://gateway.example:9001");
    expect(csp).not.toContain("wss:;");
    expect(csp).not.toBe(second.headers.get("content-security-policy"));
    expect(first.headers.get("x-middleware-request-content-security-policy")).toBe(csp);
    expect(first.headers.get("x-middleware-request-x-nonce")).toBeNull();
    expect(first.headers.get("x-middleware-request-x-pathname")).toBe("/private-chat");
    expect(first.headers.get("referrer-policy")).toBe("no-referrer");
    expect(first.headers.get("cache-control")).toBe("no-store");
  });
  it("limits Railway health probes to the readiness endpoint", () => {
    pilot();
    const options = { headers: { host: "healthcheck.railway.app" } };
    expect(proxy(new NextRequest("http://localhost/healthz", options)).status).toBe(200);
    expect(proxy(new NextRequest("http://localhost/private-chat", options)).status).toBe(404);
    expect(proxy(new NextRequest("http://localhost/zcg", options)).status).toBe(404);
    expect(proxy(new NextRequest("https://unintended.example/healthz")).status).toBe(404);
  });
});
