import { describe, expect, it } from "vitest";
import { chatEnabled, chatOrigin, gatewayOrigin, pilotDeployment } from "./deployment";
const env = {
  NODE_ENV: "production",
  PRIVATE_CHAT_DEPLOYMENT: "pilot",
  NEXT_PUBLIC_PRIVATE_CHAT_PILOT: "true",
  PRIVATE_CHAT_ORIGIN: "https://chat.example",
  NEXT_PUBLIC_PRIVATE_CHAT_GATEWAY_ORIGIN: "wss://gateway.example:9001",
  NEXT_PUBLIC_PRIVATE_CHAT_GATEWAY_ID: "1".repeat(44),
  PRIVATE_CHAT_DIRECTORY_ADDRESS: "1".repeat(44) + "." + "2".repeat(44) + "@" + "3".repeat(44),
  PRIVATE_CHAT_DIRECTORY_PUBLIC_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
};
describe("explicit pilot deployment", () => {
  it("cannot be enabled in production with only the old preview flag", () => {
    expect(chatEnabled({ NODE_ENV: "production", NEXT_PUBLIC_PRIVATE_CHAT_PREVIEW: "true" })).toBe(false);
    expect(chatEnabled({ NODE_ENV: "production", NEXT_PUBLIC_PRIVATE_CHAT_PILOT: "true" })).toBe(false);
    expect(chatEnabled(env)).toBe(true);
    expect(pilotDeployment(env)?.directory.replyMode).toBe("surb");
  });
  it.each(["PRIVATE_CHAT_ORIGIN", "NEXT_PUBLIC_PRIVATE_CHAT_GATEWAY_ORIGIN",
    "NEXT_PUBLIC_PRIVATE_CHAT_GATEWAY_ID", "PRIVATE_CHAT_DIRECTORY_ADDRESS",
    "PRIVATE_CHAT_DIRECTORY_PUBLIC_KEY"])("fails closed without %s", (name) => {
      expect(chatEnabled({ ...env, [name]: "" })).toBe(false);
  });
  it("rejects malformed or injected origins", () => {
    for (const value of ["https://gateway.example", "wss://user:secret@gateway.example",
      "wss://gateway.example/path", "wss://gateway.example#fragment",
      "wss://gateway.example; script-src *", "wss://gateway.example?query"]) {
      expect(gatewayOrigin(value)).toBeNull();
    }
    expect(chatOrigin("http://chat.example")).toBeNull();
    expect(chatOrigin("https://chat.example/path")).toBeNull();
  });
});
