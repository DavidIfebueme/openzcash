import { sodiumReady } from "./identity";
import { decodeKey, encodeKey } from "./keys";

const PREFIX = "ozroom2.";
export type DiscoveryRoom = {
  id: string;
  key: Uint8Array;
  authSecret: Uint8Array;
  token: string;
};
export async function signRoomOperation(
  secret: Uint8Array,
  value: string,
): Promise<string> {
  if (secret.length !== 64 || secret.every((byte) => byte === 0))
    throw new Error("Room authorization unavailable");
  const copy = new Uint8Array(secret);
  try {
    return encodeKey((await sodiumReady()).crypto_sign_detached(value, copy));
  } finally {
    copy.fill(0);
  }
}
/** The fragment stays local. Independent keys authorize room operations and seal invitations. */
export async function openRoom(value?: string): Promise<DiscoveryRoom | null> {
  let token = value?.trim();
  if (token && !token.startsWith(PREFIX)) {
    try {
      token =
        new URLSearchParams(new URL(token).hash.slice(1)).get("room") || "";
    } catch {
      return null;
    }
  }
  const secret =
    value === undefined
      ? crypto.getRandomValues(new Uint8Array(32))
      : token?.startsWith(PREFIX)
        ? decodeKey(token.slice(PREFIX.length))
        : null;
  if (!secret) return null;
  try {
    const sodium = await sodiumReady();
    const signingSeed = sodium.crypto_generichash(
      32,
      "OpenZcash Discover signing seed v2",
      secret,
    );
    const pair = sodium.crypto_sign_seed_keypair(signingSeed);
    const room = {
      id: encodeKey(pair.publicKey),
      key: sodium.crypto_generichash(
        32,
        "OpenZcash Discover encryption v2",
        secret,
      ),
      authSecret: new Uint8Array(pair.privateKey),
      token: PREFIX + encodeKey(secret),
    };
    signingSeed.fill(0);
    pair.privateKey.fill(0);
    return room;
  } finally {
    secret.fill(0);
  }
}
export function roomUrl(origin: string, token: string) {
  return `${origin}/private-chat#room=${token}`;
}
