import { sodiumReady } from "./identity";
import { decodeKey, encodeKey, isPublicKey } from "./keys";
import { isNymAddress } from "./nym-address";

export type DirectoryReplyMode = "address" | "surb";
export type DirectoryConfig = {
  address: string;
  publicKey: string;
  replyMode: DirectoryReplyMode;
};
export const DIRECTORY_REQUEST = 2;
export const DIRECTORY_RESPONSE = 3;
export const DIRECTORY_REQUEST_PADDING = 4096;
export const DIRECTORY_RESPONSE_PADDING = 16384;
export const DIRECTORY_HEADER = 73; // kind + sender key + nonce + authenticator
export const DIRECTORY_TIMEOUT_MS = 45_000;
export const DIRECTORY_PAGE_SIZE = 6;
export function directoryRoomProofBody(input: {
  v: 1;
  id: string;
  at: number;
  body: unknown;
  replyTo?: string;
}) {
  return JSON.stringify({
    v: input.v,
    id: input.id,
    at: input.at,
    ...(input.replyTo === undefined ? {} : { replyTo: input.replyTo }),
    body: input.body,
  });
}
export function validDirectoryConfig(v: unknown): v is DirectoryConfig {
  if (!v || typeof v !== "object") return false;
  const c = v as DirectoryConfig;
  return (
    typeof c.address === "string" &&
    isNymAddress(c.address) &&
    typeof c.publicKey === "string" &&
    isPublicKey(c.publicKey) &&
    (c.replyMode === "address" || c.replyMode === "surb")
  );
}
// A separate wire format and ephemeral request key keep the chat identity out of
// directory requests. Pinned provider authentication protects the response.
export async function sealDirectory(
  kind: 2 | 3,
  value: unknown,
  sender: { publicKey: string; secretKey: Uint8Array },
  recipient: string,
) {
  const sodium = await sodiumReady();
  const key = decodeKey(recipient),
    own = decodeKey(sender.publicKey);
  if (!key || !own) throw new Error("Invalid directory key");
  const size =
    kind === DIRECTORY_REQUEST
      ? DIRECTORY_REQUEST_PADDING
      : DIRECTORY_RESPONSE_PADDING;
  const data = new TextEncoder().encode(JSON.stringify(value));
  const padded = new Uint8Array(size);
  if (data.length > size - 4) throw new Error("Directory payload too large");
  new DataView(padded.buffer).setUint32(0, data.length);
  padded.set(data, 4);
  const nonce = crypto.getRandomValues(new Uint8Array(24));
  try {
    const cipher = sodium.crypto_box_easy(padded, nonce, key, sender.secretKey);
    const frame = new Uint8Array(size + DIRECTORY_HEADER);
    frame[0] = kind;
    frame.set(own, 1);
    frame.set(nonce, 33);
    frame.set(cipher, 57);
    return frame;
  } finally {
    padded.fill(0);
    data.fill(0);
  }
}
export async function openDirectory(
  bytes: Uint8Array,
  kind: 2 | 3,
  secret: Uint8Array,
  expectedSender?: string,
): Promise<{ sender: string; value: unknown } | null> {
  const size =
    kind === DIRECTORY_REQUEST
      ? DIRECTORY_REQUEST_PADDING
      : DIRECTORY_RESPONSE_PADDING;
  if (bytes.length !== size + DIRECTORY_HEADER || bytes[0] !== kind)
    return null;
  const sender = encodeKey(bytes.slice(1, 33));
  if (expectedSender && sender !== expectedSender) return null;
  let plain: Uint8Array | undefined;
  try {
    const sodium = await sodiumReady();
    plain = sodium.crypto_box_open_easy(
      bytes.slice(57),
      bytes.slice(33, 57),
      bytes.slice(1, 33),
      secret,
    );
    const length = new DataView(
      plain.buffer,
      plain.byteOffset,
      plain.byteLength,
    ).getUint32(0);
    if (length > size - 4 || plain.slice(4 + length).some((b) => b !== 0))
      return null;
    return {
      sender,
      value: JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(
          plain.slice(4, 4 + length),
        ),
      ),
    };
  } catch {
    return null;
  } finally {
    plain?.fill(0);
  }
}
