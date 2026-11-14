import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import net from "node:net";
import {
  mkdir,
  mkdtemp,
  symlink,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  chownTree,
  clearLeftoverLocks,
  ensureTreasuryEngine,
  restartDelayMs,
  superviseProcess,
  treasuryChildEnv,
  treasuryEngineIdentity,
  treasuryRuntimeConfig,
  TREASURY_ENGINE,
  TREASURY_ENGINE_UID,
  waitForPort,
  type ChildHandle,
  type TreasuryEngineRelease,
} from "./runtime";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});
async function scratch() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "treasury-runtime-test-"));
  dirs.push(dir);
  return dir;
}

const ENABLED = {
  OPENZCASH_TREASURY_RUNTIME: "enabled",
  OPENZCASH_TREASURY_SNAPSHOT_PATH: "/data/openzcash-treasury/snapshot.json",
};

describe("treasuryRuntimeConfig", () => {
  it("stays off unless it is switched on explicitly", () => {
    for (const value of [undefined, "", "1", "true", "ENABLED"]) {
      const decision = treasuryRuntimeConfig({
        ...ENABLED,
        OPENZCASH_TREASURY_RUNTIME: value,
      });
      expect(decision.enabled).toBe(false);
    }
  });

  it("refuses to start without an absolute snapshot path outside the application directory", () => {
    const cwd = "/app";
    for (const snapshot of [
      undefined,
      "",
      ".cache/openzcash-treasury/snapshot.json",
      "/app/.cache/openzcash-treasury/snapshot.json",
      "/snapshot.json",
    ]) {
      const decision = treasuryRuntimeConfig(
        { ...ENABLED, OPENZCASH_TREASURY_SNAPSHOT_PATH: snapshot },
        cwd,
      );
      expect(decision).toMatchObject({ enabled: false });
      expect(decision.enabled ? "" : decision.reason).toMatch(/snapshot/i);
    }
  });

  it("derives the whole runtime from the snapshot path", () => {
    const decision = treasuryRuntimeConfig(ENABLED, "/app");
    if (!decision.enabled) throw new Error(decision.reason);
    expect(decision.config).toEqual({
      dir: "/data/openzcash-treasury",
      snapshotPath: "/data/openzcash-treasury/snapshot.json",
      engineBin: "/data/openzcash-treasury/bin/zkool_graphql-6.36.0",
      engineManaged: true,
      enginePort: 18232,
      // The flags documented for a local engine that holds only the public viewing key.
      engineArgs: [
        "--db-path",
        "/data/openzcash-treasury/engine/treasury.db",
        "--lwd-url",
        "https://zec.rocks",
        "--port",
        "18232",
        "--bind-address",
        "127.0.0.1",
        "--coin",
        "0",
        "--allow-unauthenticated",
        "--allow-unencrypted-database",
        "--no-mempool",
      ],
      engineEnv: {
        XDG_DATA_HOME: "/data/openzcash-treasury/engine",
        HOME: "/data/openzcash-treasury/engine",
      },
      workerArgs: [
        "--import",
        "tsx",
        "scripts/sync-openzcash-treasury.ts",
        "--watch",
      ],
    });
  });

  it("follows the engine address and the indexer the worker is given", () => {
    const decision = treasuryRuntimeConfig(
      {
        ...ENABLED,
        OPENZCASH_TREASURY_ENGINE_URL: "http://127.0.0.1:19000/graphql",
        OPENZCASH_TREASURY_INDEXER: "https://indexer.example:9067",
      },
      "/app",
    );
    if (!decision.enabled) throw new Error(decision.reason);
    expect(decision.config.enginePort).toBe(19000);
    expect(decision.config.engineArgs).toContain("19000");
    expect(decision.config.engineArgs).toContain(
      "https://indexer.example:9067",
    );
  });

  it("never starts an engine that would listen beyond loopback or read a plain-HTTP indexer", () => {
    for (const extra of [
      { OPENZCASH_TREASURY_ENGINE_URL: "http://0.0.0.0:18232/graphql" },
      { OPENZCASH_TREASURY_ENGINE_URL: "http://engine.internal:18232/graphql" },
      { OPENZCASH_TREASURY_ENGINE_URL: "not a url" },
      { OPENZCASH_TREASURY_INDEXER: "http://zec.rocks" },
    ]) {
      expect(
        treasuryRuntimeConfig({ ...ENABLED, ...extra }, "/app"),
      ).toMatchObject({ enabled: false });
    }
  });

  it("gives the engine an unprivileged port of its own, never the site's", () => {
    for (const extra of [
      { OPENZCASH_TREASURY_ENGINE_URL: "http://127.0.0.1/graphql" },
      { OPENZCASH_TREASURY_ENGINE_URL: "http://127.0.0.1:443/graphql" },
      {
        OPENZCASH_TREASURY_ENGINE_URL: "http://127.0.0.1:8080/graphql",
        PORT: "8080",
      },
    ]) {
      const decision = treasuryRuntimeConfig({ ...ENABLED, ...extra }, "/app");
      expect(decision.enabled ? "" : decision.reason).toMatch(/port/);
    }
    expect(
      treasuryRuntimeConfig({ ...ENABLED, PORT: "8080" }, "/app").enabled,
    ).toBe(true);
  });

  it("uses an engine binary the operator installed instead of downloading one", () => {
    const decision = treasuryRuntimeConfig(
      { ...ENABLED, OPENZCASH_TREASURY_ENGINE_BIN: "/opt/zkool/zkool_graphql" },
      "/app",
    );
    if (!decision.enabled) throw new Error(decision.reason);
    expect(decision.config.engineBin).toBe("/opt/zkool/zkool_graphql");
    expect(decision.config.engineManaged).toBe(false);
    expect(
      treasuryRuntimeConfig(
        { ...ENABLED, OPENZCASH_TREASURY_ENGINE_BIN: "bin/zkool_graphql" },
        "/app",
      ),
    ).toMatchObject({ enabled: false });
  });
});

