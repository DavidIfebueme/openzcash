import { encodeKey } from "./keys";

/** An Ed25519 signing key and its derived X25519 box key, owned by this tab. */
export type DeviceIdentity = {
  publicKey: string;
  secretKey: Uint8Array;
  signingKey: string;
  signingSecret: Uint8Array;
};

export async function sodiumReady() {
  const sodium = (await import("libsodium-wrappers")).default;
  await sodium.ready;
  return sodium;
}

export async function createDeviceIdentity(): Promise<DeviceIdentity> {
  const sodium = await sodiumReady();
  const pair = sodium.crypto_sign_keypair();
  const secretKey = new Uint8Array(
    sodium.crypto_sign_ed25519_sk_to_curve25519(pair.privateKey),
  );
  const publicKey = encodeKey(
    sodium.crypto_sign_ed25519_pk_to_curve25519(pair.publicKey),
  );
  const signingSecret = new Uint8Array(pair.privateKey);
  const signingKey = encodeKey(pair.publicKey);
  sodium.memzero(pair.privateKey);
  sodium.memzero(pair.publicKey);
  return { publicKey, secretKey, signingKey, signingSecret };
}

export function wipeIdentity(identity: DeviceIdentity | null) {
  identity?.secretKey.fill(0);
  identity?.signingSecret.fill(0);
}
