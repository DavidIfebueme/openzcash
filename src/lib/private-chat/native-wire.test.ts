import { describe, expect, it } from "vitest";
import { base58, nativeReply, nativeSelfAddress, parseNativeFrame } from "./native-wire";
describe("pinned native Nym binary frames", () => {
  // Golden bytes transcribed from native websocket-requests serialize_reply /
  // serialize_received in nym-binaries-v2026.20-glasgow, not roundtrip-only tests.
  it("encodes an anonymous reply with a 16-byte tag, zero lane and big-endian length", () => {
    const reply = nativeReply(Uint8Array.from({length:16}, (_,i)=>i), Uint8Array.of(0xab, 0xcd, 0xef));
    expect(Buffer.from(reply).toString("hex")).toBe("02000102030405060708090a0b0c0d0e0f00000000000000000000000000000003abcdef");
    expect([...nativeSelfAddress()]).toEqual([3]);
    const padded = nativeReply(new Uint8Array(16), new Uint8Array(16_457));
    expect(padded.length).toBe(16_490);
    expect(Buffer.from(padded.subarray(25,33)).toString("hex")).toBe("0000000000004049");
    expect(() => nativeReply(new Uint8Array(15), new Uint8Array(1))).toThrow();
  });
  it("decodes tagged and untagged received frames without trusting payload addresses", () => {
    const tagged = Buffer.from("0101000102030405060708090a0b0c0d0e0f0000000000000003abcdef", "hex");
    expect(parseNativeFrame(tagged)).toEqual({ kind:"received", replyTag:Uint8Array.from({length:16},(_,i)=>i), bytes:Uint8Array.of(0xab,0xcd,0xef) });
    expect(parseNativeFrame(Buffer.from("01000000000000000003abcdef","hex"))).toEqual({kind:"received",bytes:Uint8Array.of(0xab,0xcd,0xef)});
    for (const bad of [tagged.subarray(0,-1), Buffer.concat([tagged,Buffer.from([0])]),
      Buffer.from("0102","hex"), Buffer.from("010100","hex"), new Uint8Array(65_537)]) expect(parseNativeFrame(bad)).toBeNull();
  });
  it("parses the three 32-byte public address components", () => {
    expect(base58(Uint8Array.of(0,0,1))).toBe("112");
    expect(base58(Uint8Array.of(255))).toBe("5Q");
    const frame = new Uint8Array(97); frame[0]=2;
    frame[32]=1; frame[64]=2; frame[96]=3;
    expect(parseNativeFrame(frame)).toEqual({kind:"address",address: "1".repeat(31)+"2."+"1".repeat(31)+"3@"+"1".repeat(31)+"4"});
  });
});