describe("treasuryChildEnv", () => {
  it("passes on the basics and the treasury settings, never the service's credentials", () => {
    const env = treasuryChildEnv(
      {
        PATH: "/usr/bin",
        TZ: "UTC",
        OPENZCASH_TREASURY_SNAPSHOT_PATH: "/data/t/snapshot.json",
        OPENZCASH_TREASURY_INDEXER: "https://zec.rocks",
        DATABASE_URL: "postgres://portal",
        ANTHROPIC_API_KEY: "provider-key",
        CRON_SECRET: "cron",
        UNSET: undefined,
      },
      { XDG_DATA_HOME: "/data/t/engine" },
    );
    expect(env).toEqual({
      PATH: "/usr/bin",
      TZ: "UTC",
      OPENZCASH_TREASURY_SNAPSHOT_PATH: "/data/t/snapshot.json",
      OPENZCASH_TREASURY_INDEXER: "https://zec.rocks",
      XDG_DATA_HOME: "/data/t/engine",
    });
  });
});

describe("waitForPort", () => {
  it("answers as soon as something listens on the loopback port, and gives up at the deadline", async () => {
    const server = net.createServer().listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address() as net.AddressInfo;
    const signal = new AbortController().signal;
    expect(await waitForPort(port, { signal, timeoutMs: 2_000 })).toBe(true);
    await new Promise((resolve) => server.close(resolve));
    expect(
      await waitForPort(port, { signal, timeoutMs: 150, intervalMs: 50 }),
    ).toBe(false);
  });
});

