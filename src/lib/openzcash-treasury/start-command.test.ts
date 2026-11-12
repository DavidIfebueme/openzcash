import { spawn } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

// The production start command is one shell line in railway.toml. These tests
// run that exact line under /bin/sh with stand-ins for `node` and `npm`, so a
// change to it cannot quietly alter how the site starts.

const railwayToml = fileURLToPath(
  new URL("../../../railway.toml", import.meta.url),
);

async function startCommand(): Promise<string> {
  const match = /^startCommand = '(.*)'$/m.exec(
    await readFile(railwayToml, "utf8"),
  );
  if (!match) throw new Error("startCommand not found in railway.toml");
  return match[1];
}

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

const NODE_STANDIN = `#!/bin/sh
echo "node $*" >> "$LOGF"
case "$*" in
  *migrate.mjs*) [ "$SCEN" = migrate-fails ] && exit 3 ;;
  *treasury-runtime.ts*)
    # Stays alive until the site has started, so the order never depends on how fast the machine is.
    # If the command ran this in the foreground, the site would never start and this gives up.
    tries=0
    while [ ! -e "$LOGF.site-started" ] && [ "$tries" -lt 300 ]; do sleep 0.05; tries=$((tries + 1)); done
    if [ -e "$LOGF.site-started" ]; then echo "runtime-saw-the-site-start" >> "$LOGF"; else echo "runtime-never-saw-the-site" >> "$LOGF"; fi ;;
esac
exit 0
`;
const NPM_STANDIN = `#!/bin/sh
echo "npm $* pid=$$" >> "$LOGF"
: > "$LOGF.site-started"
exit 7
`;
// Each case starts several processes; a busy machine can take seconds to start one.
const SLOW = 120_000;

async function run(env: Record<string, string>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "start-command-test-"));
  dirs.push(dir);
  const bin = path.join(dir, "bin");
  const logFile = path.join(dir, "log");
  await mkdir(bin);
  await writeFile(path.join(bin, "node"), NODE_STANDIN);
  await writeFile(path.join(bin, "npm"), NPM_STANDIN);
  await chmod(path.join(bin, "node"), 0o755);
  await chmod(path.join(bin, "npm"), 0o755);
  await writeFile(logFile, "");

  // Only the stand-ins and the scenario: nothing of the real environment leaks in.
  const standIns: Record<string, string> = {
    PATH: `${bin}:/usr/bin:/bin`,
    LOGF: logFile,
    ...env,
  };
  const shell = spawn("/bin/sh", ["-c", await startCommand()], {
    env: standIns as NodeJS.ProcessEnv,
    stdio: "ignore",
  });
  const code = await new Promise<number | null>((resolve) =>
    shell.once("exit", resolve),
  );
  const log = async () =>
    (await readFile(logFile, "utf8")).split("\n").filter(Boolean);
  return { code, pid: shell.pid, log };
}

const BEFORE_START = [
  "node scripts/assert-redesign.mjs",
  "node scripts/migrate.mjs",
  "node scripts/seed-governance.mjs",
];

describe("the production start command", () => {
  it("starts only the site, as the signalled process, when the runtime is not enabled", async () => {
    const notEnabled: Array<Record<string, string>> = [
      {},
      { OPENZCASH_TREASURY_RUNTIME: "" },
      { OPENZCASH_TREASURY_RUNTIME: "true" },
    ];
    for (const env of notEnabled) {
      const result = await run(env);
      // `exec`: npm takes over the shell's own process, and its exit status is the service's.
      expect(await result.log()).toEqual([
        ...BEFORE_START,
        `npm run start pid=${result.pid}`,
      ]);
      expect(result.code).toBe(7);
    }
  }, SLOW);

  it("starts the runtime in the background, without holding the site back, when it is enabled", async () => {
    const result = await run({ OPENZCASH_TREASURY_RUNTIME: "enabled" });
    expect(result.code).toBe(7);
    await expect
      .poll(
        async () =>
          (await result.log()).filter((line) => line.startsWith("runtime-")),
        { timeout: 90_000 },
      )
      .toEqual(["runtime-saw-the-site-start"]);
    const lines = await result.log();
    expect(lines.slice(0, 3)).toEqual(BEFORE_START);
    expect(lines).toContain("node --import tsx scripts/treasury-runtime.ts");
    // The site started, as the shell's own process, while the runtime was still running.
    expect(lines.indexOf(`npm run start pid=${result.pid}`)).toBeGreaterThan(2);
    expect(lines.indexOf(`npm run start pid=${result.pid}`)).toBeLessThan(
      lines.indexOf("runtime-saw-the-site-start"),
    );
  }, SLOW);

  it("starts nothing when a step before the site fails", async () => {
    const result = await run({
      OPENZCASH_TREASURY_RUNTIME: "enabled",
      SCEN: "migrate-fails",
    });
    expect(result.code).toBe(3);
    expect(await result.log()).toEqual(BEFORE_START.slice(0, 2));
  }, SLOW);
});
