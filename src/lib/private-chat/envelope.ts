import { decodeKey, encodeKey } from "./keys";
import {
  decodePlaintext,
  encodePlaintext,
  type ChatPlaintext,
} from "./messages";

const VERSION = 1;
const PUBLIC_KEY_BYTES = 32;
const HEADER_BYTES = 1 + PUBLIC_KEY_BYTES + 24;
const MAX_ENVELOPE_BYTES = 8192;

async function sodiumReady() {
  const sodium = (await import("libsodium-wrappers")).default;
  await sodium.ready;
  return sodium;
}

/** Version, sender public key, nonce, then crypto_box ciphertext. */
export async function sealEnvelope(input: {
  senderSecretKey: Uint8Array;
  senderPublicKey: string;
  recipientPublicKey: string;
  plaintext: ChatPlaintext;
}): Promise<Uint8Array | null> {
  const recipient = decodeKey(input.recipientPublicKey);
  const encoded = encodePlaintext(input.plaintext);
  if (!recipient || !encoded) return null;
  try {
    const sodium = await sodiumReady();
    const derived = sodium.crypto_scalarmult_base(input.senderSecretKey);
    const sender = decodeKey(input.senderPublicKey);
    const matches = encodeKey(derived) === input.senderPublicKey;
    sodium.memzero(derived);
    if (!matches || !sender) return null;
    // Pass the JSON string. libsodium rejects a Uint8Array from another realm.
    const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
    const cipher = sodium.crypto_box_easy(
      encoded,
      nonce,
      recipient,
      input.senderSecretKey,
    );
    const envelope = new Uint8Array(HEADER_BYTES + cipher.length);
    if (envelope.length > MAX_ENVELOPE_BYTES) return null;
    envelope[0] = VERSION;
    envelope.set(sender, 1);
    envelope.set(nonce, 1 + PUBLIC_KEY_BYTES);
    envelope.set(cipher, HEADER_BYTES);
    return envelope;
  } catch {
    return null;
  }
}

/** Opens any box sealed to this tab. The header key is authenticated by the box. */
export async function openEnvelopeFromHeader(input: {
  bytes: Uint8Array;
  recipientSecretKey: Uint8Array;
}): Promise<{ plaintext: ChatPlaintext; senderPublicKey: string } | null> {
  if (
    input.bytes.length < HEADER_BYTES + 16 ||
    input.bytes.length > MAX_ENVELOPE_BYTES ||
    input.bytes[0] !== VERSION
  )
    return null;
  const sender = input.bytes.slice(1, 1 + PUBLIC_KEY_BYTES);
  const senderPublicKey = encodeKey(sender);
  const nonce = input.bytes.slice(1 + PUBLIC_KEY_BYTES, HEADER_BYTES);
  const cipher = input.bytes.slice(HEADER_BYTES);
  try {
    const sodium = await sodiumReady();
    const plain = sodium.crypto_box_open_easy(
      cipher,
      nonce,
      sender,
      input.recipientSecretKey,
    );
    const plaintext = decodePlaintext(plain);
    sodium.memzero(plain);
    return plaintext ? { plaintext, senderPublicKey } : null;
  } catch {
    return null;
  }
}

/** Opens an envelope only when the sender key is the accepted contact key. */
export async function openEnvelope(input: {
  bytes: Uint8Array;
  recipientSecretKey: Uint8Array;
  senderPublicKey: string;
}): Promise<ChatPlaintext | null> {
  const opened = await openEnvelopeFromHeader(input);
  if (!opened || opened.senderPublicKey !== input.senderPublicKey) return null;
  return opened.plaintext;
}
