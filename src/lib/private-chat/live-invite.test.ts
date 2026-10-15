import { describe, expect, it } from "vitest";
import { createDeviceIdentity, wipeIdentity } from "./identity";
import {
  createLiveInvite,
  parseLiveInvite,
  verifyLiveInvite,
  inviteToken,
  liveInviteUrl,
  INVITE_TTL_MS,
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
