import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  unlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  acquireTreasuryLock,
  lockIsAbandoned,
  removeLockIfUnchanged,
  TreasuryLockHeldError,
  TreasuryLockLostError,
  TREASURY_LOCK_STALE_MS,
  TREASURY_SYNC_TIMEOUT_MS,
  type TreasuryLockOptions,
} from "./sync-lock";

const MINUTE = 60_000;
const T0 = Date.parse("2026-11-12T12:00:00.000Z");
const HOST = "treasury-host";
const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function location() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "treasury-lock-test-"));
  dirs.push(dir);
  return path.join(dir, "runtime", "sync.lock");
}

/** A movable clock, so no test waits for real minutes to pass. */
function clock(start = T0) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

const alive = () => true;
const dead = () => false;

/** A worker on HOST whose every other process answers, unless a test says otherwise. */
function worker(
  pid: number,
  overrides: TreasuryLockOptions = {},
): TreasuryLockOptions {
  return { pid, host: HOST, now: () => T0, isAlive: alive, ...overrides };
}

/** The file a worker killed without cleanup leaves behind. */
async function leftover(
  lockPath: string,
  heartbeat: number,
  content: string,
): Promise<void> {
  await mkdir(path.dirname(lockPath), { recursive: true });
  await writeFile(lockPath, content);
  await utimes(lockPath, new Date(heartbeat), new Date(heartbeat));
}

const stored = (pid: number, host = HOST) => `${pid}\nearlier-start\n${host}\n`;
/** What the worker wrote before this module existed: the PID alone. */
const oldFormat = (pid: number) => `${pid}\n`;
const firstLine = async (lockPath: string) =>
  (await readFile(lockPath, "utf8")).split("\n")[0];

describe("lockIsAbandoned", () => {
  const context = {
    pid: 500,
    host: HOST,
    now: T0,
    staleAfterMs: TREASURY_LOCK_STALE_MS,
    isAlive: alive,
  };
  const recent = { pid: 400, host: HOST, heartbeatMs: T0 - MINUTE };

  it("keeps a lock whose worker answers and refreshed it recently", () => {
    expect(lockIsAbandoned(recent, context)).toBe(false);
  });

  it("gives up a lock whose recorded process no longer exists", () => {
    expect(lockIsAbandoned(recent, { ...context, isAlive: dead })).toBe(true);
  });

  it("gives up a lock that records this very PID on this host: a restarted container hands the number to a new process", () => {
    expect(lockIsAbandoned({ ...recent, pid: 500 }, context)).toBe(true);
  });

  it("gives up a lock that was not refreshed within the threshold, even when the PID answers", () => {
    const at = (heartbeatMs: number) => ({ ...recent, heartbeatMs });
    expect(lockIsAbandoned(at(T0 - TREASURY_LOCK_STALE_MS - 1), context)).toBe(
      true,
    );
    expect(lockIsAbandoned(at(T0 - TREASURY_LOCK_STALE_MS), context)).toBe(
      false,
    );
  });

  it("gives up a lock stamped further in the future than any live worker could write", () => {
    expect(
      lockIsAbandoned(
        { ...recent, heartbeatMs: T0 + TREASURY_LOCK_STALE_MS + 1 },
        context,
      ),
    ).toBe(true);
  });

  it("waits out the threshold when the lock records no usable PID", () => {
    const unreadable = { ...recent, pid: null };
    expect(lockIsAbandoned(unreadable, { ...context, isAlive: dead })).toBe(
      false,
    );
    expect(
      lockIsAbandoned(
        { ...unreadable, heartbeatMs: T0 - TREASURY_LOCK_STALE_MS - 1 },
        context,
      ),
    ).toBe(true);
  });

  it("does not judge a PID issued by another host: there only the heartbeat counts", () => {
    const elsewhere = { ...recent, host: "another-container" };
    expect(lockIsAbandoned(elsewhere, { ...context, isAlive: dead })).toBe(
      false,
    );
    expect(lockIsAbandoned({ ...elsewhere, pid: 500 }, context)).toBe(false);
    expect(
      lockIsAbandoned(
        { ...elsewhere, heartbeatMs: T0 - TREASURY_LOCK_STALE_MS - 1 },
        context,
      ),
    ).toBe(true);
  });

  it("does not judge the PID of a lock that records no host", () => {
    const unknownHost = { ...recent, host: null };
    expect(lockIsAbandoned(unknownHost, { ...context, isAlive: dead })).toBe(
      false,
    );
  });
});

