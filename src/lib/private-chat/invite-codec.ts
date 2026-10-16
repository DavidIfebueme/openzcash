import { decodeKey, encodeKey } from "./keys";
import type { LiveInvite } from "./live-invite";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58(bytes: Uint8Array): string {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  let encoded = "";
  while (value) {
    encoded = BASE58[Number(value % 58n)] + encoded;
    value /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    encoded = "1" + encoded;
  }
  return encoded;
}

function addressKey(value: string): Uint8Array | null {
  if (value.length > 44) return null;
  let number = 0n;
  for (const char of value) {
    const digit = BASE58.indexOf(char);
    if (digit < 0) return null;
    number = number * 58n + BigInt(digit);
  }
  if (number >= 1n << 256n) return null;
  const bytes = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(number & 255n);
    number >>= 8n;
  }
  return base58(bytes) === value ? bytes : null;
}

/** A wire representation only: the original invite signature is unchanged.
 * No resolver, database entry, compression stream or new secret is introduced.
 * mode / id length / alias length / timestamp / keys / signature / id / alias /
 * address. Standard Nym addresses store 2 or 3 raw 32-byte keys; mode 0 stores
 * an explicitly sized UTF-8 address for compatibility with other valid forms.
 */
export function packInvite(invite: LiveInvite): Uint8Array | null {
  try {
    const encoder = new TextEncoder();
    const id = encoder.encode(invite.id), alias = encoder.encode(invite.alias);
    const publicKey = decodeKey(invite.publicKey), signingKey = decodeKey(invite.signingKey);
    const signature = Uint8Array.from(atob(invite.signature.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    if (!publicKey || !signingKey || signature.length !== 64 || encodeKey(signature) !== invite.signature ||
        id.length < 8 || id.length > 32 || alias.length > 96 ||
        !Number.isSafeInteger(invite.createdAt) || invite.createdAt < 0) return null;
    const parts = invite.address.split(/[.@]/);
    const keys = parts.map(addressKey);
    const mode = (parts.length === 2 || parts.length === 3) && keys.every(Boolean) ? parts.length : 0;
    const address = encoder.encode(invite.address);
    if (address.length > 602) return null;
    const packed = new Uint8Array(139 + id.length + alias.length + (mode ? mode * 32 : 2 + address.length));
    packed.set([mode, id.length, alias.length]);
    new DataView(packed.buffer).setFloat64(3, invite.createdAt);
    let offset = 11;
    for (const field of [publicKey, signingKey, signature, id, alias]) {
      packed.set(field, offset);
      offset += field.length;
    }
    if (mode) {
      for (const key of keys) { packed.set(key!, offset); offset += 32; }
    } else {
      new DataView(packed.buffer).setUint16(offset, address.length);
      packed.set(address, offset + 2);
    }
    return packed;
  } catch { return null; }
}

export function unpackInvite(bytes: Uint8Array, ttl: number): LiveInvite | null {
  if (bytes.length < 149 || bytes.length > 871) return null;
  const mode = bytes[0], idLength = bytes[1], aliasLength = bytes[2];
  if (![0, 2, 3].includes(mode) || idLength < 8 || idLength > 32 || aliasLength > 96) return null;
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const createdAt = view.getFloat64(3);
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let offset = 139;
    const id = decoder.decode(bytes.subarray(offset, offset += idLength));
    const alias = decoder.decode(bytes.subarray(offset, offset += aliasLength));
    let address: string;
    if (mode) {
      if (bytes.length !== offset + mode * 32) return null;
      const keys = Array.from({ length: mode }, () => base58(bytes.subarray(offset, offset += 32)));
      address = mode === 3 ? `${keys[0]}.${keys[1]}@${keys[2]}` : `${keys[0]}@${keys[1]}`;
    } else {
      const length = view.getUint16(offset);
      offset += 2;
      if (length > 602 || bytes.length !== offset + length) return null;
      address = decoder.decode(bytes.subarray(offset));
    }
    return {
      v: 3, id, alias, address, createdAt, expiresAt: createdAt + ttl,
      publicKey: encodeKey(bytes.subarray(11, 43)),
      signingKey: encodeKey(bytes.subarray(43, 75)),
      signature: encodeKey(bytes.subarray(75, 139)),
    };
  } catch { return null; }
}
