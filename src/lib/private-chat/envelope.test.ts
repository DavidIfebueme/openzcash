import { describe, expect, it } from "vitest";
import { openEnvelope, sealEnvelope } from "./envelope";
import { createDeviceIdentity, wipeIdentity } from "./identity";
import { textMessage } from "./messages";

describe("private chat envelopes", () => {
  it("round-trips for the accepted key and drops the wrong key", async () => {
    const alice = await createDeviceIdentity();
    const bruno = await createDeviceIdentity();
    const stranger = await createDeviceIdentity();
    const message = textMessage("hello")!;
    const sealed = await sealEnvelope({
      senderSecretKey: alice.secretKey,
      senderPublicKey: alice.publicKey,
      recipientPublicKey: bruno.publicKey,
      plaintext: message,
    });
    expect(sealed).toBeInstanceOf(Uint8Array);
    expect(
      await openEnvelope({
        bytes: sealed!,
        recipientSecretKey: bruno.secretKey,
        senderPublicKey: alice.publicKey,
      }),
    ).toEqual(message);
    expect(
      await openEnvelope({
        bytes: sealed!,
        recipientSecretKey: stranger.secretKey,
        senderPublicKey: alice.publicKey,
      }),
    ).toBeNull();
    expect(
      await openEnvelope({
        bytes: sealed!,
        recipientSecretKey: bruno.secretKey,
        senderPublicKey: stranger.publicKey,
      }),
    ).toBeNull();
    const tampered = new Uint8Array(sealed!);
    tampered[tampered.length - 1] ^= 1;
    expect(
      await openEnvelope({
        bytes: tampered,
        recipientSecretKey: bruno.secretKey,
        senderPublicKey: alice.publicKey,
      }),
    ).toBeNull();
    expect(
      await sealEnvelope({
        senderSecretKey: bruno.secretKey,
        senderPublicKey: alice.publicKey,
        recipientPublicKey: bruno.publicKey,
        plaintext: message,
      }),
    ).toBeNull();
    wipeIdentity(alice);
    wipeIdentity(bruno);
    wipeIdentity(stranger);
  });
});
