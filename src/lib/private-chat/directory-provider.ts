import { isNymAddress } from "./nym-address";
import { isMessageId } from "./messages";
import { PresenceStore } from "./presence-store";
import { isPresenceCommand } from "./presence";
import { isPublicKey } from "./keys";
import { verifySignature } from "./live-invite";
import {
  DIRECTORY_HEADER,
  DIRECTORY_PAGE_SIZE,
  DIRECTORY_REQUEST,
  DIRECTORY_REQUEST_PADDING,
  DIRECTORY_RESPONSE,
  DIRECTORY_TIMEOUT_MS,
  directoryRoomProofBody,
  openDirectory,
  sealDirectory,
  type DirectoryReplyMode,
} from "./directory-wire";

type BoxIdentity = { publicKey: string; secretKey: Uint8Array };
export type DirectoryReply =
  | { bytes: Uint8Array; recipient: string; replyTag?: never }
  | { bytes: Uint8Array; replyTag: Uint8Array; recipient?: never };
export type DirectoryProviderOptions = {
  replyMode?: DirectoryReplyMode;
  /** Production admits only pre-registered public room IDs, each with reserved slots. */
  allowedRooms?: ReadonlyMap<string, number>;
  maxRequestsPerMinute?: number;
  maxPerRoomPerMinute?: number;
  store?: PresenceStore;
};

/** Service-side handler. Requests and replies remain inside the Nym transport. */
export class DirectoryProvider {
  private store: PresenceStore;
  private seen = new Map<string, number>();
  private inFlight = 0;
  private budget: number;
  private rejectBudget = 32;
  private window = 0;
  private roomBudgets = new Map<string, { window: number; budget: number }>();
  private replyMode: DirectoryReplyMode;
  private allowedRooms: ReadonlyMap<string, number> | undefined;
  private maxRequests: number;
  private maxRoomRequests: number;
  private serialized: Promise<void> = Promise.resolve();

