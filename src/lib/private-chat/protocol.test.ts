import { describe, expect, it } from "vitest";
import { readPacket } from "./protocol";
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
