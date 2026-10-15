/**
 * Memory-only Olm Double Ratchet, implemented by maintained Matrix Rust crypto.
 * Matrix-shaped key records are exchanged through our authenticated Nym envelope;
 * this adapter never contacts a Matrix server, persists a store, or uses Megolm.
 */
import type { OlmMachine } from "@matrix-org/matrix-sdk-crypto-wasm";
import { decodeKey } from "./keys";
import { sodiumReady } from "./identity";

const ALGORITHM = "m.olm.v1.curve25519-aes-sha2";
const EVENT_TYPE = "org.openzcash.private-chat.v3";
const DEVICE_ID = "CHAT";
const USER_PATTERN = /^@[a-f0-9]{32}:private\.openzcash\.invalid$/;
const BASE64_KEY = /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]$/;
const BASE64_SIGNATURE = /^[A-Za-z0-9+/]{85}[AQgw]$/;
export const MAX_RATCHET_PLAINTEXT_BYTES = 3072;
export const MAX_RATCHET_MESSAGE_BYTES = 6500;
const encoder = new TextEncoder();

type JsonObject = Record<string, unknown>;
export type RatchetBundle = {
  v: 1;
  userId: string;
  deviceId: typeof DEVICE_ID;
  deviceKeys: {
    user_id: string;
    device_id: typeof DEVICE_ID;
    algorithms: string[];
    keys: Record<string, string>;
    signatures: Record<string, Record<string, string>>;
  };
  oneTimeKey: Record<string, {
    key: string;
    signatures: Record<string, Record<string, string>>;
  }>;
};
export type RatchetMessage = {
  algorithm: typeof ALGORITHM;
  sender_key: string;
  ciphertext: Record<string, { type: 0 | 1; body: string }>;
  "org.matrix.msgid"?: string;
};