describe("treasuryEngineIdentity", () => {
  it("hands the engine to an unprivileged account when the runtime is root, and only then", () => {
    expect(treasuryEngineIdentity(0)).toEqual({
      uid: TREASURY_ENGINE_UID,
      gid: TREASURY_ENGINE_UID,
    });
    expect(TREASURY_ENGINE_UID).toBe(65_534);
    expect(treasuryEngineIdentity(501)).toEqual({});
    expect(treasuryEngineIdentity(undefined)).toEqual({});
  });

  it("gives the engine's directory and everything in it to that account", async () => {
    const dir = await scratch();
    await mkdir(path.join(dir, "ZcashParams"));
    await writeFile(path.join(dir, "treasury.db"), "x");
    await writeFile(path.join(dir, "ZcashParams", "sapling-spend.params"), "x");
    const calls: string[] = [];
    await chownTree(dir, 65_534, 65_534, async (target, uid, gid) => {
      calls.push(`${path.relative(dir, String(target)) || "."} ${uid}:${gid}`);
    });
    expect(calls.sort()).toEqual([
      ". 65534:65534",
      "ZcashParams 65534:65534",
      `${path.join("ZcashParams", "sapling-spend.params")} 65534:65534`,
      "treasury.db 65534:65534",
    ]);
  });
});

describe("restartDelayMs", () => {
  it("backs off from one second to a one-minute ceiling", () => {
    expect([0, 1, 2, 3, 5, 6, 7, 40].map(restartDelayMs)).toEqual([
      1_000, 2_000, 4_000, 8_000, 32_000, 60_000, 60_000, 60_000,
    ]);
  });
});

describe("clearLeftoverLocks", () => {
  it("removes what a killed container left and keeps the snapshot and the engine data", async () => {
    const dir = await scratch();
    await mkdir(path.join(dir, "engine"));
    await mkdir(path.join(dir, "bin"));
    for (const name of [
      "sync.lock",
      "sync.lock.recovery",
      "sync.lock.3f2a.aside",
      "snapshot.json.812.tmp",
      "snapshot.json",
      "engine/treasury.db",
      "bin/zkool_graphql-6.36.0",
    ]) {
      await writeFile(path.join(dir, name), "x");
    }
    expect((await clearLeftoverLocks(dir)).sort()).toEqual([
      "snapshot.json.812.tmp",
      "sync.lock",
      "sync.lock.3f2a.aside",
      "sync.lock.recovery",
    ]);
    expect((await readdir(dir)).sort()).toEqual([
      "bin",
      "engine",
      "snapshot.json",
    ]);
    expect(await readdir(path.join(dir, "engine"))).toEqual(["treasury.db"]);
  });

  it("also clears a directory that carries a leftover's name", async () => {
    const dir = await scratch();
    await mkdir(path.join(dir, "sync.lock.odd"));
    await writeFile(path.join(dir, "sync.lock.odd", "inside"), "x");
    expect(await clearLeftoverLocks(dir)).toEqual(["sync.lock.odd"]);
    expect(await readdir(dir)).toEqual([]);
  });

  it("creates the runtime directory on a new volume", async () => {
    const dir = path.join(await scratch(), "openzcash-treasury");
    expect(await clearLeftoverLocks(dir)).toEqual([]);
    expect((await stat(dir)).isDirectory()).toBe(true);
  });
});

