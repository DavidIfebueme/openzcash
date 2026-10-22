import { isNymAddress } from "./nym-address";
import { normalizeAlias } from "./session";
import { isRatchetBundle, isRatchetMessage, type RatchetBundle, type RatchetMessage } from "./ratchet";

// Version 3 requires Olm for conversation traffic; older clients fail closed.
export type ChatPacket = { v: 3; id: string } & (
  | {
      t: "request";
      inviteId: string;
      expiresAt: number;
      alias: string;
      address: string;
      sequence: number;
      ratchet: RatchetBundle;
    }
  | { t: "accept"; ref: string; address: string; ratchet: RatchetBundle }
  | { t: "ratchet"; c: string; content: RatchetMessage }
  | { t: "reject"; ref: string }
  | { t: "text"; c: string; body: string; re?: string }
  | { t: "react"; c: string; ref: string; emoji: Reaction | "" }
  | { t: "ack"; c: string; ref: string }
  | { t: "resume"; c: string; address: string; sequence: number }
  | { t: "ready"; c: string; ref: string; address: string; sequence: number }
  | { t: "bye"; c: string }
  | { t: "probe" }
);
/** The fixed reaction set: one per person per message, inside the ratchet. */
export const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;
export type Reaction = (typeof REACTIONS)[number];
export const isReaction = (v: unknown): v is Reaction =>
  typeof v === "string" && (REACTIONS as readonly string[]).includes(v);
const id = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9_-]{8,32}$/.test(v);
const address = (v: unknown): v is string =>
  typeof v === "string" && isNymAddress(v);
export function readPacket(value: unknown): ChatPacket | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  if (p.v !== 3 || !id(p.id)) return null;
  const fields = Object.keys(p).sort().join(",");
  let valid = false;
  switch (p.t) {
    case "probe":
      valid = fields === "id,t,v";
      break;
    case "request":
      valid =
        fields === "address,alias,expiresAt,id,inviteId,ratchet,sequence,t,v" &&
        id(p.inviteId) &&
        isRatchetBundle(p.ratchet) &&
        address(p.address) &&
        typeof p.alias === "string" &&
        normalizeAlias(p.alias) === p.alias &&
        Number.isSafeInteger(p.expiresAt) &&
        Number.isSafeInteger(p.sequence) &&
        Number(p.sequence) > 0;
      break;
    case "accept":
      valid =
        fields === "address,id,ratchet,ref,t,v" && id(p.ref) && address(p.address) && isRatchetBundle(p.ratchet);
      break;
    case "ratchet":
      valid = fields === "c,content,id,t,v" && id(p.c) && isRatchetMessage(p.content);
      break;
    case "reject":
      valid = fields === "id,ref,t,v" && id(p.ref);
      break;
    case "text":
      valid =
        (fields === "body,c,id,t,v" || (fields === "body,c,id,re,t,v" && id(p.re))) &&
        id(p.c) &&
        typeof p.body === "string" &&
        p.body.trim() === p.body &&
        p.body.length > 0 &&
        p.body.length <= 400 &&
        !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(p.body);
      break;
    case "react":
      valid = fields === "c,emoji,id,ref,t,v" && id(p.c) && id(p.ref) &&
        (p.emoji === "" || isReaction(p.emoji));
      break;
    case "ack":
      valid = fields === "c,id,ref,t,v" && id(p.c) && id(p.ref);
      break;
    case "resume":
      valid =
        fields === "address,c,id,sequence,t,v" &&
        id(p.c) &&
        address(p.address) &&
        Number.isSafeInteger(p.sequence) &&
        Number(p.sequence) > 0;
      break;
    case "ready":
      valid =
        fields === "address,c,id,ref,sequence,t,v" &&
        id(p.c) &&
        id(p.ref) &&
        address(p.address) &&
        Number.isSafeInteger(p.sequence) &&
        Number(p.sequence) > 0;
      break;
    case "bye":
      valid = fields === "c,id,t,v" && id(p.c);
      break;
  }
  return valid ? (p as ChatPacket) : null;
}
