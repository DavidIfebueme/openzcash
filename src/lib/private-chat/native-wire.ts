/** Native Nym WebSocket binary API, pinned to nym-binaries-v2026.20-glasgow.
 * Only self-address and anonymous replies are supported here; no direct send.
 */
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function base58(bytes: Uint8Array): string {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  let result = "";
  while (value > 0n) {
    result = ALPHABET[Number(value % 58n)] + result;
    value /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    result = "1" + result;
  }
  return result;
}
export type NativeEvent =
  | { kind: "address"; address: string }
  | { kind: "received"; bytes: Uint8Array; replyTag?: Uint8Array }
  | { kind: "error" }
  | { kind: "queue" };
export function nativeSelfAddress(): Uint8Array { return Uint8Array.of(3); }
export function nativeReply(tag: Uint8Array, bytes: Uint8Array): Uint8Array {
  if (tag.length !== 16 || bytes.length > 16_457) throw new Error("Invalid reply");
  const frame = new Uint8Array(33 + bytes.length);
  frame[0] = 2;
  frame.set(tag, 1);
  new DataView(frame.buffer).setBigUint64(25, BigInt(bytes.length));
  frame.set(bytes, 33);
  return frame;
}
export function parseNativeFrame(frame: Uint8Array): NativeEvent | null {
  if (frame.length < 1 || frame.length > 65_536) return null;
  if (frame[0] === 2 && frame.length === 97) {
    return { kind: "address", address:
      base58(frame.slice(1, 33)) + "." + base58(frame.slice(33, 65)) + "@" + base58(frame.slice(65, 97)) };
  }
  if (frame[0] === 0) return { kind: "error" };
  if (frame[0] === 3) return { kind: "queue" };
  if (frame[0] !== 1 || (frame[1] !== 0 && frame[1] !== 1)) return null;
  const offset = frame[1] === 1 ? 18 : 2;
  if (frame.length < offset + 8) return null;
  const length = new DataView(frame.buffer, frame.byteOffset, frame.byteLength).getBigUint64(offset);
  if (length !== BigInt(frame.length - offset - 8)) return null;
  return { kind: "received", bytes: new Uint8Array(frame.slice(offset + 8)),
    ...(frame[1] === 1 ? { replyTag: new Uint8Array(frame.slice(2, 18)) } : {}) };
}
