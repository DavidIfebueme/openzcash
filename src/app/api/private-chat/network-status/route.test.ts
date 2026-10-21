import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/lib/private-chat/network-health-server", () => ({ readNetworkHealth: vi.fn(async () => ({ checkedAt: 1 })) }));
import { readNetworkHealth } from "@/lib/private-chat/network-health-server";
import { GET } from "./route";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it("exposes only public status when the chat is enabled, without accepting request data", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("NEXT_PUBLIC_PRIVATE_CHAT_PREVIEW", "false");
  expect((await GET(new Request("https://chat.example/api/private-chat/network-status"))).status).toBe(404);
  vi.stubEnv("NEXT_PUBLIC_PRIVATE_CHAT_PREVIEW", "true");
  expect((await GET(new Request("https://chat.example/api/private-chat/network-status?invite=private"))).status).toBe(400);
  expect(readNetworkHealth).not.toHaveBeenCalled();
  const result = await GET(new Request("https://chat.example/api/private-chat/network-status", { headers: { cookie: "private", "x-forwarded-for": "192.0.2.5" } }));
  expect(result.status).toBe(200);
  expect(result.headers.get("cache-control")).toBe("no-store");
  expect(result.headers.get("referrer-policy")).toBe("no-referrer");
  expect(result.headers.get("cross-origin-resource-policy")).toBe("same-origin");
  expect(readNetworkHealth).toHaveBeenCalledWith(process.env.NEXT_PUBLIC_PRIVATE_CHAT_GATEWAY_ID);
});
