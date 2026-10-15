import { afterEach, describe, expect, it } from "vitest";
import { ConversationRatchet, isRatchetBundle, isRatchetMessage } from "./ratchet";
import { createDeviceIdentity, wipeIdentity, type DeviceIdentity } from "./identity";

const states: ConversationRatchet[] = [];
const identities: DeviceIdentity[] = [];
afterEach(() => {
  states.splice(0).forEach(state => state.close());
  identities.splice(0).forEach(wipeIdentity);
});
async function identity() {
  const value = await createDeviceIdentity();
  identities.push(value);
  return value;
}
async function state(conversation: string, own: string, peer: string) {
  const result = await ConversationRatchet.create(conversation, own, peer);
  states.push(result);
  return result;
}
async function pair(otherConversation = "conversation_01", peerOwnKey?: string) {
  const alice = await identity(), bob = await identity();
  const a = await state("conversation_01", alice.publicKey, bob.publicKey);
  const b = await state(otherConversation, peerOwnKey ?? bob.publicKey, alice.publicKey);
  await a.setPeer(b.bundle, true);
  await b.setPeer(a.bundle, false);
  return { a, b, alice, bob };
}

describe("maintained Olm ratchet over authenticated Nym envelopes", () => {
  it("creates fresh conversation keys and exchanges messages in both directions", async () => {
    const { a, b } = await pair();
    expect(isRatchetBundle(a.bundle)).toBe(true);
    expect(a.bundle.userId).not.toBe(b.bundle.userId);
    const first = await a.encrypt("hello");
    expect(isRatchetMessage(first)).toBe(true);
    expect(JSON.stringify(first)).not.toContain("hello");
    expect(await b.decrypt(first!)).toBe("hello");
    const reply = await b.encrypt("reply");
    expect(await a.decrypt(reply!)).toBe("reply");
    const second = await a.encrypt("hello");
    expect(second).not.toEqual(first);
    expect(await b.decrypt(second!)).toBe("hello");
  });

  it("rejects replay including changing the unauthenticated Matrix transaction id", async () => {
    const { a, b } = await pair();
    const message = await a.encrypt("single delivery");
    expect(await b.decrypt(message!)).toBe("single delivery");
    expect(await b.decrypt(message!)).toBeNull();
    const modified = structuredClone(message!);
    modified["org.matrix.msgid"] = "changed";
    expect(await b.decrypt(modified)).toBeNull();
  });

  it("receives out of order messages within the upstream skipped-key window", async () => {
    const { a, b } = await pair();
    const initial = await a.encrypt("start");
    expect(await b.decrypt(initial!)).toBe("start");
    const reply = await b.encrypt("ready");
    expect(await a.decrypt(reply!)).toBe("ready");
    const messages = [];
    for (let i = 0; i < 6; i++) messages.push(await a.encrypt(`message ${i}`));
    for (const i of [5, 2, 0, 4, 1, 3]) expect(await b.decrypt(messages[i]!)).toBe(`message ${i}`);
  });

  it("does not retain skipped keys beyond upstream's bounded 40-key receive chain", async () => {
    const { a, b } = await pair();
    expect(await b.decrypt((await a.encrypt("start"))!)).toBe("start");
    expect(await a.decrypt((await b.encrypt("ready"))!)).toBe("ready");
    const messages = [];
    for (let i = 0; i < 43; i++) messages.push(await a.encrypt(`message ${i}`));
    expect(await b.decrypt(messages[42]!)).toBe("message 42");
    expect(await b.decrypt(messages[0]!)).toBeNull();
    expect(await b.decrypt(messages[3]!)).toBe("message 3");
  });

  it("rejects unrelated peers, ciphertext corruption, and allows the authentic message afterward", async () => {
    const { a, b, alice } = await pair();
    const mallory = await identity();
    const m = await state("conversation_01", mallory.publicKey, alice.publicKey);
    await m.setPeer(a.bundle, true);
    expect(await a.decrypt((await m.encrypt("forged peer"))!)).toBeNull();
    const original = await a.encrypt("authentic");
    const corrupted = structuredClone(original!);
    const encrypted = Object.values(corrupted.ciphertext)[0];
    encrypted.body = encrypted.body.slice(0, -8) + "AAAAAAAA";
    expect(await b.decrypt(corrupted)).toBeNull();
    expect(await b.decrypt(original!)).toBe("authentic");
  });

  it("binds the conversation id and both outer authenticated identities", async () => {
    const { a, b } = await pair("conversation_02");
    expect(await b.decrypt((await a.encrypt("wrong conversation"))!)).toBeNull();
    const other = await identity();
    const mismatched = await pair("conversation_01", other.publicKey);
    expect(await mismatched.b.decrypt((await mismatched.a.encrypt("wrong identity binding"))!)).toBeNull();
  });

  it("verifies device and one-time key signatures and refuses peer replacement", async () => {
    const alice = await identity(), bob = await identity(), charlie = await identity();
    const a = await state("conversation_01", alice.publicKey, bob.publicKey);
    const b = await state("conversation_01", bob.publicKey, alice.publicKey);
    const changed = b.bundle;
    changed.deviceKeys.keys["curve25519:CHAT"] = "A".repeat(43);
    expect(isRatchetBundle(changed)).toBe(true);
    await expect(a.setPeer(changed, true)).rejects.toThrow();
    await a.setPeer(b.bundle, true);
    await a.setPeer(b.bundle, true);
    const c = await state("conversation_01", charlie.publicKey, alice.publicKey);
    await expect(a.setPeer(c.bundle, true)).rejects.toThrow("cannot change");
    const badOtk = b.bundle;
    Object.values(badOtk.oneTimeKey)[0].key = "A".repeat(43);
    const fresh = await state("conversation_01", alice.publicKey, bob.publicKey);
    await expect(fresh.setPeer(badOtk, true)).rejects.toThrow();
  });

  it("rejects oversize, extra fields, unready and closed sessions", async () => {
    const { a, b } = await pair();
    expect(isRatchetBundle({ ...a.bundle, unexpected: true })).toBe(false);
    const encrypted = await a.encrypt("before close");
    expect(isRatchetMessage({ ...encrypted, unexpected: true })).toBe(false);
    expect(await a.encrypt("x".repeat(3073))).toBeNull();
    a.close();
    expect(await a.encrypt("after close")).toBeNull();
    expect(await a.decrypt((await b.encrypt("after close"))!)).toBeNull();
    await expect(a.setPeer(b.bundle, true)).rejects.toThrow();
    const identityA = await identity(), identityB = await identity();
    const noPeer = await state("conversation_01", identityA.publicKey, identityB.publicKey);
    expect(await noPeer.encrypt("not accepted")).toBeNull();
  });

  it("cannot decrypt a captured conversation with a fresh ratchet, even with the same outer identities", async () => {
    const { a, b, alice, bob } = await pair();
    const message = await a.encrypt("past message");
    expect(await b.decrypt(message!)).toBe("past message");
    const replacement = await state("conversation_01", bob.publicKey, alice.publicKey);
    await replacement.setPeer(a.bundle, false);
    expect(await replacement.decrypt(message!)).toBeNull();
  });
});
