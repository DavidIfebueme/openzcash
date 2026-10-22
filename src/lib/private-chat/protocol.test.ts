import { describe, expect, it } from "vitest";
import { readPacket, REACTIONS } from "./protocol";
import { ConversationRatchet } from "./ratchet";
import { encodeKey } from "./keys";
const engine = await ConversationRatchet.create("request_123", encodeKey(new Uint8Array(32).fill(1)), encodeKey(new Uint8Array(32).fill(2)));
const bundle = engine.bundle;
engine.close();

const request = {
  v: 3,
  t: "request",
  id: "request_123",
  inviteId: "invite_123",
  expiresAt: 200_000,
  alias: "Alice",
  address: "DguTcdkWWtDyUFLvQxRdcA8qZhardhE1ZXy1YCC7Zfmq.Dxreouj5RhQqMb3ZaAxgXFdGkmfbDKwk457FdeHGKmQQ@4kjgWmFU1tcGAZYRZR57yFuVAexjLbJ5M7jvo3X5Hkcf",
  sequence: 1,
  ratchet: bundle,
} as const;

describe("unpublished pilot request wire shape", () => {
  it("requires a positive route sequence for every v3 request", () => {
    expect(readPacket(request)).toEqual(request);
    expect(readPacket({ ...request, v: 2 })).toBeNull();
    expect(readPacket({ ...request, ratchet: undefined })).toBeNull();
    expect(readPacket({ ...request, sequence: 2 })).not.toBeNull();
    expect(readPacket({ ...request, sequence: 0 })).toBeNull();
    expect(readPacket({ ...request, sequence: -1 })).toBeNull();
  });

  it("rejects the older unsequenced preview shape instead of silently accepting it", () => {
    const oldPreview: Record<string, unknown> = { ...request };
    delete oldPreview.sequence;
    expect(readPacket(oldPreview)).toBeNull();
    expect(readPacket({ ...request, unexpected: true })).toBeNull();
  });
});

describe("replies and reactions", () => {
  const text = { v: 3, t: "text", id: "message_001", c: "conversation_1", body: "hello" } as const;
  it("accepts an optional reply reference on text and rejects malformed ones", () => {
    expect(readPacket(text)).toEqual(text);
    expect(readPacket({ ...text, re: "message_000" })).toEqual({ ...text, re: "message_000" });
    expect(readPacket({ ...text, re: "" })).toBeNull();
    expect(readPacket({ ...text, re: "bad id!" })).toBeNull();
    expect(readPacket({ ...text, re: "message_000", extra: 1 })).toBeNull();
  });
  it("accepts only the fixed reaction set, or an empty emoji to remove one", () => {
    const react = { v: 3, t: "react", id: "reaction_01", c: "conversation_1", ref: "message_001" } as const;
    for (const emoji of REACTIONS) expect(readPacket({ ...react, emoji })).toEqual({ ...react, emoji });
    expect(readPacket({ ...react, emoji: "" })).toEqual({ ...react, emoji: "" });
    expect(readPacket({ ...react, emoji: "🦓" })).toBeNull();
    expect(readPacket({ ...react, emoji: "👍👍" })).toBeNull();
    expect(readPacket({ ...react, emoji: "👍", body: "x" })).toBeNull();
    expect(readPacket({ v: 3, t: "react", id: "reaction_01", c: "conversation_1", emoji: "👍" })).toBeNull();
  });
});
