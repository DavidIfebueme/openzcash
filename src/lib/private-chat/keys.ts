/** Public key bytes for an X25519 chat identity. Never store a secret here. */
export const PUBLIC_KEY_BYTES = 32;

export function encodeKey(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function decodeKey(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
  try {
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
    if (binary.length !== PUBLIC_KEY_BYTES) return null;
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1)
      bytes[index] = binary.charCodeAt(index);
    return encodeKey(bytes) === value ? bytes : null;
  } catch {
    return null;
  }
}

export function isPublicKey(value: string): boolean {
  return decodeKey(value) !== null;
}