describe("acquireTreasuryLock", () => {
  it("leaves more than one full synchronization between heartbeats before a lock counts as abandoned", () => {
    // The worker refreshes before and after each engine synchronization; the ledger read and the pause are far shorter.
    expect(TREASURY_SYNC_TIMEOUT_MS).toBe(20 * MINUTE);
    expect(TREASURY_LOCK_STALE_MS).toBeGreaterThanOrEqual(
      TREASURY_SYNC_TIMEOUT_MS + 5 * MINUTE,
    );
  });

  it("creates the runtime directory and the lock with its PID first and its host recorded, and removes it on release", async () => {
    const lockPath = await location();
    const lock = await acquireTreasuryLock(lockPath, worker(4242));
    const lines = (await readFile(lockPath, "utf8")).split("\n");
    expect(lines[0]).toBe("4242");
    expect(lines[2]).toBe(HOST);
    expect((await stat(lockPath)).mtimeMs).toBe(T0);
    await lock.release();
    await expect(stat(lockPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("refuses to start beside a worker that is running, and leaves its lock untouched", async () => {
    const lockPath = await location();
    const time = clock();
    await acquireTreasuryLock(lockPath, worker(400, { now: time.now }));
    const before = await readFile(lockPath, "utf8");
    time.advance(5 * MINUTE);
    const refused = await acquireTreasuryLock(
      lockPath,
      worker(500, { now: time.now }),
    ).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(TreasuryLockHeldError);
    expect((refused as Error).message).toContain(
      "PID 400 on treasury-host, last heartbeat 300 s ago",
    );
    expect(await readFile(lockPath, "utf8")).toBe(before);
  });

  it("refuses to start beside a worker in another container that shares the directory, even one with the same PID", async () => {
    const lockPath = await location();
    const first = await acquireTreasuryLock(
      lockPath,
      worker(7, { host: "container-a" }),
    );
    for (const isAlive of [alive, dead]) {
      await expect(
        acquireTreasuryLock(
          lockPath,
          worker(7, { host: "container-b", isAlive }),
        ),
      ).rejects.toBeInstanceOf(TreasuryLockHeldError);
    }
    await expect(first.refresh()).resolves.toBeUndefined();
  });

  it("recovers the lock a killed worker left behind", async () => {
    const lockPath = await location();
    await leftover(lockPath, T0 - MINUTE, stored(93116));
    const lock = await acquireTreasuryLock(
      lockPath,
      worker(500, { isAlive: dead }),
    );
    expect(await firstLine(lockPath)).toBe("500");
    await lock.release();
    await expect(stat(lockPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("recovers a lock that records its own PID, as after a container restart", async () => {
    const lockPath = await location();
    await leftover(lockPath, T0 - MINUTE, stored(500));
    const lock = await acquireTreasuryLock(lockPath, worker(500));
    expect((await readFile(lockPath, "utf8")).split("\n")[1]).not.toBe(
      "earlier-start",
    );
    await lock.release();
  });

  it("recovers a lock whose PID answers but whose heartbeat stopped: the number went to another process", async () => {
    const lockPath = await location();
    await leftover(lockPath, T0 - TREASURY_LOCK_STALE_MS - MINUTE, stored(400));
    const lock = await acquireTreasuryLock(lockPath, worker(500));
    expect(await firstLine(lockPath)).toBe("500");
    await lock.release();
  });

  it("recovers an old-format lock by age only, since it names no host", async () => {
    const lockPath = await location();
    await leftover(lockPath, T0 - MINUTE, oldFormat(93116));
    await expect(
      acquireTreasuryLock(lockPath, worker(500, { isAlive: dead })),
    ).rejects.toBeInstanceOf(TreasuryLockHeldError);
    expect(await readFile(lockPath, "utf8")).toBe(oldFormat(93116));
    await leftover(lockPath, T0 - 24 * 60 * MINUTE, oldFormat(93116));
    const lock = await acquireTreasuryLock(lockPath, worker(500));
    expect(await firstLine(lockPath)).toBe("500");
    await lock.release();
  });

  it("does not seize an unreadable lock while it is recent, and recovers it once it is old", async () => {
    const lockPath = await location();
    await leftover(lockPath, T0 - MINUTE, "");
    await expect(
      acquireTreasuryLock(lockPath, worker(500, { isAlive: dead })),
    ).rejects.toBeInstanceOf(TreasuryLockHeldError);
    expect(await readFile(lockPath, "utf8")).toBe("");
    await leftover(
      lockPath,
      T0 - TREASURY_LOCK_STALE_MS - MINUTE,
      "not a pid\n",
    );
    const lock = await acquireTreasuryLock(
      lockPath,
      worker(500, { isAlive: dead }),
    );
    await lock.release();
  });

  it("never probes PID 0 or a negative PID, which would signal a whole process group", async () => {
    const lockPath = await location();
    const probed: number[] = [];
    const isAlive = (pid: number) => {
      probed.push(pid);
      return false;
    };
    for (const pid of ["0", "-1", "1e3", "12 34"]) {
      await leftover(lockPath, T0 - MINUTE, `${pid}\nearlier-start\n${HOST}\n`);
      await expect(
        acquireTreasuryLock(lockPath, worker(500, { isAlive })),
      ).rejects.toBeInstanceOf(TreasuryLockHeldError);
    }
    expect(probed).toEqual([]);
  });

  it("keeps a long-running worker's lock alive through its heartbeat", async () => {
    const lockPath = await location();
    const time = clock();
    const lock = await acquireTreasuryLock(
      lockPath,
      worker(400, { now: time.now }),
    );
    time.advance(24 * MINUTE);
    await lock.refresh();
    expect((await stat(lockPath)).mtimeMs).toBe(T0 + 24 * MINUTE);
    time.advance(24 * MINUTE);
    await expect(
      acquireTreasuryLock(lockPath, worker(500, { now: time.now })),
    ).rejects.toBeInstanceOf(TreasuryLockHeldError);
    time.advance(2 * MINUTE);
    const successor = await acquireTreasuryLock(
      lockPath,
      worker(500, { now: time.now }),
    );
    await successor.release();
  });

  it("stops a worker whose lock was taken over, without touching the new owner's lock", async () => {
    const lockPath = await location();
    const time = clock();
    const wedged = await acquireTreasuryLock(
      lockPath,
      worker(400, { now: time.now }),
    );
    time.advance(TREASURY_LOCK_STALE_MS + MINUTE);
    const successor = await acquireTreasuryLock(
      lockPath,
      worker(500, { now: time.now }),
    );
    const owned = await readFile(lockPath, "utf8");
    await expect(wedged.refresh()).rejects.toBeInstanceOf(
      TreasuryLockLostError,
    );
    await wedged.release();
    expect(await readFile(lockPath, "utf8")).toBe(owned);
    await successor.refresh();
    await successor.release();
    await expect(stat(lockPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("stops a worker whose lock file was removed under it", async () => {
    const lockPath = await location();
    const lock = await acquireTreasuryLock(lockPath, worker(400));
    await unlink(lockPath);
    await expect(lock.refresh()).rejects.toBeInstanceOf(TreasuryLockLostError);
    await expect(lock.release()).resolves.toBeUndefined();
  });

  it("tells two starts with the same PID on one host apart", async () => {
    const lockPath = await location();
    const first = await acquireTreasuryLock(lockPath, worker(7));
    const second = await acquireTreasuryLock(lockPath, worker(7));
    await expect(first.refresh()).rejects.toBeInstanceOf(TreasuryLockLostError);
    await first.release();
    await expect(second.refresh()).resolves.toBeUndefined();
    await second.release();
  });

  it("lets exactly one of several workers that start together recover an abandoned lock", async () => {
    // The real clock throughout: a new lock's first timestamp comes from the filesystem.
    const lockPath = await location();
    const real = { now: Date.now };
    for (let round = 0; round < 20; round += 1) {
      await leftover(
        lockPath,
        Date.now() - TREASURY_LOCK_STALE_MS - MINUTE,
        stored(400),
      );
      const starts = await Promise.allSettled(
        [501, 502, 503, 504, 505, 506].map((pid) =>
          acquireTreasuryLock(lockPath, worker(pid, real)),
        ),
      );
      const heartbeats = await Promise.allSettled(
        starts.map((start) =>
          start.status === "fulfilled"
            ? start.value.refresh()
            : Promise.reject(start.reason),
        ),
      );
      expect(
        heartbeats.filter((beat) => beat.status === "fulfilled"),
      ).toHaveLength(1);
      for (const start of starts) {
        if (start.status === "rejected")
          expect(start.reason).toBeInstanceOf(TreasuryLockHeldError);
      }
      expect(await readdir(path.dirname(lockPath))).toEqual(["sync.lock"]);
      await unlink(lockPath);
    }
  });

  it("checks real processes by default: a finished child is gone, the parent of this test is not", async () => {
    const lockPath = await location();
    const child = spawnSync(process.execPath, ["-e", ""]);
    expect(child.status).toBe(0);
    await leftover(lockPath, Date.now(), stored(child.pid, os.hostname()));
    const lock = await acquireTreasuryLock(lockPath);
    const lines = (await readFile(lockPath, "utf8")).split("\n");
    expect(lines[0]).toBe(String(process.pid));
    expect(lines[2]).toBe(os.hostname());
    await lock.release();

    expect(process.ppid).toBeGreaterThan(0);
    await leftover(lockPath, Date.now(), stored(process.ppid, os.hostname()));
    await expect(acquireTreasuryLock(lockPath)).rejects.toBeInstanceOf(
      TreasuryLockHeldError,
    );
  });
});

describe("removeLockIfUnchanged", () => {
  it("removes the lock that was inspected", async () => {
    const lockPath = await location();
    await leftover(lockPath, T0, stored(400));
    expect(await removeLockIfUnchanged(lockPath, stored(400), "test")).toBe(
      true,
    );
    await expect(stat(lockPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("leaves a lock that another worker created after the inspection", async () => {
    const lockPath = await location();
    await leftover(lockPath, T0, stored(600));
    expect(await removeLockIfUnchanged(lockPath, stored(400), "test")).toBe(
      false,
    );
    expect(await readFile(lockPath, "utf8")).toBe(stored(600));
    expect((await stat(lockPath)).mtimeMs).toBe(T0);
    expect(await readdir(path.dirname(lockPath))).toEqual(["sync.lock"]);
  });

  it("reports nothing removed when the lock is already gone", async () => {
    const lockPath = await location();
    await leftover(lockPath, T0, stored(400));
    await unlink(lockPath);
    expect(await removeLockIfUnchanged(lockPath, stored(400), "test")).toBe(
      false,
    );
  });
});
