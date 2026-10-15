import { decodeKey, encodeKey, isPublicKey } from "./keys";
import { sodiumReady, type DeviceIdentity } from "./identity";
import { isNymAddress } from "./nym-address";
import { normalizeAlias } from "./session";
import { messageId, isMessageId } from "./messages";

export const INVITE_TTL_MS = 5 * 60_000;
const PREFIX = "ozchat3.";
export type LiveInvite = {
  v: 3;
  id: string;
  alias: string;
  publicKey: string;
  address: string;
  createdAt: number;
  expiresAt: number;
  signingKey: string;
  signature: string;
};
export function decodeBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const bytes = Uint8Array.from(
      atob(value.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
    return encodeKey(bytes) === value ? bytes : null;
  } catch {
    return null;
  }
}
function unsigned(invite: Omit<LiveInvite, "signature">) {
  return JSON.stringify({
    v: 3,
    id: invite.id,
    alias: invite.alias,
    publicKey: invite.publicKey,
    address: invite.address,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    signingKey: invite.signingKey,
  });
}
export function inviteToken(invite: LiveInvite) {
  return (
    PREFIX +
    encodeKey(
      new TextEncoder().encode(
        JSON.stringify({
          ...JSON.parse(unsigned(invite)),
          signature: invite.signature,
        }),
      ),
    )
  );
}
export async function sign(identity: DeviceIdentity, value: string) {
  return encodeKey(
    (await sodiumReady()).crypto_sign_detached(value, identity.signingSecret),
  );
}
export async function verifySignature(
  key: string,
  value: string,
  signature: string,
) {
  const publicKey = decodeKey(key),
    bytes = decodeBytes(signature);
  if (!publicKey || bytes?.length !== 64) return false;
  try {
    return (await sodiumReady()).crypto_sign_verify_detached(
      bytes,
      value,
      publicKey,
    );
  } catch {
    return false;
  }
}
export async function createLiveInvite(
  identity: DeviceIdentity,
  alias: string,
  address: string,
  now = Date.now(),
): Promise<LiveInvite> {
  if (normalizeAlias(alias) !== alias || !isNymAddress(address))
    throw new Error("Invalid invitation");
  const body = {
    v: 3 as const,
    id: messageId(),
    alias,
    publicKey: identity.publicKey,
    address,
    createdAt: now,
    expiresAt: now + INVITE_TTL_MS,
    signingKey: identity.signingKey,
  };
  return { ...body, signature: await sign(identity, unsigned(body)) };
}
export function parseLiveInvite(value: string): LiveInvite | null {
  let token = value.trim();
  if (!token.startsWith(PREFIX)) {
    try {
      token =
        new URLSearchParams(new URL(token).hash.slice(1)).get("invite") || "";
    } catch {
      return null;
    }
  }
  if (!token.startsWith(PREFIX) || token.length > 1800) return null;
  const bytes = decodeBytes(token.slice(PREFIX.length));
  if (!bytes) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(bytes));
    if (
      !p ||
      Object.keys(p).sort().join(",") !==
        "address,alias,createdAt,expiresAt,id,publicKey,signature,signingKey,v" ||
      p.v !== 3 ||
      typeof p.id !== "string" ||
      !isMessageId(p.id) ||
      typeof p.alias !== "string" ||
      normalizeAlias(p.alias) !== p.alias ||
      typeof p.address !== "string" ||
      !isNymAddress(p.address) ||
      typeof p.publicKey !== "string" ||
      !isPublicKey(p.publicKey) ||
      typeof p.signingKey !== "string" ||
      !isPublicKey(p.signingKey) ||
      typeof p.signature !== "string" ||
      decodeBytes(p.signature)?.length !== 64 ||
      !Number.isSafeInteger(p.createdAt) ||
      !Number.isSafeInteger(p.expiresAt) ||
      p.expiresAt - p.createdAt !== INVITE_TTL_MS ||
      p.createdAt < 0
    )
      return null;
    return inviteToken(p) === token ? p : null;
  } catch {
    return null;
  }
}
export async function verifyLiveInvite(invite: LiveInvite, now = Date.now()) {
  if (invite.expiresAt <= now || invite.createdAt > now + 30_000) return false;
  if (
    !(await verifySignature(
      invite.signingKey,
      unsigned(invite),
      invite.signature,
    ))
  )
    return false;
  try {
    const sodium = await sodiumReady();
    return (
      encodeKey(
        sodium.crypto_sign_ed25519_pk_to_curve25519(
          decodeKey(invite.signingKey)!,
        ),
      ) === invite.publicKey
    );
  } catch {
    return false;
  }
}
export function liveInviteUrl(origin: string, invite: LiveInvite) {
  return `${origin}/private-chat#invite=${inviteToken(invite)}`;
}
