import { describe, expect, it } from "vitest";
import {
  ackFor,
  decideIncoming,
  decodePlaintext,
  encodePlaintext,
  textMessage,
} from "./messages";

describe("private chat messages", () => {
  it("accepts a message once and confirms it with an ack", () => {
    const message = textMessage("  hello  ");
    expect(message).toMatchObject({ v: 1, t: "m", body: "hello" });
    const seen = new Set<string>();
    const first = decideIncoming(message!, seen);
    expect(first.type).toBe("message");
    if (first.type !== "message") return;
    seen.add(first.id);
    seen.add(first.ack.id);
    expect(decideIncoming(message!, seen).type).toBe("ignore");
    const ack = decideIncoming(first.ack, seen);
    expect(ack).toEqual({ type: "ignore" });
    seen.delete(first.ack.id);
    expect(decideIncoming(first.ack, seen)).toEqual({
      type: "ack",
      id: first.ack.id,
      ref: message!.id,
    });
  });

  it("rejects empty, oversized, control, and extra fields", () => {
    expect(textMessage(" ")).toBeNull();
    expect(textMessage("a".repeat(401))).toBeNull();
    expect(textMessage("bad\u0000text")).toBeNull();
    expect(ackFor("short")).toBeNull();
    const bytes = new TextEncoder().encode(
      JSON.stringify({ v: 1, t: "m", id: "abcdefgh", body: "hi", extra: true }),
    );
    expect(decodePlaintext(bytes)).toBeNull();
  });

  it("carries an introduction only when the alias and mixnet address are both valid", () => {
    const message = textMessage("hello")!;
    const address =
      "DguTcdkWWtDyUFLvQxRdcA8qZhardhE1ZXy1YCC7Zfmq.Dxreouj5RhQqMb3ZaAxgXFdGkmfbDKwk457FdeHGKmQQ@4kjgWmFU1tcGAZYRZR57yFuVAexjLbJ5M7jvo3X5Hkcf";
    const introduced = {
      ...message,
      alias: "Bruno",
      nymAddress: address,
    };
    const encoded = encodePlaintext(introduced);
    expect(encoded).toContain('"a":"Bruno"');
    expect(decodePlaintext(new TextEncoder().encode(encoded!))).toEqual(
      introduced,
    );
    expect(encodePlaintext({ ...message, alias: "Bruno" })).toBeNull();
    expect(
      encodePlaintext({ ...message, alias: "bad alias!", nymAddress: address }),
    ).toBeNull();
    const decision = decideIncoming(introduced, new Set());
    expect(decision).toMatchObject({
      type: "message",
      intro: { alias: "Bruno", nymAddress: address },
    });
  });
});
