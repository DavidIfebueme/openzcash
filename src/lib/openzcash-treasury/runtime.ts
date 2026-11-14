import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  chmod,
  chown,
  mkdir,
  open,
  readdir,
  rename,
  rm,
} from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

/**
 * Pieces of the treasury runtime: the wallet engine and the worker running in
 * the web service's own container, on a volume, beside `next start`.
 *
 * Only `scripts/treasury-runtime.ts` uses this module. The web application
 * never imports it: the site still only reads the snapshot file.
 */

export interface TreasuryEngineRelease {
  version: string;
  url: string;
  /** SHA-256 of the file, lowercase hex. */
  sha256: string;
  bytes: number;
}

/**
 * The engine the runtime downloads: the `zkool_graphql` binary that the ZKool
 * project's own release workflow attached to release zkool-v6.36.0 (Linux
 * x86_64). Digest and size are the ones GitHub publishes for that asset.
 * Changing the engine version means changing all four values together.
 */
export const TREASURY_ENGINE: TreasuryEngineRelease = {
  version: "6.36.0",
  url: "https://github.com/hhanh00/zkool2/releases/download/zkool-v6.36.0/zkool_graphql",
  sha256: "222371dc7d8005d63cb0399da7981e8c88f101d07295964835004d506e2f20da",
  bytes: 142_781_608,
};

/** The unprivileged account (`nobody`) the engine runs as when the runtime starts as root. */
export const TREASURY_ENGINE_UID = 65_534;

export interface TreasuryRuntimeConfig {
  /** Runtime directory on the volume: snapshot, lock, engine data, engine binary. */
  dir: string;
  snapshotPath: string;
  engineBin: string;
  /** False when the operator installed the binary; then nothing is downloaded. */
  engineManaged: boolean;
  enginePort: number;
  engineArgs: string[];
  engineEnv: Record<string, string>;
  workerArgs: string[];
}

export type TreasuryRuntimeDecision =
  | { enabled: false; reason: string }
  | { enabled: true; config: TreasuryRuntimeConfig };

const off = (reason: string): TreasuryRuntimeDecision => ({
  enabled: false,
  reason,
});

function isInside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

/**
 * Decides, from the service's variables, whether the runtime starts and with
 * what. It is off unless OPENZCASH_TREASURY_RUNTIME is exactly "enabled".
 */
export function treasuryRuntimeConfig(
  env: Record<string, string | undefined>,
  cwd: string = process.cwd(),
): TreasuryRuntimeDecision {
  if (env.OPENZCASH_TREASURY_RUNTIME !== "enabled")
    return off('OPENZCASH_TREASURY_RUNTIME is not "enabled"');

  const snapshotPath = path.normalize(
    env.OPENZCASH_TREASURY_SNAPSHOT_PATH ?? "",
  );
  if (!path.isAbsolute(snapshotPath))
    return off("the snapshot path must be absolute");
  const dir = path.dirname(snapshotPath);
  if (dir === path.parse(dir).root)
    return off("the snapshot needs a directory of its own");
  // The application directory is rebuilt on every deploy; the runtime belongs on the volume.
  if (isInside(dir, cwd))
    return off(
      "the snapshot directory must be on a volume, outside the application directory",
    );

  let engine: URL;
  try {
    engine = new URL(
      env.OPENZCASH_TREASURY_ENGINE_URL || "http://127.0.0.1:18232/graphql",
    );
  } catch {
    return off("the engine URL is not valid");
  }
  if (
    engine.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(engine.hostname)
  )
    return off("the engine must listen on loopback only");
  const enginePort = Number(engine.port);
  // An unprivileged port of its own: never the default 80, never the site's.
  if (enginePort < 1024 || String(enginePort) === env.PORT)
    return off(
      "the engine URL needs a port of its own, 1024 or higher, different from the site's",
    );

  const indexer = env.OPENZCASH_TREASURY_INDEXER || "https://zec.rocks";
  if (!URL.canParse(indexer) || new URL(indexer).protocol !== "https:")
    return off("the indexer must use HTTPS");

  const installed = env.OPENZCASH_TREASURY_ENGINE_BIN;
  if (installed && !path.isAbsolute(installed))
    return off("the engine binary path must be absolute");

  const engineDir = path.join(dir, "engine");
  return {
    enabled: true,
    config: {
      dir,
      snapshotPath,
      engineBin:
        installed ||
        path.join(dir, "bin", `zkool_graphql-${TREASURY_ENGINE.version}`),
      engineManaged: !installed,
      enginePort,
      engineArgs: [
        "--db-path",
        path.join(engineDir, "treasury.db"),
        "--lwd-url",
        indexer,
        "--port",
        String(enginePort),
        "--bind-address",
        "127.0.0.1",
        "--coin",
        "0",
        "--allow-unauthenticated",
        "--allow-unencrypted-database",
        "--no-mempool",
      ],
      engineEnv: { XDG_DATA_HOME: engineDir, HOME: engineDir },
      workerArgs: [
        "--import",
        "tsx",
        "scripts/sync-openzcash-treasury.ts",
        "--watch",
      ],
    },
  };
}

