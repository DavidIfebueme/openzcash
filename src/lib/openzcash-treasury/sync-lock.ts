import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import os from "node:os";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

/**
 * Single-worker lock for the offline treasury worker.
 *
 * The lock is a file beside the snapshot: its lines are the worker's PID, a
 * token unique to that start and the host name, and its modification time is
 * the worker's heartbeat. A worker that is killed without cleanup (out of memory,
 * SIGKILL, host restart) leaves the file behind; the next start recovers it
 * instead of failing until someone deletes it by hand.
 *
 * A PID is only judged on the host that issued it. A lock written elsewhere
 * (another container sharing the directory) or without a host (the format
 * before this module) is recovered by heartbeat age alone.
 */

/** Longest stretch between two heartbeats: one engine synchronization. */
export const TREASURY_SYNC_TIMEOUT_MS = 20 * 60_000;
/** A lock this old is abandoned even if its PID answers (the number was reused, or the worker is wedged). */
export const TREASURY_LOCK_STALE_MS = TREASURY_SYNC_TIMEOUT_MS + 5 * 60_000;

export interface TreasuryLockHolder {
  /** Recorded PID, or null when the file holds no usable one. */
  pid: number | null;
  /** Host that issued the PID, or null when the file names none. */
  host: string | null;
  /** Last heartbeat, in epoch milliseconds. */
  heartbeatMs: number;
}

export interface TreasuryLockContext {
  pid: number;
  host: string;
  now: number;
  staleAfterMs: number;
  isAlive: (pid: number) => boolean;
}

export interface TreasuryLockOptions {
  pid?: number;
  host?: string;
  now?: () => number;
  staleAfterMs?: number;
  isAlive?: (pid: number) => boolean;
}

export interface TreasuryLock {
  /** Heartbeat. Rejects with TreasuryLockLostError when the lock is no longer this worker's. */
  refresh(): Promise<void>;
  /** Removes the lock if it is still this worker's; another worker's lock is left alone. */
  release(): Promise<void>;
}

export class TreasuryLockHeldError extends Error {
  constructor(holder: TreasuryLockHolder | null, now: number) {
    const where = holder?.host ? ` on ${holder.host}` : "";
    const who = holder?.pid
      ? `PID ${holder.pid}${where}`
      : "an unidentified process";
    const age = holder
      ? `, last heartbeat ${Math.round((now - holder.heartbeatMs) / 1000)} s ago`
      : "";
    super(`Another treasury worker holds the lock (${who}${age})`);
    this.name = "TreasuryLockHeldError";
  }
}

export class TreasuryLockLostError extends Error {
  constructor() {
    super("The treasury lock is no longer held by this worker");
    this.name = "TreasuryLockLostError";
  }
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error
    ? (error as NodeJS.ErrnoException).code
    : undefined;
}

/** Signal 0 only tests for existence. EPERM means the process exists under another user. */
function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return errorCode(error) === "EPERM";
  }
}

/** Decides whether an existing lock may be recovered. Pure, so every rule is testable. */
export function lockIsAbandoned(
  holder: TreasuryLockHolder,
  context: TreasuryLockContext,
): boolean {
  // No heartbeat for longer than a full synchronization, or a stamp no live worker could have written.
  if (Math.abs(context.now - holder.heartbeatMs) > context.staleAfterMs)
    return true;
  // Recent but unreadable: possibly a worker caught between creating the file and writing to it.
  if (holder.pid === null) return false;
  // A PID says nothing outside the host that issued it; there the heartbeat alone decides.
  if (holder.host !== context.host) return false;
  // A restarted container hands out the same PIDs again; this process is not the previous holder.
  if (holder.pid === context.pid) return true;
  return !context.isAlive(holder.pid);
}

interface StoredLock extends TreasuryLockHolder {
  content: string;
}

async function readLock(lockPath: string): Promise<StoredLock | null> {
  try {
    const [content, { mtimeMs }] = await Promise.all([
      readFile(lockPath, "utf8"),
      stat(lockPath),
    ]);
    // PID 0 and negative numbers address process groups; never hand them to kill().
    const lines = content.split("\n");
    const pid = /^[1-9]\d{0,9}$/.exec(lines[0])?.[0];
    return {
      content,
      pid: pid ? Number(pid) : null,
      host: lines[2] || null,
      heartbeatMs: mtimeMs,
    };
  } catch (error) {
    if (errorCode(error) === "ENOENT") return null;
    throw error;
  }
}

/**
 * Removes the lock only if it still holds `expected`. The rename is atomic, so
 * of several workers recovering one abandoned lock exactly one moves it. A lock
 * that visibly changed is not touched; one that changed in the instant between
 * the check and the rename is put back.
 */
export async function removeLockIfUnchanged(
  lockPath: string,
  expected: string,
  tag: string,
): Promise<boolean> {
  const aside = `${lockPath}.${tag}.aside`;
  try {
    if ((await readFile(lockPath, "utf8")) !== expected) return false;
    await rename(lockPath, aside);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return false;
    throw error;
  }
  try {
    if ((await readFile(aside, "utf8")) === expected) return true;
    try {
      await copyFile(aside, lockPath, constants.COPYFILE_EXCL);
    } catch (error) {
      // A third worker took the free slot meanwhile; the displaced one stops at its next heartbeat.
      if (errorCode(error) !== "EEXIST") throw error;
    }
    return false;
  } finally {
    await unlink(aside);
  }
}

async function createLock(
  lockPath: string,
  content: string,
  now: number,
): Promise<boolean> {
  try {
    await writeFile(lockPath, content, { flag: "wx", mode: 0o644 });
  } catch (error) {
    if (errorCode(error) === "EEXIST") return false;
    throw error;
  }
  try {
    await utimes(lockPath, new Date(now), new Date(now));
  } catch (error) {
    // Gone for an instant: a worker recovering the previous lock moved this one
    // aside before noticing it was new, and puts it back.
    if (errorCode(error) !== "ENOENT") throw error;
  }
  return true;
}

/**
 * Takes the lock, recovering one that a dead worker left behind.
 * Rejects with TreasuryLockHeldError when a worker is really running.
 */
export async function acquireTreasuryLock(
  lockPath: string,
  options: TreasuryLockOptions = {},
): Promise<TreasuryLock> {
  const pid = options.pid ?? process.pid;
  const now = options.now ?? Date.now;
  const staleAfterMs = options.staleAfterMs ?? TREASURY_LOCK_STALE_MS;
  const isAlive = options.isAlive ?? processIsAlive;
  const host = options.host ?? os.hostname();
  const token = randomUUID();
  const content = `${pid}\n${token}\n${host}\n`;
  const owns = async () => (await readLock(lockPath))?.content === content;
  const lock: TreasuryLock = {
    async refresh() {
      if (!(await owns())) throw new TreasuryLockLostError();
      await utimes(lockPath, new Date(now()), new Date(now()));
    },
    async release() {
      await removeLockIfUnchanged(lockPath, content, token);
    },
  };

  await mkdir(path.dirname(lockPath), { recursive: true });
  let holder: StoredLock | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await createLock(lockPath, content, now())) return lock;
    holder = await readLock(lockPath);
    if (!holder) continue; // released between the two calls
    if (
      !lockIsAbandoned(holder, {
        pid,
        host,
        now: now(),
        staleAfterMs,
        isAlive,
      })
    )
      break;
    await removeLockIfUnchanged(lockPath, holder.content, token);
  }
  throw new TreasuryLockHeldError(holder, now());
}
