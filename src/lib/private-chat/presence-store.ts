import { INVITE_TTL_MS, verifySignature } from "./live-invite";
import {
  isPresenceCommand,
  presenceBody,
  presenceRoomBody,
  PRESENCE_LEASE_MS,
  type PresenceCommand,
  type PresenceEntry,
} from "./presence";
type Stored = {
  command: PresenceCommand;
  appliedAt: number;
  revision: number;
  forgetAt: number;
  room: string;
  entry: PresenceEntry | null;
};
const MAX_SNAPSHOT_RECORDS = 500;
export type PresenceSnapshot = {
  version: 1;
  takenAt: number;
  records: Array<{
    command: PresenceCommand;
    appliedAt: number;
    revision: number;
    forgetAt: number;
    entry: PresenceEntry | null;
  }>;
};
export type PresenceStoreOptions = {
  maxRecords?: number;
  maxPerRoom?: number;
  maxTombstonesPerRoom?: number;
  allowedRooms?: ReadonlyMap<string, number>;
};
/** Local preview: bounded process memory. Only sealed presence and short-lived tombstones are stored. */
export class PresenceStore {
  private records = new Map<string, Stored>();
  constructor(private options: PresenceStoreOptions = {}) {}
  private roomLimit(room: string) {
    if (this.options.allowedRooms)
      return this.options.allowedRooms.get(room) ?? 0;
    return this.options.maxPerRoom ?? 50;
  }
  private totalLimit() {
    if (this.options.allowedRooms)
      return [...this.options.allowedRooms.values()].reduce(
        (sum, slots) => sum + slots + this.tombstoneLimit(slots),
        0,
      );
    return this.options.maxRecords ?? 200;
  }
  private tombstoneLimit(slots: number) {
    return this.options.maxTombstonesPerRoom ?? Math.max(20, slots * 4);
  }
  private roomOccupancy(room: string, now: number) {
    let active = 0;
    let inactive = 0;
    for (const record of this.records.values()) {
      if (record.room !== room) continue;
      if (record.entry && record.entry.onlineUntil > now) active++;
      else inactive++;
    }
    return { active, inactive };
  }
  private prune(now: number) {
    for (const [key, record] of this.records)
      if (record.forgetAt <= now) this.records.delete(key);
  }
  list(room: string, now = Date.now()): PresenceEntry[] {
    this.prune(now);
    return [...this.records.values()].flatMap((record) =>
      record.room === room && record.entry && record.entry.onlineUntil > now
        ? [{ ...record.entry }]
        : [],
    );
  }
  snapshot(now = Date.now()): PresenceSnapshot {
    this.prune(now);
    return {
      version: 1,
      takenAt: now,
      records: [...this.records.values()].map((record) => ({
        command: { ...record.command },
        appliedAt: record.appliedAt,
        revision: record.revision,
        forgetAt: record.forgetAt,
        entry: record.entry ? { ...record.entry } : null,
      })),
    };
  }
  /** Validate a persisted snapshot atomically, preserving original lease times. */
  async restore(value: unknown, now = Date.now()): Promise<void> {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Invalid presence snapshot");
    const snapshot = value as PresenceSnapshot;
    if (
      snapshot.version !== 1 ||
      !Number.isSafeInteger(snapshot.takenAt) ||
      snapshot.takenAt > now + 30_000 ||
      !Array.isArray(snapshot.records) ||
      snapshot.records.length > MAX_SNAPSHOT_RECORDS
    )
      throw new Error("Invalid presence snapshot");
    const next = new Map<string, Stored>();
    const counts = new Map<string, { active: number; inactive: number }>();
    for (const item of snapshot.records) {
      const c = item?.command;
      if (
        !isPresenceCommand(c) ||
        !Number.isSafeInteger(item.revision) ||
        item.revision !== c.revision ||
        !Number.isSafeInteger(item.appliedAt) ||
        item.appliedAt < 0 ||
        item.appliedAt > snapshot.takenAt ||
        c.expiresAt <= item.appliedAt ||
        c.expiresAt > item.appliedAt + INVITE_TTL_MS + 30_000 ||
        !Number.isSafeInteger(item.forgetAt) ||
        item.forgetAt < c.expiresAt ||
        item.forgetAt > snapshot.takenAt + INVITE_TTL_MS + 30_000 ||
        !(await verifySignature(c.owner, presenceBody(c), c.signature)) ||
        !(await verifySignature(c.room, presenceRoomBody(c), c.roomProof))
      )
        throw new Error("Invalid presence snapshot");
      const key = `${c.room}:${c.owner}`;
      if (next.has(key)) throw new Error("Duplicate presence snapshot entry");
      if (c.op === "upsert") {
        const e = item.entry;
        if (
          !e ||
          !Number.isSafeInteger(e.onlineUntil) ||
          e.onlineUntil !== Math.min(c.expiresAt, item.appliedAt + PRESENCE_LEASE_MS) ||
          JSON.stringify({ ...e, onlineUntil: undefined }) !==
            JSON.stringify({ ...c, onlineUntil: undefined })
        )
          throw new Error("Invalid presence lease");
      } else if (item.entry !== null)
        throw new Error("Invalid presence tombstone");
      // A de-admitted room may leave signed, already-expired records behind.
      // Validate their integrity, then prune them before admission checks.
      if (item.forgetAt <= now) continue;
      if (this.roomLimit(c.room) <= 0)
        throw new Error("Presence room no longer admitted");
      const count = counts.get(c.room) ?? { active: 0, inactive: 0 };
      if (item.entry && item.entry.onlineUntil > snapshot.takenAt)
        count.active++;
      else count.inactive++;
      if (
        count.active > this.roomLimit(c.room) ||
        count.inactive > this.tombstoneLimit(this.roomLimit(c.room)) + this.roomLimit(c.room)
      )
        throw new Error("Presence room capacity exceeded");
      counts.set(c.room, count);
      if (next.size >= this.totalLimit())
        throw new Error("Presence snapshot capacity exceeded");
      next.set(key, {
        command: { ...c },
        appliedAt: item.appliedAt,
        revision: item.revision,
        forgetAt: item.forgetAt,
        room: c.room,
        entry: item.entry ? { ...item.entry } : null,
      });
    }
    this.records = next;
  }
  async apply(value: unknown, now = Date.now()): Promise<number> {
    this.prune(now);
    if (!isPresenceCommand(value)) return 400;
    const c: PresenceCommand = value;
    if (this.roomLimit(c.room) <= 0) return 403;
    if (
      c.expiresAt <= now ||
      c.expiresAt > now + INVITE_TTL_MS + 30_000 ||
      !(await verifySignature(c.owner, presenceBody(c), c.signature)) ||
      !(await verifySignature(c.room, presenceRoomBody(c), c.roomProof))
    )
      return 403;
    const key = `${c.room}:${c.owner}`;
    // Recheck after crypto awaits. A late heartbeat cannot undo a newer removal.
    const previous = this.records.get(key);
    if (previous && previous.revision >= c.revision) return 409;
    if (!previous && c.op === "remove") return 404;
    const occupancy = this.roomOccupancy(c.room, now);
    if (!previous && this.records.size >= this.totalLimit()) return 503;
    if (
      c.op === "upsert" &&
      (!previous || !previous.entry || previous.entry.onlineUntil <= now) &&
      occupancy.active >= this.roomLimit(c.room)
    )
      return 503;
    if (
      !previous &&
      occupancy.inactive >= this.tombstoneLimit(this.roomLimit(c.room))
    )
      return 503;
    this.records.set(key, {
      command: { ...c },
      appliedAt: now,
      room: c.room,
      revision: c.revision,
      forgetAt: Math.max(previous?.forgetAt ?? 0, c.expiresAt),
      entry:
        c.op === "upsert"
          ? {
              ...c,
              onlineUntil: Math.min(now + PRESENCE_LEASE_MS, c.expiresAt),
            }
          : null,
    });
    return 200;
  }
}
