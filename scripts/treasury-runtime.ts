import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  chownTree,
  clearLeftoverLocks,
  ensureTreasuryEngine,
  portIsOpen,
  superviseProcess,
  treasuryChildEnv,
  treasuryEngineIdentity,
  treasuryRuntimeConfig,
  waitForPort,
} from "../src/lib/openzcash-treasury/runtime";

// Treasury runtime: keeps the wallet engine and the treasury worker running in
// the web service's container, beside `next start`. The start command launches
// it in the background only when OPENZCASH_TREASURY_RUNTIME=enabled. It is a
// separate process: the web application never imports it, and the site's start,
// health check and restart policy do not wait on it. It does share the
// container's memory and processor with the site.

const log = (line: string) => process.stdout.write(`[treasury] ${line}\n`);
const stop = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    stop.abort();
    // Both children were sent SIGTERM; do not wait on one that ignores it.
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}

async function main() {
  const decision = treasuryRuntimeConfig(process.env);
  if (!decision.enabled) {
    log(`runtime not started: ${decision.reason}`);
    return;
  }
  const { config } = decision;
  const engineDir = config.engineEnv.XDG_DATA_HOME;

  // A second runtime in this container would clear the first one's lock and share its engine database.
  if (await portIsOpen(config.enginePort)) {
    log(
      `runtime not started: something already listens on port ${config.enginePort}`,
    );
    return;
  }
  // This container is the only one that mounts the volume, and no worker has started yet.
  const leftovers = await clearLeftoverLocks(
    config.dir,
    path.basename(config.snapshotPath),
  );
  if (leftovers.length)
    log(`removed ${leftovers.join(", ")} left by the previous container`);

  // The engine is a third-party binary: as root, hand it to an account that cannot read the site's process.
  const identity = treasuryEngineIdentity(process.getuid?.());
  await mkdir(engineDir, { recursive: true });
  if ("uid" in identity) await chownTree(engineDir, identity.uid, identity.gid);
  else log("not running as root: the engine runs as the same user as the site");

  const supervision = { signal: stop.signal, log };
  const engine = superviseProcess(
    "engine",
    async () => {
      // Checked before every start, so a file changed on the volume is replaced, never run.
      if (config.engineManaged)
        log(
          `engine binary ${await ensureTreasuryEngine(config.engineBin)}, digest verified`,
        );
      // The cast only satisfies the framework's stricter typing of the environment.
      return spawn(config.engineBin, config.engineArgs, {
        stdio: "inherit",
        env: treasuryChildEnv(
          process.env,
          config.engineEnv,
        ) as NodeJS.ProcessEnv,
        ...identity,
      });
    },
    supervision,
  );
  const worker = (async () => {
    if (!(await waitForPort(config.enginePort, { signal: stop.signal })))
      log("engine is not answering yet; starting the worker anyway");
    await superviseProcess(
      "worker",
      () =>
        spawn(process.execPath, config.workerArgs, {
          stdio: "inherit",
          env: treasuryChildEnv(process.env) as NodeJS.ProcessEnv,
        }),
      supervision,
    );
  })();
  log(`runtime started in ${config.dir}`);
  await Promise.all([engine, worker]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    log(
      `runtime stopped: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    // Take the engine and the worker down too; nothing would supervise them.
    stop.abort();
    process.exitCode = 1;
    setTimeout(() => process.exit(1), 3_000).unref();
  });
