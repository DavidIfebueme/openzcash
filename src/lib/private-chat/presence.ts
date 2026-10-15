import { sodiumReady, type DeviceIdentity } from "./identity";
import {
  decodeBytes,
  inviteToken,
  parseLiveInvite,
  sign,
  verifyLiveInvite,
  verifySignature,
  type LiveInvite,
} from "./live-invite";
import { encodeKey, isPublicKey } from "./keys";
import { signRoomOperation, type DiscoveryRoom } from "./discovery-room";
export const PRESENCE_LEASE_MS = 120_000;
export const PRESENCE_HEARTBEAT_MS = 30_000;
const PADDED_BYTES = 1408;
const SEALED_BYTES = PADDED_BYTES + 40;
const SEALED_LENGTH = Math.ceil((SEALED_BYTES * 4) / 3);
export type PresenceCommand = {
  op: "upsert" | "remove";
  room: string;
  owner: string;
  sealed: string;
  expiresAt: number;
  revision: number;
  grant: string;
  signature: string;
  roomProof: string;
};
export type PresenceEntry = PresenceCommand & { onlineUntil: number };
function metadata(p: Omit<PresenceCommand, "signature" | "roomProof">) {
  return {
    op: p.op,
    room: p.room,
    owner: p.owner,
    expiresAt: p.expiresAt,
    revision: p.revision,
    grant: p.grant,
  };
}
export function roomGrantBody(p: {
  room: string;
  owner: string;
  inviteId: string;
  expiresAt: number;
}) {
  return JSON.stringify({
    room: p.room,
    owner: p.owner,
    inviteId: p.inviteId,
    expiresAt: p.expiresAt,
  });
}
export function presenceBody(
  p: Omit<PresenceCommand, "signature" | "roomProof">,
) {
  return JSON.stringify({ ...metadata(p), sealed: p.sealed });
}
export function presenceRoomBody(p: Omit<PresenceCommand, "roomProof">) {
  return JSON.stringify({ ...metadata(p), sealed: p.sealed, signature: p.signature });
}
export function isPresenceCommand(value: unknown): value is PresenceCommand {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const c = value as PresenceCommand;
  return (
    Object.keys(c).sort().join(",") ===
      "expiresAt,grant,op,owner,revision,room,roomProof,sealed,signature" &&
    ["upsert", "remove"].includes(c.op) &&
    typeof c.room === "string" &&
    isPublicKey(c.room) &&
    typeof c.owner === "string" &&
    isPublicKey(c.owner) &&
    typeof c.sealed === "string" &&
    (c.op === "remove"
      ? c.sealed === ""
      : c.sealed.length === SEALED_LENGTH &&
        decodeBytes(c.sealed)?.length === SEALED_BYTES) &&
    typeof c.grant === "string" &&
    (c.op === "remove"
      ? c.grant === ""
      : decodeBytes(c.grant)?.length === 64) &&
    typeof c.signature === "string" &&
    decodeBytes(c.signature)?.length === 64 &&
    typeof c.roomProof === "string" &&
    decodeBytes(c.roomProof)?.length === 64 &&
    Number.isSafeInteger(c.expiresAt) &&
    Number.isSafeInteger(c.revision) &&
    c.revision > 0
  );
}
export async function presenceCommand(
  identity: DeviceIdentity,
  room: DiscoveryRoom,
  invite: LiveInvite,
  op: PresenceCommand["op"],
  revision: number,
  issuer?: DeviceIdentity,
): Promise<PresenceCommand> {
  if (op === "upsert" && (!issuer || issuer.signingKey !== invite.signingKey))
    throw new Error("Invite issuer authorization required");
  const authSecret = new Uint8Array(room.authSecret);
  try {
  const body = {
    op,
    room: room.id,
    owner: identity.signingKey,
    sealed: "",
    expiresAt: invite.expiresAt,
    revision,
    grant:
      op === "upsert"
        ? await sign(
            issuer!,
            roomGrantBody({
              room: room.id,
              owner: identity.signingKey,
              inviteId: invite.id,
              expiresAt: invite.expiresAt,
            }),
          )
        : "",
  };
  if (op === "upsert") {
    const sodium = await sodiumReady();
    const padded = new Uint8Array(PADDED_BYTES);
    const payload = new TextEncoder().encode(inviteToken(invite));
    if (payload.length > PADDED_BYTES - 2) throw new Error("Invite too large");
    new DataView(padded.buffer).setUint16(0, payload.length);
    padded.set(payload, 2);
    const nonce = crypto.getRandomValues(new Uint8Array(24));
    try {
      const cipher = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
        padded,
        JSON.stringify(metadata(body)),
        null,
        nonce,
        room.key,
      );
      const sealed = new Uint8Array(nonce.length + cipher.length);
      sealed.set(nonce);
      sealed.set(cipher, nonce.length);
      body.sealed = encodeKey(sealed);
    } finally {
      padded.fill(0);
      payload.fill(0);
    }
  }
  const signed = {
    ...body,
    signature: await sign(identity, presenceBody(body)),
  };
  return {
    ...signed,
    roomProof: await signRoomOperation(
      authSecret,
      presenceRoomBody(signed),
    ),
  };
  } finally {
    authSecret.fill(0);
  }
}
export async function openPresence(
  room: DiscoveryRoom,
  entry: PresenceEntry,
  now: number,
): Promise<LiveInvite | null> {
  const { onlineUntil, ...command } = entry;
  if (
    !isPresenceCommand(command) ||
    command.op !== "upsert" ||
    command.room !== room.id ||
    !Number.isSafeInteger(onlineUntil) ||
    onlineUntil <= now ||
    command.expiresAt <= now ||
    !(await verifySignature(
      command.owner,
      presenceBody(command),
      command.signature,
    )) ||
    !(await verifySignature(
      command.room,
      presenceRoomBody(command),
      command.roomProof,
    ))
  )
    return null;
  let padded: Uint8Array | undefined;
  try {
    const sodium = await sodiumReady(),
      sealed = decodeBytes(command.sealed)!;
    padded = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      sealed.slice(24),
      JSON.stringify(metadata(command)),
      sealed.slice(0, 24),
      room.key,
    );
    const length = new DataView(
      padded.buffer,
      padded.byteOffset,
      padded.byteLength,
    ).getUint16(0);
    if (
      length > PADDED_BYTES - 2 ||
      padded.slice(2 + length).some((byte) => byte !== 0)
    )
      return null;
    const invite = parseLiveInvite(
      new TextDecoder().decode(padded.slice(2, 2 + length)),
    );
    return invite &&
      invite.expiresAt === command.expiresAt &&
      (await verifyLiveInvite(invite, now)) &&
      (await verifySignature(
        invite.signingKey,
        roomGrantBody({
          room: command.room,
          owner: command.owner,
          inviteId: invite.id,
          expiresAt: invite.expiresAt,
        }),
        command.grant,
      ))
      ? invite
      : null;
  } catch {
    return null;
  } finally {
    padded?.fill(0);
  }
}
export type PresenceService = {
  list(room: string): Promise<PresenceEntry[]>;
  publish(command: PresenceCommand): Promise<void>;
};