const PASSED_ON = [
  "PATH",
  "LANG",
  "LC_ALL",
  "TZ",
  "TMPDIR",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "NODE_EXTRA_CA_CERTS",
];

/**
 * Environment for the engine and the worker: the basics and the treasury's own
 * settings, without the service's database URL and provider keys. This keeps
 * them out of the processes' own environment and logs. It is not a sandbox: a
 * process running as the site's user could still read them from the site.
 * See `treasuryEngineIdentity` for the engine.
 */
export function treasuryChildEnv(
  env: Record<string, string | undefined>,
  extra: Record<string, string> = {},
): Record<string, string> {
  const kept = Object.entries(env).filter(
    (entry): entry is [string, string] =>
      entry[1] !== undefined &&
      (PASSED_ON.includes(entry[0]) ||
        entry[0].startsWith("OPENZCASH_TREASURY_")),
  );
  return { ...Object.fromEntries(kept), ...extra };
}

/**
 * Account the engine runs as. A runtime started as root (the usual case in the
 * container) hands the third-party engine to an unprivileged account, which
 * cannot read the site's process, its variables or the snapshot. A runtime that
 * is not root cannot change accounts; the engine then runs as the same user.
 */
export function treasuryEngineIdentity(
  currentUid: number | undefined,
): { uid: number; gid: number } | Record<string, never> {
  return currentUid === 0
    ? { uid: TREASURY_ENGINE_UID, gid: TREASURY_ENGINE_UID }
    : {};
}

/** Gives a directory and everything in it to one account. */
export async function chownTree(
  dir: string,
  uid: number,
  gid: number,
  chownImpl: typeof chown = chown,
): Promise<void> {
  await chownImpl(dir, uid, gid);
  for (const name of await readdir(dir, { recursive: true }))
    await chownImpl(path.join(dir, name), uid, gid);
}

/** Wait between restarts: one second, doubling to a one-minute ceiling. */
export function restartDelayMs(failures: number): number {
  return Math.min(60_000, 1_000 * 2 ** Math.min(Math.max(failures, 0), 16));
}

/**
 * Removes the lock files and unfinished snapshot writes a killed container
 * left in the runtime directory, creating the directory on a new volume.
 *
 * Only for the runtime's start, before it launches a worker and after it has
 * checked that no engine is listening: a volume is mounted by one container at
 * a time, so whatever is there belonged to a container that no longer exists.
 * A worker never calls this.
 */
export async function clearLeftoverLocks(
  dir: string,
  snapshotName = "snapshot.json",
): Promise<string[]> {
  await mkdir(dir, { recursive: true });
  const leftovers = (await readdir(dir)).filter(
    (name) =>
      name === "sync.lock" ||
      name.startsWith("sync.lock.") ||
      (name.startsWith(`${snapshotName}.`) && name.endsWith(".tmp")),
  );
  await Promise.all(
    leftovers.map((name) =>
      rm(path.join(dir, name), { force: true, recursive: true }),
    ),
  );
  return leftovers;
}

async function fileSha256(file: string): Promise<string | null> {
  const hash = createHash("sha256");
  try {
    for await (const chunk of createReadStream(file)) hash.update(chunk);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  return hash.digest("hex");
}

export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<Response>;

/**
 * Makes sure the pinned engine binary is at `binPath`. A file already there is
 * kept only if its digest is the pinned one; anything else is replaced. The
 * download is written beside the target and moved into place only after its
 * size and digest match, so a partial or altered file is never executable.
 * Called before every start of the engine, not only the first.
 */
export async function ensureTreasuryEngine(
  binPath: string,
  release: TreasuryEngineRelease = TREASURY_ENGINE,
  fetchImpl: FetchLike = fetch,
): Promise<"present" | "downloaded"> {
  await mkdir(path.dirname(binPath), { recursive: true });
  if ((await fileSha256(binPath)) === release.sha256) return "present";

  const partial = `${binPath}.download`;
  // A fresh file of our own: whatever sits at that name, a link included, is removed, never followed.
  await rm(partial, { force: true, recursive: true });
  try {
    const response = await fetchImpl(release.url, {
      signal: AbortSignal.timeout(15 * 60_000),
    });
    if (!response.ok || !response.body)
      throw new Error(`Engine download failed (HTTP ${response.status})`);
    const hash = createHash("sha256");
    const reader = response.body.getReader();
    const file = await open(partial, "wx", 0o600);
    let bytes = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > release.bytes) {
          await reader.cancel();
          throw new Error("Engine download is larger than the pinned size");
        }
        hash.update(value);
        await file.writeFile(value);
      }
    } finally {
      await file.close();
    }
    if (bytes !== release.bytes)
      throw new Error("Engine download is smaller than the pinned size");
    if (hash.digest("hex") !== release.sha256)
      throw new Error("Engine download does not match the pinned digest");
    // Readable and executable by the engine's account, writable by nobody.
    await chmod(partial, 0o555);
    await rename(partial, binPath);
    return "downloaded";
  } catch (error) {
    await rm(partial, { force: true });
    throw error;
  }
}

