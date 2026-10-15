/** Conversation plaintext carried inside a sealed envelope. */

import { readPacket, type ChatPacket } from "./protocol";
import { isNymAddress } from "./nym-address";
import { normalizeAlias } from "./session";

const ID_PATTERN = /^[A-Za-z0-9_-]{8,32}$/;
export const MAX_MESSAGE_LENGTH = 400;

export type ChatIntro = { alias: string; nymAddress: string };
export type ChatText = {
  v: 1;
  t: "m";
  id: string;
  body: string;
} & Partial<ChatIntro>;
export type ChatAck = { v: 1; t: "a"; id: string; ref: string };
export type ChatPlaintext = ChatText | ChatAck | ChatPacket;

export type IncomingDecision =
  | {
      type: "message";
      id: string;
      body: string;
      ack: ChatAck;
      intro: ChatIntro | null;
    }
  | { type: "ack"; id: string; ref: string }
  | { type: "ignore" };

export function isMessageId(value: string): boolean {
  return ID_PATTERN.test(value);
}

export function messageId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function textMessage(body: string): ChatText | null {
  const trimmed = body.trim();
  if (
    trimmed.length < 1 ||
    trimmed.length > MAX_MESSAGE_LENGTH ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(trimmed)
  )
    return null;
  return { v: 1, t: "m", id: messageId(), body: trimmed };
}

export function ackFor(ref: string): ChatAck | null {
  if (!isMessageId(ref)) return null;
  return { v: 1, t: "a", id: messageId(), ref };
}

export function encodePlaintext(value: ChatPlaintext): string | null {
  if (value.v === 3) return readPacket(value) ? JSON.stringify(value) : null;
  if (value.v !== 1 || !isMessageId(value.id)) return null;
  if (value.t === "m") {
    if (textMessage(value.body)?.body !== value.body) return null;
    if (value.alias === undefined && value.nymAddress === undefined)
      return JSON.stringify({ v: 1, t: "m", id: value.id, body: value.body });
    if (
      !value.alias ||
      !value.nymAddress ||
      normalizeAlias(value.alias) !== value.alias ||
      !isNymAddress(value.nymAddress)
    )
      return null;
    return JSON.stringify({
      a: value.alias,
      body: value.body,
      id: value.id,
      n: value.nymAddress,
      t: "m",
      v: 1,
    });
  }
  if (value.t === "a" && isMessageId(value.ref))
    return JSON.stringify({ v: 1, t: "a", id: value.id, ref: value.ref });
  return null;
}

export function decodePlaintext(bytes: Uint8Array): ChatPlaintext | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return null;
  const record = parsed as Record<string, unknown>;
  if (record.v === 3) return readPacket(record);
  const keys = Object.keys(record).sort().join(",");
  if (
    record.v !== 1 ||
    typeof record.id !== "string" ||
    !isMessageId(record.id)
  )
    return null;
  if (
    record.t === "m" &&
    typeof record.body === "string" &&
    textMessage(record.body)?.body === record.body &&
    (keys === "body,id,t,v" || keys === "a,body,id,n,t,v")
  ) {
    if (keys === "body,id,t,v")
      return { v: 1, t: "m", id: record.id, body: record.body };
    if (
      typeof record.a !== "string" ||
      typeof record.n !== "string" ||
      normalizeAlias(record.a) !== record.a ||
      !isNymAddress(record.n)
    )
      return null;
    return {
      v: 1,
      t: "m",
      id: record.id,
      body: record.body,
      alias: record.a,
      nymAddress: record.n,
    };
  }
  if (
    keys === "id,ref,t,v" &&
    record.t === "a" &&
    typeof record.ref === "string" &&
    isMessageId(record.ref)
  ) {
    return { v: 1, t: "a", id: record.id, ref: record.ref };
  }
  return null;
}

/** Drops repeats. A message yields an ack; an ack only names the message it confirms. */
export function decideIncoming(
  plaintext: ChatPlaintext,
  seen: ReadonlySet<string>,
): IncomingDecision {
  if (plaintext.v !== 1) return { type: "ignore" };
  if (seen.has(plaintext.id)) return { type: "ignore" };
  if (plaintext.t === "a")
    return { type: "ack", id: plaintext.id, ref: plaintext.ref };
  const ack = ackFor(plaintext.id);
  if (!ack) return { type: "ignore" };
  const intro =
    plaintext.alias && plaintext.nymAddress
      ? { alias: plaintext.alias, nymAddress: plaintext.nymAddress }
      : null;
  return {
    type: "message",
    id: plaintext.id,
    body: plaintext.body,
    ack,
    intro,
  };
}
