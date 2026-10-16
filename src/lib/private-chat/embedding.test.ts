import { describe, expect, it } from "vitest";
import { chatParentOrigin, embeddedInvitation, CHAT_INVITATION_MESSAGE } from "./embedding";

describe("portal invitation boundary", () => {
  const parent = {} as Window;
  const data = { type: CHAT_INVITATION_MESSAGE, kind: "invite", token: "test-invite" };
  const valid = { origin: "https://openzcash.org", source: parent, data };
  it("pins the production parent independently of supplied environment values", () => {
    expect(chatParentOrigin({ NODE_ENV: "production", PRIVATE_CHAT_PARENT_ORIGIN: "https://evil.example" })).toBe("https://openzcash.org");
    expect(chatParentOrigin({ NODE_ENV: "development" })).toBe("http://127.0.0.1:4432");
  });
  it("accepts only bounded invitations from the exact parent window and origin", () => {
    expect(embeddedInvitation(valid, parent, valid.origin)).toEqual({ kind: "invite", token: "test-invite" });
    for (const event of [
      { ...valid, origin: "https://openzcash.org.evil.example" },
      { ...valid, source: {} as Window },
      { ...valid, data: null },
      { ...valid, data: { ...data, kind: "connect" } },
      { ...valid, data: { ...data, type: "send-message" } },
      { ...valid, data: { ...data, token: "" } },
      { ...valid, data: { ...data, token: "x".repeat(4097) } },
      { ...valid, data: { ...data, alias: "injected" } },
    ]) expect(embeddedInvitation(event, parent, valid.origin)).toBeNull();
  });
});
