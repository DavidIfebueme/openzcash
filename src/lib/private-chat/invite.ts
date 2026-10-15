import { decodeKey, encodeKey, isPublicKey } from "./keys";
import { isNymAddress } from "./nym-address";
import { normalizeAlias } from "./session";

const PREFIX = "ozchat1.";
const MAX_TOKEN_LENGTH = 900;

export type ChatInvite = {
  version: 1 | 2;
  alias: string;
  publicKey: string;
  nymAddress: string | null;
};

function encodeTokenBody(bytes: Uint8Array): string {
  return encodeKey(bytes);
}

function decodeTokenBody(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
    const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1)
      bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

export function createInvite(input: {
  alias: string;
  publicKey: string;
  nymAddress?: string | null;
}): string | null {
  const alias = normalizeAlias(input.alias);
  if (!alias || !isPublicKey(input.publicKey)) return null;
  const nymAddress = input.nymAddress ?? null;
  if (nymAddress !== null && !isNymAddress(nymAddress)) return null;
  const payload = nymAddress
    ? { v: 2, a: alias, n: nymAddress, p: input.publicKey }
    : { v: 1, a: alias, p: input.publicKey };
  const body = new TextEncoder().encode(JSON.stringify(payload));
  const token = `${PREFIX}${encodeTokenBody(body)}`;
  return token.length <= MAX_TOKEN_LENGTH ? token : null;
}

function tokenFrom(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.startsWith(PREFIX)) return trimmed.slice(0, MAX_TOKEN_LENGTH);
  try {
    const url = new URL(trimmed);
    const fromHash = new URLSearchParams(url.hash.replace(/^#/, "")).get(
      "invite",
    );
    const token = fromHash || url.searchParams.get("invite");
    return token?.startsWith(PREFIX) ? token.slice(0, MAX_TOKEN_LENGTH) : null;
  } catch {
    return null;
  }
}

export function parseInvite(value: string): ChatInvite | null {
  const token = tokenFrom(value);
  if (!token) return null;
  const bytes = decodeTokenBody(token.slice(PREFIX.length));
  if (!bytes) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return null;
  const record = parsed as Record<string, unknown>;
  const fields = Object.keys(record).sort().join(",");
  const version = fields === "a,p,v" ? 1 : fields === "a,n,p,v" ? 2 : 0;
  if (
    version === 0 ||
    record.v !== version ||
    typeof record.a !== "string" ||
    typeof record.p !== "string" ||
    (version === 2 && typeof record.n !== "string")
  )
    return null;
  const alias = normalizeAlias(record.a);
  const nymAddress = version === 2 ? (record.n as string) : null;
  if (
    !alias ||
    alias !== record.a ||
    !isPublicKey(record.p) ||
    !decodeKey(record.p) ||
    (nymAddress !== null && !isNymAddress(nymAddress))
  )
    return null;
  const canonical = createInvite({ alias, publicKey: record.p, nymAddress });
  return canonical === token
    ? { version, alias, publicKey: record.p, nymAddress }
    : null;
}

export function inviteUrl(origin: string, token: string): string | null {
  if (!parseInvite(token)) return null;
  const base = origin.replace(/\/$/, "");
  return `${base}/private-chat#invite=${encodeURIComponent(token)}`;
}

/** Same code for both people. An alias is not part of the check. */
export async function safetyCode(
  localPublicKey: string,
  remotePublicKey: string,
): Promise<string | null> {
  if (
    localPublicKey === remotePublicKey ||
    !isPublicKey(localPublicKey) ||
    !isPublicKey(remotePublicKey)
  )
    return null;
  const [left, right] =
    localPublicKey < remotePublicKey
      ? [localPublicKey, remotePublicKey]
      : [remotePublicKey, localPublicKey];
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${left}|${right}`),
    ),
  );
  const groups: string[] = [];
  for (let index = 0; index < 5; index += 1) {
    const value = (digest[index * 2] << 8) | digest[index * 2 + 1];
    groups.push(String(value % 10000).padStart(4, "0"));
  }
  return groups.join(" ");
}