  private async oneAtATime<T>(work: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => { release = resolve; });
    const previous = this.serialized;
    this.serialized = previous.then(() => next);
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }

  constructor(
    private identity: BoxIdentity,
    private clock = Date.now,
    options: DirectoryProviderOptions = {},
  ) {
    this.replyMode = options.replyMode ?? "address";
    this.allowedRooms = options.allowedRooms
      ? new Map(options.allowedRooms)
      : undefined;
    if (
      process.env.NODE_ENV === "production" &&
      (this.replyMode !== "surb" || !this.allowedRooms?.size)
    )
      throw new Error("Production directory requires SURBs and admitted rooms");
    for (const [id, slots] of this.allowedRooms ?? [])
      if (!isPublicKey(id) || !Number.isSafeInteger(slots) || slots < 1 || slots > 50)
        throw new Error("Invalid room capacity");
    this.maxRequests = options.maxRequestsPerMinute ?? 120;
    this.maxRoomRequests =
      options.maxPerRoomPerMinute ??
      Math.max(1, Math.floor(this.maxRequests / (this.allowedRooms?.size || 2)));
    if (
      !Number.isSafeInteger(this.maxRequests) ||
      !Number.isSafeInteger(this.maxRoomRequests) ||
      this.maxRequests < 1 ||
      this.maxRoomRequests < 1
    )
      throw new Error("Invalid directory budget");
    this.budget = this.maxRequests;
    this.store =
      options.store ?? new PresenceStore({ allowedRooms: this.allowedRooms });
  }

  async handle(
    bytes: Uint8Array,
    replyTag?: Uint8Array,
  ): Promise<DirectoryReply | null> {
    // Reject impossible frames before allocating, decrypting or consuming quota.
    if (
      bytes.length !== DIRECTORY_REQUEST_PADDING + DIRECTORY_HEADER ||
      this.inFlight >= 8 ||
      (this.replyMode === "surb" && replyTag?.length !== 16) ||
      (this.replyMode === "address" && replyTag !== undefined)
    )
      return null;
    this.inFlight++;
    try {
      const opened = await openDirectory(
        bytes,
        DIRECTORY_REQUEST,
        this.identity.secretKey,
      );
      if (!opened || !opened.value || typeof opened.value !== "object")
        return null;
      const q = opened.value as {
        v: number;
        id: string;
        at: number;
        replyTo?: string;
        body: unknown;
        roomProof?: string;
      };
      const now = this.clock();
      if (
        q.v !== 1 ||
        typeof q.id !== "string" ||
        !isMessageId(q.id) ||
        !Number.isSafeInteger(q.at) ||
        Math.abs(now - q.at) > DIRECTORY_TIMEOUT_MS ||
        (this.replyMode === "address" &&
          (!q.replyTo || !isNymAddress(q.replyTo)))
      )
        return null;
      const body = q.body as {
        op?: string;
        room?: string;
        after?: string | null;
      } | null;
      if (!body || typeof body.room !== "string" || !isPublicKey(body.room))
        return null;
      const requestedRoom = body.room;
      const list =
        body.op === "list" &&
        (body.after === null ||
          (typeof body.after === "string" && isPublicKey(body.after))) &&
        Object.keys(body).sort().join(",") === "after,op,room";
      const publish = isPresenceCommand(body);
      if (!list && !publish) return null;
      const removal = publish && body.op === "remove";
      const baseKeys = this.replyMode === "address"
        ? "at,body,id,replyTo,v"
        : "at,body,id,v";
      if (
        Object.keys(q).sort().join(",") !==
          (q.roomProof === undefined
            ? baseKeys
            : this.replyMode === "address"
              ? "at,body,id,replyTo,roomProof,v"
              : "at,body,id,roomProof,v") ||
        (!removal && typeof q.roomProof !== "string") ||
        (q.roomProof !== undefined && typeof q.roomProof !== "string")
      )
        return null;
      if (this.allowedRooms && !this.allowedRooms.has(requestedRoom)) return null;
      if (
        q.roomProof !== undefined &&
        !(await verifySignature(requestedRoom, directoryRoomProofBody(q as Parameters<typeof directoryRoomProofBody>[0]), q.roomProof))
      )
        return null;
      return await this.oneAtATime(async () => {
      const now = this.clock();
      // Invalid frames, unknown rooms and replay attempts cannot consume the
      // valid-room reply budget. Each admitted room has a separate share.
      for (const [id, until] of this.seen)
        if (until <= now) this.seen.delete(id);
      for (const [roomId, limit] of this.roomBudgets)
        if (now < limit.window || now - limit.window >= 60_000)
          this.roomBudgets.delete(roomId);
      if (!this.roomBudgets.has(requestedRoom) && this.roomBudgets.size >= 64)
        return null;
      const replayKey = opened.sender + q.id;
      if (this.seen.has(replayKey) || this.seen.size >= 512) return null;
      if (now < this.window || now - this.window >= 60_000) {
        this.window = now;
        this.budget = this.maxRequests;
        this.rejectBudget = 32;
      }
      const roomBudget = this.roomBudgets.get(requestedRoom);
      const fresh =
        !roomBudget || now < roomBudget.window || now - roomBudget.window >= 60_000;
      const available = fresh ? this.maxRoomRequests : roomBudget!.budget;
      if (this.budget <= 0 || available <= 0) return null;
      let result: object;
      if (list) {
        const all = this.store
          .list(requestedRoom, now)
          .sort((a, b) => (a.owner < b.owner ? -1 : 1))
          .filter((e) => !body.after || e.owner > body.after);
        const entries = all.slice(0, DIRECTORY_PAGE_SIZE);
        result = {
          status: 200,
          entries,
          next: all.length > entries.length ? entries.at(-1)!.owner : null,
        };
      } else {
        result = { status: await this.store.apply(body, now) };
      }
      if ("status" in result && result.status !== 200) {
        if (this.rejectBudget <= 0) return null;
        this.rejectBudget--;
      } else {
        this.budget--;
        this.roomBudgets.set(requestedRoom, {
          window: fresh ? now : roomBudget!.window,
          budget: available - 1,
        });
      }
      this.seen.set(replayKey, now + DIRECTORY_TIMEOUT_MS * 2);
      const response = await sealDirectory(
        DIRECTORY_RESPONSE,
        { v: 1, id: q.id, ...result },
        this.identity,
        opened.sender,
      );
      return this.replyMode === "surb"
        ? { bytes: response, replyTag: new Uint8Array(replyTag!) }
        : { bytes: response, recipient: q.replyTo! };
      });
    } finally {
      this.inFlight--;
    }
  }
}