/** True when something accepts connections on the loopback port right now. */
export function portIsOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

/** Resolves true once something accepts connections on the loopback port, false at the deadline. */
export async function waitForPort(
  port: number,
  options: { signal: AbortSignal; timeoutMs?: number; intervalMs?: number },
): Promise<boolean> {
  const deadline = Date.now() + (options.timeoutMs ?? 60_000);
  while (!options.signal.aborted && Date.now() < deadline) {
    if (await portIsOpen(port)) return true;
    await delay(options.intervalMs ?? 500, undefined, {
      signal: options.signal,
    }).catch(() => {});
  }
  return false;
}

/** The part of a child process the supervisor needs. */
export interface ChildHandle {
  once(
    event: "exit",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): unknown;
  once(event: "error", listener: (error: Error) => void): unknown;
  kill(signal?: NodeJS.Signals): boolean;
}

export interface SuperviseOptions {
  /** Aborted when the runtime shuts down. */
  signal: AbortSignal;
  log: (line: string) => void;
  now?: () => number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  /** A run at least this long clears the failure count. */
  stableAfterMs?: number;
}

type Outcome =
  | { kind: "exit"; code: number | null; signal: NodeJS.Signals | null }
  | { kind: "error"; message: string };

const failed = (error: unknown): Outcome => ({
  kind: "error",
  message: error instanceof Error ? error.message : "unknown error",
});

async function runOnce(
  start: () => ChildHandle | Promise<ChildHandle>,
  signal: AbortSignal,
): Promise<Outcome> {
  let child: ChildHandle;
  try {
    child = await start();
  } catch (error) {
    return failed(error);
  }
  return new Promise((resolve) => {
    const end = () => child.kill("SIGTERM");
    if (signal.aborted) end();
    else signal.addEventListener("abort", end, { once: true });
    const settle = (outcome: Outcome) => {
      signal.removeEventListener("abort", end);
      resolve(outcome);
    };
    child.once("exit", (code, exitSignal) =>
      settle({ kind: "exit", code, signal: exitSignal }),
    );
    child.once("error", (error) => {
      // Usually a process that never started. If it did, make sure it is gone before another starts.
      child.kill("SIGKILL");
      settle(failed(error));
    });
  });
}

/**
 * Keeps one process running until the runtime shuts down: starts it, waits for
 * it to end, and starts it again after a growing pause. `start` may prepare
 * first (verify a binary, say); if it throws, that counts as a failed start.
 * On shutdown the process gets SIGTERM and is not restarted.
 */
export async function superviseProcess(
  name: string,
  start: () => ChildHandle | Promise<ChildHandle>,
  options: SuperviseOptions,
): Promise<void> {
  const now = options.now ?? Date.now;
  const sleep =
    options.sleep ??
    ((ms, signal) => delay(ms, undefined, { signal }).catch(() => {}));
  const stableAfterMs = options.stableAfterMs ?? 60_000;
  let failures = 0;
  while (!options.signal.aborted) {
    const startedAt = now();
    const outcome = await runOnce(start, options.signal);
    if (options.signal.aborted) return;
    const stable =
      outcome.kind === "exit" && now() - startedAt >= stableAfterMs;
    failures = stable ? 0 : failures + 1;
    const pause = restartDelayMs(failures);
    const what =
      outcome.kind === "error"
        ? `could not start: ${outcome.message}`
        : `exited (${outcome.signal ?? `code ${outcome.code}`})`;
    options.log(`${name} ${what}; restarting in ${pause / 1000} s`);
    await sleep(pause, options.signal);
  }
}
