import { sodiumReady } from "./identity";
import { signRoomOperation } from "./discovery-room";
import { encodeKey, isPublicKey } from "./keys";
import { isNymAddress } from "./nym-address";
import { messageId } from "./messages";
import {
  isPresenceCommand,
  type PresenceCommand,
  type PresenceEntry,
  type PresenceService,
} from "./presence";
import {
  DIRECTORY_REQUEST,
  DIRECTORY_RESPONSE,
  DIRECTORY_TIMEOUT_MS,
  DIRECTORY_PAGE_SIZE,
  directoryRoomProofBody,
  openDirectory,
  sealDirectory,
  validDirectoryConfig,
  type DirectoryConfig,
} from "./directory-wire";

type Reply = {
  v: 1;
  id: string;
  status: number;
  entries?: PresenceEntry[];
  next?: string | null;
};
type Pending = {
  key: Uint8Array;
  timer: ReturnType<typeof setTimeout>;
  resolve: (r: Reply) => void;
  reject: (e: Error) => void;
};
type Send = (input: {
  id: string;
  recipient: string;
  bytes: Uint8Array;
  anonymous?: boolean;
}) => void;
/** No HTTP implementation or fallback. Every operation requires a verified Nym route. */
export class NymDirectory implements PresenceService {
  private pending = new Map<string, Pending>();
  private generation = 0;
  constructor(
    private config: DirectoryConfig | null,
    private send: Send,
    private ready: () => boolean,
    private replyAddress: () => string | null,
    private roomAuth: (roomId: string) => Uint8Array | null,
  ) {}
  close() {
    this.generation++;
    for (const id of this.pending.keys()) this.fail(id);
  }
  fail(id: string) {
    const p = this.pending.get(id);
    if (!p) return;
    this.pending.delete(id);
    clearTimeout(p.timer);
    p.key.fill(0);
    p.reject(new Error("Discover paused"));
  }
  async receive(bytes: Uint8Array) {
    if (bytes[0] !== DIRECTORY_RESPONSE || !this.config) return;
    const generation = this.generation;
    // At most four concurrent requests, each with a fresh box key. No chat key,
    // cookie, IP, or room link is included in the payload.
    // The provider does learn the temporary Nym return address.
    for (const [id, p] of this.pending) {
      const opened = await openDirectory(
        bytes,
        DIRECTORY_RESPONSE,
        p.key,
        this.config.publicKey,
      );
      if (generation !== this.generation || this.pending.get(id) !== p) return;
      if (!opened) continue;
      const value = opened.value as Reply | null;
      if (
        !value ||
        value.v !== 1 ||
        value.id !== id ||
        !Number.isInteger(value.status)
      )
        return;
      this.pending.delete(id);
      clearTimeout(p.timer);
      p.key.fill(0);
      if (value.status !== 200) p.reject(new Error("Directory unavailable"));
      else p.resolve(value);
      return;
    }
  }
  private async request(body: unknown): Promise<Reply> {
    if (
      !this.ready() ||
      !validDirectoryConfig(this.config) ||
      this.pending.size >= 4
    )
      throw new Error("Discover requires Nym");
    const generation = this.generation,
      config = this.config,
      roomId = (body as { room?: unknown } | null)?.room;
    if (typeof roomId !== "string" || !isPublicKey(roomId))
      throw new Error("Invalid room");
    const removal = isPresenceCommand(body) && body.op === "remove";
    const authSecret = this.roomAuth(roomId);
    if (!authSecret && !removal)
      throw new Error("Room authorization unavailable");
    const replyTo: string | undefined =
      config.replyMode === "address" ? this.replyAddress() ?? undefined : undefined;
    if (config.replyMode === "address" && (!replyTo || !isNymAddress(replyTo)))
      throw new Error("No Nym return route");
    const sodium = await sodiumReady(),
      pair = sodium.crypto_box_keypair();
    const id = messageId();
    try {
      const request = {
        v: 1 as const,
        id,
        at: Date.now(),
        ...(replyTo === undefined ? {} : { replyTo }),
        body,
      };
      const roomProof = authSecret
        ? await signRoomOperation(authSecret, directoryRoomProofBody(request))
        : null;
      const bytes = await sealDirectory(
        DIRECTORY_REQUEST,
        { ...request, ...(roomProof ? { roomProof } : {}) },
        { publicKey: encodeKey(pair.publicKey), secretKey: pair.privateKey },
        config.publicKey,
      );
      if (
        generation !== this.generation ||
        !this.ready() ||
        this.pending.size >= 4 ||
        (!removal && !this.roomAuth(roomId))
      )
        throw new Error("Discover paused");
      return await new Promise<Reply>((resolve, reject) => {
        this.pending.set(id, {
          key: new Uint8Array(pair.privateKey),
          timer: setTimeout(() => this.fail(id), DIRECTORY_TIMEOUT_MS),
          resolve,
          reject,
        });
        try {
          this.send({
            id,
            recipient: config.address,
            bytes,
            anonymous: config.replyMode === "surb",
          });
        } catch {
          this.fail(id);
        }
      });
    } finally {
      pair.privateKey.fill(0);
    }
  }
  async list(room: string): Promise<PresenceEntry[]> {
    if (!isPublicKey(room)) throw new Error("Invalid room");
    const generation = this.generation,
      entries: PresenceEntry[] = [],
      cursors = new Set<string>();
    let after: string | null = null;
    for (let page = 0; page < Math.ceil(50 / DIRECTORY_PAGE_SIZE); page++) {
      const reply = await this.request({ op: "list", room, after });
      if (
        generation !== this.generation ||
        !this.ready() ||
        !this.roomAuth(room) ||
        !Array.isArray(reply.entries) ||
        reply.entries.length > DIRECTORY_PAGE_SIZE
      )
        throw new Error("Invalid directory response");
      for (const entry of reply.entries) {
        if (!entry || typeof entry !== "object")
          throw new Error("Invalid entry");
        const { onlineUntil, ...command } = entry;
        if (
          !isPresenceCommand(command) ||
          command.op !== "upsert" ||
          command.room !== room ||
          !Number.isSafeInteger(onlineUntil)
        )
          throw new Error("Invalid entry");
        entries.push(entry);
      }
      if (entries.length > 50) throw new Error("Directory limit");
      if (reply.next === null) return entries;
      if (
        typeof reply.next !== "string" ||
        !isPublicKey(reply.next) ||
        cursors.has(reply.next)
      )
        throw new Error("Invalid cursor");
      cursors.add(reply.next);
      after = reply.next;
    }
    throw new Error("Directory limit");
  }
  async publish(command: PresenceCommand) {
    if (!isPresenceCommand(command)) throw new Error("Invalid presence");
    await this.request(command);
  }
}
