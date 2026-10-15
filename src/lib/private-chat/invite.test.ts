import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createDeviceIdentity, wipeIdentity } from "./identity";
import { createInvite, inviteUrl, parseInvite, safetyCode } from "./invite";
import { encodeKey } from "./keys";
import { isNymAddress } from "./nym-address";

const MIXNET =
  "DguTcdkWWtDyUFLvQxRdcA8qZhardhE1ZXy1YCC7Zfmq.Dxreouj5RhQqMb3ZaAxgXFdGkmfbDKwk457FdeHGKmQQ@4kjgWmFU1tcGAZYRZR57yFuVAexjLbJ5M7jvo3X5Hkcf";

describe("private chat invites", () => {
  it("shares an alias and public key, never the device secret", async () => {
    const identity = await createDeviceIdentity();
    const token = createInvite({
      alias: "  Alice   Z ",
      publicKey: identity.publicKey,
    });
    expect(token).toMatch(/^ozchat1\./);
    expect(parseInvite(token!)).toEqual({
      version: 1,
      alias: "Alice Z",
      publicKey: identity.publicKey,
      nymAddress: null,
    });
    expect(token).not.toContain(encodeKey(identity.secretKey));
    expect(token).not.toContain("secret");
    const url = inviteUrl("http://127.0.0.1:4430/", token!);
    expect(url).toBe(
      `http://127.0.0.1:4430/private-chat#invite=${encodeURIComponent(token!)}`,
    );
    expect(parseInvite(url!)).toEqual(parseInvite(token!));
    expect(
      parseInvite(
        `http://127.0.0.1:4430/private-chat?invite=${encodeURIComponent(token!)}`,
      )?.alias,
    ).toBe("Alice Z");
    wipeIdentity(identity);
    expect(identity.secretKey.every((byte) => byte === 0)).toBe(true);
  });

  it("rejects secrets, extra fields, self-checks and tampering", async () => {
    const identity = await createDeviceIdentity();
    const other = await createDeviceIdentity();
    expect(
      createInvite({ alias: "a", publicKey: identity.publicKey }),
    ).toBeNull();
    const token = createInvite({
      alias: "Alice",
      publicKey: identity.publicKey,
    })!;
    const forged = `ozchat1.${encodeKey(new TextEncoder().encode(JSON.stringify({ v: 1, a: "Alice", p: identity.publicKey, sk: "nope" })))}`;
    expect(parseInvite(forged)).toBeNull();
    expect(parseInvite(token.slice(0, -2))).toBeNull();
    expect(parseInvite("https://example.com/private-chat")).toBeNull();
    const code = await safetyCode(identity.publicKey, other.publicKey);
    expect(code).toMatch(/^(?:\d{4} ){4}\d{4}$/);
    expect(await safetyCode(other.publicKey, identity.publicKey)).toBe(code);
    expect(await safetyCode(identity.publicKey, identity.publicKey)).toBeNull();
    wipeIdentity(identity);
    wipeIdentity(other);
  });

  it("carries a mixnet address only in a canonical version 2 invite", async () => {
    const identity = await createDeviceIdentity();
    expect(isNymAddress(MIXNET)).toBe(true);
    expect(isNymAddress("identity@gateway")).toBe(false);
    expect(
      createInvite({
        alias: "Alice",
        publicKey: identity.publicKey,
        nymAddress: "not an address",
      }),
    ).toBeNull();
    const token = createInvite({
      alias: "Alice",
      publicKey: identity.publicKey,
      nymAddress: MIXNET,
    })!;
    expect(parseInvite(token)).toEqual({
      version: 2,
      alias: "Alice",
      publicKey: identity.publicKey,
      nymAddress: MIXNET,
    });
    expect(token).not.toContain(encodeKey(identity.secretKey));
    const forged = `ozchat1.${encodeKey(
      new TextEncoder().encode(
        JSON.stringify({
          v: 2,
          a: "Alice",
          n: MIXNET,
          p: identity.publicKey,
          sk: "nope",
        }),
      ),
    )}`;
    expect(parseInvite(forged)).toBeNull();
    const worker = readFileSync(
      new URL("../../../scripts/private-chat-nym-worker.js", import.meta.url),
      "utf8",
    );
    const pattern =
      "[1-9A-HJ-NP-Za-km-z]{20,200}(?:\\.[1-9A-HJ-NP-Za-km-z]{20,200})?@[1-9A-HJ-NP-Za-km-z]{20,200}";
    expect(worker).toContain(pattern);
    wipeIdentity(identity);
  });
});