function object(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function fields(value: JsonObject, expected: string[]) {
  return Object.keys(value).sort().join(",") === expected.sort().join(",");
}
function signatures(value: unknown, user: string): boolean {
  if (!object(value) || !fields(value, [user])) return false;
  const signature = value[user];
  if (!object(signature) || !fields(signature, [`ed25519:${DEVICE_ID}`])) return false;
  const encoded = signature[`ed25519:${DEVICE_ID}`];
  return typeof encoded === "string" && BASE64_SIGNATURE.test(encoded);
}

/** Shape/size validation only; the SDK verifies device and one-time-key signatures. */
export function isRatchetBundle(value: unknown): value is RatchetBundle {
  if (!object(value) || !fields(value, ["v", "userId", "deviceId", "deviceKeys", "oneTimeKey"]) ||
      value.v !== 1 || value.deviceId !== DEVICE_ID || typeof value.userId !== "string" ||
      !USER_PATTERN.test(value.userId)) return false;
  const device = value.deviceKeys;
  if (!object(device) || !fields(device, ["user_id", "device_id", "algorithms", "keys", "signatures"]) ||
      device.user_id !== value.userId || device.device_id !== DEVICE_ID ||
      !Array.isArray(device.algorithms) || device.algorithms.length !== 2 ||
      device.algorithms[0] !== ALGORITHM || device.algorithms[1] !== "m.megolm.v1.aes-sha2" ||
      !object(device.keys) || !fields(device.keys, [`curve25519:${DEVICE_ID}`, `ed25519:${DEVICE_ID}`]) ||
      !Object.values(device.keys).every(key => typeof key === "string" && BASE64_KEY.test(key)) ||
      !signatures(device.signatures, value.userId)) return false;
  if (!object(value.oneTimeKey) || Object.keys(value.oneTimeKey).length !== 1) return false;
  const [id, key] = Object.entries(value.oneTimeKey)[0];
  return /^signed_curve25519:[A-Za-z0-9+/]{1,32}$/.test(id) && object(key) &&
    fields(key, ["key", "signatures"]) && typeof key.key === "string" && BASE64_KEY.test(key.key) &&
    signatures(key.signatures, value.userId);
}

export function isRatchetMessage(value: unknown): value is RatchetMessage {
  if (!object(value) || !fields(value, ["algorithm", "sender_key", "ciphertext", ...(value["org.matrix.msgid"] === undefined ? [] : ["org.matrix.msgid"])]) ||
      value.algorithm !== ALGORITHM || typeof value.sender_key !== "string" ||
      !BASE64_KEY.test(value.sender_key) || !object(value.ciphertext) ||
      Object.keys(value.ciphertext).length !== 1) return false;
  const msgid = value["org.matrix.msgid"];
  if (msgid !== undefined && (typeof msgid !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(msgid))) return false;
  const [key, ciphertext] = Object.entries(value.ciphertext)[0];
  return BASE64_KEY.test(key) && object(ciphertext) && fields(ciphertext, ["type", "body"]) &&
    (ciphertext.type === 0 || ciphertext.type === 1) && typeof ciphertext.body === "string" &&
    ciphertext.body.length >= 32 && ciphertext.body.length <= 6000 &&
    /^[A-Za-z0-9+/]+$/.test(ciphertext.body) &&
    encoder.encode(JSON.stringify(value)).byteLength <= MAX_RATCHET_MESSAGE_BYTES;
}

type Sdk = typeof import("@matrix-org/matrix-sdk-crypto-wasm");
let ready: Promise<Sdk> | undefined;
function sdkReady(): Promise<Sdk> {
  return ready ??= import("@matrix-org/matrix-sdk-crypto-wasm").then(async sdk => {
    await sdk.initAsync();
    return sdk;
  }).catch(error => { ready = undefined; throw error; });
}

/** One instance per conversation, bound to the two already authenticated tab keys. */
export class ConversationRatchet {
  private peer: RatchetBundle | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private closed = false;
  private pending = 0;

  private constructor(
    private sdk: Sdk,
    private machine: OlmMachine,
    private ownBundle: RatchetBundle,
    private conversationId: string,
    private ownBoxKey: string,
    private peerBoxKey: string,
  ) {}

  static async create(conversationId: string, ownBoxKey: string, peerBoxKey: string): Promise<ConversationRatchet> {
    if (!/^[A-Za-z0-9_-]{8,32}$/.test(conversationId) || !decodeKey(ownBoxKey) ||
        !decodeKey(peerBoxKey) || ownBoxKey === peerBoxKey) throw new Error("Invalid ratchet binding");
    const sdk = await sdkReady();
    const userId = `@${Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, "0")).join("")}:private.openzcash.invalid`;
    // Omitting store_name explicitly selects the SDK's memory-only store.
    const machine = await sdk.OlmMachine.initialize(new sdk.UserId(userId), new sdk.DeviceId(DEVICE_ID));
    machine.roomKeyRequestsEnabled = false;
    machine.roomKeyForwardingEnabled = false;
    try {
      const requests = await machine.outgoingRequests();
      try {
        const upload = requests.find(request => request.type === sdk.RequestType.KeysUpload);
        if (!upload || typeof upload.body !== "string" || typeof upload.id !== "string") throw new Error("Ratchet keys unavailable");
        const body = JSON.parse(upload.body);
        const bundle: RatchetBundle = { v: 1, userId, deviceId: DEVICE_ID, deviceKeys: body.device_keys,
          oneTimeKey: Object.fromEntries(Object.entries(body.one_time_keys).slice(0, 1)) as RatchetBundle["oneTimeKey"] };
        if (!isRatchetBundle(bundle)) throw new Error("Invalid generated ratchet keys");
        // Local acknowledgement only: no public key upload or other HTTP request.
        await machine.markRequestAsSent(upload.id, upload.type, JSON.stringify({ one_time_key_counts: { signed_curve25519: 50 } }));
        return new ConversationRatchet(sdk, machine, bundle, conversationId, ownBoxKey, peerBoxKey);
      } finally { requests.forEach(request => request.free()); }
    } catch (error) { machine.close(); throw error; }
  }

  get bundle(): RatchetBundle { return structuredClone(this.ownBundle); }

  /** Call only after the application's authenticated invite/request/accept checks. */
  async setPeer(bundle: RatchetBundle, initiate: boolean): Promise<void> {
    if (!isRatchetBundle(bundle) || bundle.userId === this.ownBundle.userId) throw new Error("Invalid ratchet peer");
    const copy = structuredClone(bundle);
    await this.serial(async () => {
      if (this.peer) {
        if (JSON.stringify(this.peer) !== JSON.stringify(copy)) throw new Error("Ratchet peer cannot change");
        return;
      }
      // The SDK can silently ignore an invalid key-claim response. Validate the
      // one-field canonical signed key before acknowledging that response.
      const sodium = await sodiumReady();
      const oneTimeKey = Object.values(copy.oneTimeKey)[0];
      const verified = sodium.crypto_sign_verify_detached(
        sodium.from_base64(oneTimeKey.signatures[copy.userId][`ed25519:${DEVICE_ID}`], sodium.base64_variants.ORIGINAL_NO_PADDING),
        JSON.stringify({ key: oneTimeKey.key }),
        sodium.from_base64(copy.deviceKeys.keys[`ed25519:${DEVICE_ID}`], sodium.base64_variants.ORIGINAL_NO_PADDING),
      );
      if (!verified) throw new Error("Ratchet one-time key signature rejected");
      const sdk = this.sdk;
      const query = this.machine.queryKeysForUsers([new sdk.UserId(copy.userId)]);
      try {
        await this.machine.markRequestAsSent(query.id, query.type, JSON.stringify({ device_keys: { [copy.userId]: { [DEVICE_ID]: copy.deviceKeys } }, failures: {} }));
      } finally { query.free(); }
      const device = await this.machine.getDevice(new sdk.UserId(copy.userId), new sdk.DeviceId(DEVICE_ID));
      if (!device) throw new Error("Ratchet peer signature rejected");
      try {
        const curve = device.curve25519Key;
        const signing = device.ed25519Key;
        try {
          if (curve?.toBase64() !== copy.deviceKeys.keys[`curve25519:${DEVICE_ID}`] ||
              signing?.toBase64() !== copy.deviceKeys.keys[`ed25519:${DEVICE_ID}`]) throw new Error("Ratchet peer keys differ");
        } finally { curve?.free(); signing?.free(); }
      } finally { device.free(); }
      if (initiate) {
        const claim = await this.machine.getMissingSessions([new sdk.UserId(copy.userId)]);
        if (!claim) throw new Error("Ratchet session unavailable");
        try {
          await this.machine.markRequestAsSent(claim.id, claim.type, JSON.stringify({ one_time_keys: { [copy.userId]: { [DEVICE_ID]: copy.oneTimeKey } }, failures: {} }));
        } finally { claim.free(); }
        const missing = await this.machine.getMissingSessions([new sdk.UserId(copy.userId)]);
        if (missing) { missing.free(); throw new Error("Ratchet one-time key rejected"); }
      }
      this.peer = copy;
    });
  }

  async encrypt(plaintext: string): Promise<RatchetMessage | null> {
    if (typeof plaintext !== "string" || encoder.encode(plaintext).byteLength > MAX_RATCHET_PLAINTEXT_BYTES) return null;
    try {
      return await this.serial(async () => {
        if (!this.peer) return null;
        const device = await this.machine.getDevice(new this.sdk.UserId(this.peer.userId), new this.sdk.DeviceId(DEVICE_ID));
        if (!device) return null;
        try {
          const encrypted: unknown = JSON.parse(await device.encryptToDeviceEvent(EVENT_TYPE, {
            v: 1, conversation: this.conversationId, from: this.ownBoxKey, to: this.peerBoxKey, plaintext,
          }));
          return !this.closed && isRatchetMessage(encrypted) ? encrypted : null;
        } finally { device.free(); }
      });
    } catch { return null; }
  }

  async decrypt(message: RatchetMessage): Promise<string | null> {
    if (!isRatchetMessage(message)) return null;
    const copy = structuredClone(message);
    try {
      return await this.serial(async () => {
        const peer = this.peer;
        if (!peer || copy.sender_key !== peer.deviceKeys.keys[`curve25519:${DEVICE_ID}`] ||
            !Object.hasOwn(copy.ciphertext, this.ownBundle.deviceKeys.keys[`curve25519:${DEVICE_ID}`])) return null;
        const lists = new this.sdk.DeviceLists();
        const events = await this.machine.receiveSyncChanges(
          JSON.stringify([{ type: "m.room.encrypted", sender: peer.userId, content: copy }]),
          lists, new Map([["signed_curve25519", 50]]),
        ).finally(() => lists.free());
        try {
          if (this.closed || events.length !== 1 || events[0].type !== this.sdk.ProcessedToDeviceEventType.Decrypted) return null;
          const event = events[0] as import("@matrix-org/matrix-sdk-crypto-wasm").DecryptedToDeviceEvent;
          const info = event.encryptionInfo;
          try { if (info.senderCurve25519Key !== peer.deviceKeys.keys[`curve25519:${DEVICE_ID}`]) return null; }
          finally { info.free(); }
          const raw: unknown = JSON.parse(event.rawEvent);
          if (!object(raw) || raw.type !== EVENT_TYPE || raw.sender !== peer.userId || raw.recipient !== this.ownBundle.userId ||
              !object(raw.keys) || raw.keys.ed25519 !== peer.deviceKeys.keys[`ed25519:${DEVICE_ID}`] ||
              !object(raw.recipient_keys) || raw.recipient_keys.ed25519 !== this.ownBundle.deviceKeys.keys[`ed25519:${DEVICE_ID}`]) return null;
          const content = raw.content;
          if (!object(content) || !fields(content, ["v", "conversation", "from", "to", "plaintext"]) ||
              content.v !== 1 || content.conversation !== this.conversationId || content.from !== this.peerBoxKey ||
              content.to !== this.ownBoxKey || typeof content.plaintext !== "string" ||
              encoder.encode(content.plaintext).byteLength > MAX_RATCHET_PLAINTEXT_BYTES) return null;
          return content.plaintext;
        } finally { events.forEach(event => event.free()); }
      });
    } catch { return null; }
  }

  /** Stop immediately; release the Rust memory-only account after any active call. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.peer = null;
    void this.queue.finally(() => this.machine.close());
  }

  private serial<T>(operation: () => Promise<T>): Promise<T> {
    if (this.closed || this.pending >= 8) return Promise.reject(new Error("Ratchet unavailable"));
    this.pending += 1;
    const result = this.queue.then(() => {
      if (this.closed) throw new Error("Ratchet closed");
      return operation();
    });
    this.queue = result.then(() => undefined, () => undefined).finally(() => { this.pending -= 1; });
    return result;
  }
}