describe("ensureTreasuryEngine", () => {
  const body = Buffer.from("#!/bin/sh\necho stand-in engine\n");
  const release: TreasuryEngineRelease = {
    version: "0.0.0-test",
    url: "https://example.test/zkool_graphql",
    sha256: createHash("sha256").update(body).digest("hex"),
    bytes: body.length,
  };
  const serving = (payload: Buffer | null, status = 200) => {
    const calls: string[] = [];
    const fetchImpl = async (url: string | URL | Request) => {
      calls.push(String(url));
      return new Response(payload && new Uint8Array(payload), { status });
    };
    return { calls, fetchImpl };
  };

  it("pins the published engine release by digest and size", () => {
    expect(TREASURY_ENGINE.url).toBe(
      "https://github.com/hhanh00/zkool2/releases/download/zkool-v6.36.0/zkool_graphql",
    );
    expect(TREASURY_ENGINE.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(TREASURY_ENGINE.bytes).toBe(142_781_608);
  });

  it("downloads the engine once, verifies it and makes it executable", async () => {
    const bin = path.join(await scratch(), "bin", "engine");
    const { calls, fetchImpl } = serving(body);
    expect(await ensureTreasuryEngine(bin, release, fetchImpl)).toBe(
      "downloaded",
    );
    expect(await readFile(bin)).toEqual(body);
    expect((await stat(bin)).mode & 0o111).not.toBe(0);
    expect(await ensureTreasuryEngine(bin, release, fetchImpl)).toBe("present");
    expect(calls).toEqual([release.url]);
    expect(await readdir(path.dirname(bin))).toEqual(["engine"]);
  });

  it("installs the engine read-only and never writes through a link left at the download's name", async () => {
    const dir = await scratch();
    const bin = path.join(dir, "bin", "engine");
    const victim = path.join(dir, "victim");
    await mkdir(path.dirname(bin), { recursive: true });
    await writeFile(victim, "untouched");
    await symlink(victim, `${bin}.download`);
    await ensureTreasuryEngine(bin, release, serving(body).fetchImpl);
    expect(await readFile(victim, "utf8")).toBe("untouched");
    expect(await readFile(bin)).toEqual(body);
    expect((await stat(bin)).mode & 0o777).toBe(0o555);
  });

  it("refuses a download whose digest is not the pinned one and leaves nothing to run", async () => {
    const bin = path.join(await scratch(), "bin", "engine");
    const tampered = Buffer.from(
      body.toString().replace("stand-in", "tampered"),
    );
    expect(tampered.length).toBe(body.length);
    await expect(
      ensureTreasuryEngine(bin, release, serving(tampered).fetchImpl),
    ).rejects.toThrow(/digest/i);
    expect(await readdir(path.dirname(bin))).toEqual([]);
  });

  it("stops a download that runs past the pinned size", async () => {
    const bin = path.join(await scratch(), "bin", "engine");
    const larger = Buffer.concat([body, Buffer.alloc(4096, 1)]);
    await expect(
      ensureTreasuryEngine(bin, release, serving(larger).fetchImpl),
    ).rejects.toThrow(/size/i);
    expect(await readdir(path.dirname(bin))).toEqual([]);
  });

  it("reports a failed download without leaving a file", async () => {
    const bin = path.join(await scratch(), "bin", "engine");
    await expect(
      ensureTreasuryEngine(bin, release, serving(null, 503).fetchImpl),
    ).rejects.toThrow(/503/);
    expect(await readdir(path.dirname(bin))).toEqual([]);
  });

  it("replaces a file on the volume that no longer matches the pinned digest", async () => {
    const bin = path.join(await scratch(), "bin", "engine");
    await mkdir(path.dirname(bin), { recursive: true });
    await writeFile(bin, "an older or damaged engine");
    const { calls, fetchImpl } = serving(body);
    expect(await ensureTreasuryEngine(bin, release, fetchImpl)).toBe(
      "downloaded",
    );
    expect(await readFile(bin)).toEqual(body);
    expect(calls).toHaveLength(1);
  });
});

describe("superviseProcess", () => {
  class FakeChild extends EventEmitter implements ChildHandle {
    signals: string[] = [];
    kill(signal: NodeJS.Signals = "SIGTERM") {
      this.signals.push(signal);
      return true;
    }
  }

  /** Drives one supervised process by hand: each step waits for the supervisor to reach it. */
  function harness() {
    const stop = new AbortController();
    const children: FakeChild[] = [];
    const sleeps: number[] = [];
    const lines: string[] = [];
    let clock = 0;
    let wake: (() => void) | null = null;
    const waiters: Array<() => void> = [];
    const settle = () => waiters.splice(0).forEach((resolve) => resolve());
    const reached = () =>
      new Promise<void>((resolve) => {
        waiters.push(resolve);
      });
    const done = superviseProcess(
      "engine",
      () => {
        const child = new FakeChild();
        children.push(child);
        settle();
        return child;
      },
      {
        signal: stop.signal,
        now: () => clock,
        log: (line) => lines.push(line),
        sleep: (ms) => {
          sleeps.push(ms);
          return new Promise<void>((resolve) => {
            wake = resolve;
            settle();
          });
        },
      },
    );
    return {
      /** Child-process events never fire in the tick that spawned the process. */
      emit: async (index: number, ...event: [string, ...unknown[]]) => {
        await new Promise((resolve) => setImmediate(resolve));
        children.at(index)?.emit(...event);
      },
      stop,
      children,
      sleeps,
      lines,
      done,
      reached,
      advance: (ms: number) => {
        clock += ms;
      },
      wake: () => wake?.(),
    };
  }

  it("restarts a process that keeps dying, a little later each time", async () => {
    const run = harness();
    for (const expected of [2_000, 4_000, 8_000]) {
      const asleep = run.reached();
      await run.emit(-1, "exit", 1, null);
      await asleep;
      expect(run.sleeps.at(-1)).toBe(expected);
      const restarted = run.reached();
      run.wake();
      await restarted;
    }
    expect(run.children).toHaveLength(4);
    expect(run.lines.join("\n")).toMatch(/engine exited \(code 1\)/);
    run.stop.abort();
    await run.emit(-1, "exit", null, "SIGTERM");
    await run.done;
  });

  it("forgets earlier failures once a process has run for a while", async () => {
    const run = harness();
    let asleep = run.reached();
    await run.emit(0, "exit", 1, null);
    await asleep;
    const restarted = run.reached();
    run.wake();
    await restarted;
    run.advance(5 * 60_000);
    asleep = run.reached();
    await run.emit(1, "exit", null, "SIGKILL");
    await asleep;
    expect(run.sleeps).toEqual([2_000, 1_000]);
    expect(run.lines.join("\n")).toMatch(/engine exited \(SIGKILL\)/);
    run.stop.abort();
    run.wake();
    await run.done;
  });

  it("treats a binary that cannot be started as one more failure", async () => {
    const run = harness();
    const asleep = run.reached();
    await run.emit(0, "error", new Error("spawn ENOEXEC"));
    await asleep;
    expect(run.sleeps).toEqual([2_000]);
    expect(run.lines.join("\n")).toMatch(
      /engine could not start: spawn ENOEXEC/,
    );
    run.stop.abort();
    run.wake();
    await run.done;
  });

  it("counts a start that cannot be prepared as a failed start, and makes sure a failed process is gone", async () => {
    const lines: string[] = [];
    const stop = new AbortController();
    const done = superviseProcess(
      "engine",
      async () => {
        throw new Error("Engine download does not match the pinned digest");
      },
      {
        signal: stop.signal,
        log: (line) => lines.push(line),
        sleep: async () => stop.abort(),
      },
    );
    await done;
    expect(lines).toEqual([
      "engine could not start: Engine download does not match the pinned digest; restarting in 2 s",
    ]);

    const run = harness();
    const asleep = run.reached();
    await run.emit(0, "error", new Error("kill EPERM"));
    await asleep;
    expect(run.children[0].signals).toEqual(["SIGKILL"]);
    run.stop.abort();
    run.wake();
    await run.done;
  });

  it("ends its process and stops restarting when the service shuts down", async () => {
    const run = harness();
    run.stop.abort();
    await Promise.resolve();
    expect(run.children[0].signals).toEqual(["SIGTERM"]);
    await run.emit(0, "exit", null, "SIGTERM");
    await run.done;
    expect(run.children).toHaveLength(1);
  });
});
