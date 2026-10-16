import { describe, expect, it } from "vitest";
import { createDeviceIdentity, wipeIdentity } from "./identity";
import { encodeKey } from "./keys";
import {
  createLiveInvite,
  parseLiveInvite,
  verifyLiveInvite,
  inviteToken,
  liveInviteUrl,
  INVITE_TTL_MS,
  decodeBytes,
} from "./live-invite";
const address =
  "DguTcdkWWtDyUFLvQxRdcA8qZhardhE1ZXy1YCC7Zfmq.Dxreouj5RhQqMb3ZaAxgXFdGkmfbDKwk457FdeHGKmQQ@4kjgWmFU1tcGAZYRZR57yFuVAexjLbJ5M7jvo3X5Hkcf";
describe("signed, expiring chat invites", () => {
  it("binds expiry, alias, Nym address and encryption key to the issuer", async () => {
    const identity = await createDeviceIdentity();
    const invite = await createLiveInvite(identity, "Alice", address, 100_000);
    expect(
      parseLiveInvite(liveInviteUrl("http://localhost:4430", invite)),
    ).toEqual(invite);
    expect(await verifyLiveInvite(invite, 100_001)).toBe(true);
    for (const altered of [
      { ...invite, alias: "Mallory" },
      { ...invite, address: address.replace(/^D/, "E") },
      { ...invite, createdAt: 200_000, expiresAt: 200_000 + INVITE_TTL_MS },
    ]) {
      expect(await verifyLiveInvite(altered, 200_001)).toBe(false);
    }
    expect(await verifyLiveInvite(invite, invite.expiresAt)).toBe(false);
    expect(await verifyLiveInvite(invite, 10_000)).toBe(false);
    expect(parseLiveInvite(inviteToken(invite) + "junk")).toBeNull();
    expect(parseLiveInvite("ozchat1.invalid")).toBeNull();
    wipeIdentity(identity);
    expect(identity.signingSecret.every((byte) => byte === 0)).toBe(true);
  });
});

describe("compact invite links", () => {
  it("reduces standard invite tokens by over 40% and retains the original signed fields", async () => {
    const identity = await createDeviceIdentity();
    const invite = await createLiveInvite(identity, "Alice", address, 1792100000000);
    const legacy = "ozchat3." + encodeKey(new TextEncoder().encode(JSON.stringify(invite)));
    const compact = inviteToken(invite);
    expect(compact.startsWith("ozc3.")).toBe(true);
    expect(compact.length).toBeLessThan(legacy.length * 0.6);
    expect(parseLiveInvite(compact)).toEqual(invite);
    expect(parseLiveInvite(legacy)).toEqual(invite);
    expect(await verifyLiveInvite(parseLiveInvite(compact)!, invite.createdAt)).toBe(true);
    wipeIdentity(identity);
  });

  it("preserves Unicode aliases, both Nym address forms and legacy-compatible lengths", async () => {
    const identity = await createDeviceIdentity();
    for (const alias of ["João", "隐私聊天", "A".repeat(24)]) {
      for (const route of [address, address.replace(/\.[^@]+/, ""), `${"1".repeat(20)}@${"2".repeat(20)}`, `${"1".repeat(32)}@${"2".repeat(32)}`]) {
        const invite = await createLiveInvite(identity, alias, route, 100001);
        expect(parseLiveInvite(inviteToken(invite))).toEqual(invite);
      }
    }
    wipeIdentity(identity);
  });

  it("rejects truncation, trailing bytes and oversized inputs", async () => {
    const identity = await createDeviceIdentity();
    const invite = await createLiveInvite(identity, "Alice", address, 100001);
    const bytes = decodeBytes(inviteToken(invite).slice(5))!;
    for (let length = 0; length < bytes.length; length++)
      expect(parseLiveInvite("ozc3." + encodeKey(bytes.subarray(0, length)))).toBeNull();
    expect(parseLiveInvite("ozc3." + encodeKey(new Uint8Array([...bytes, 0])))).toBeNull();
    expect(parseLiveInvite("ozc3." + "A".repeat(2200))).toBeNull();
    wipeIdentity(identity);
  });

  it("does not authenticate a changed compact byte", async () => {
    const identity = await createDeviceIdentity();
    const invite = await createLiveInvite(identity, "Alice", address, 100001);
    const bytes = decodeBytes(inviteToken(invite).slice(5))!;
    for (let offset = 0; offset < bytes.length; offset++) {
      const altered = bytes.slice();
      altered[offset] ^= 1;
      const parsed = parseLiveInvite("ozc3." + encodeKey(altered));
      if (parsed) expect(await verifyLiveInvite(parsed, 100002)).toBe(false);
    }
    wipeIdentity(identity);
  });
});
