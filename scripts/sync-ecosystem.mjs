import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACTIVITY_CACHE_VERSION, resumeCollectionCache } from "./lib/ecosystem-collection.mjs";
import { collectEcosystem } from "./lib/ecosystem-sync.mjs";

// Read-only GitHub collection. No clone, checkout, installation or execution
// of discovered repositories. gh supplies its existing authentication.
const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "src/data/ecosystem");
const registryFile = path.join(dataDir, "registry.json");
const snapshotFile = path.join(dataDir, "snapshot.json");
const cacheFile = path.join(root, ".cache/ecosystem-github.json");
const registry = JSON.parse(await readFile(registryFile, "utf8"));
const reuseCache = process.argv.includes("--cached");
let cached = { version: ACTIVITY_CACHE_VERSION, owners: {}, repositories: {}, activity: {} };
if (reuseCache) {
  let value;
  try { value = JSON.parse(await readFile(cacheFile, "utf8")); }
  catch { throw new Error("No readable collection cache. Run sync-ecosystem without --cached."); }
  cached = resumeCollectionCache(value);
  console.log("Resuming cached source reads at cutoff " + cached.collectedAt + "; this is not a fresh collection.");
}
const startedAt = cached.collectedAt || new Date().toISOString();
cached.collectedAt = startedAt;
let previousSnapshot = null;
try { previousSnapshot = JSON.parse(await readFile(snapshotFile, "utf8")); } catch {}

async function gh(endpoint, query) {
  try {
    const { stdout } = await run("gh", [
      "api", endpoint,
      "-H", "Accept: application/vnd.github+json",
      "-H", "X-GitHub-Api-Version: 2022-11-28",
      ...(query ? ["-f", "query=" + query] : []),
    ], { maxBuffer: 32 * 1024 * 1024, timeout: 120_000 });
    const result = JSON.parse(stdout);
    if (result.errors?.length) throw new Error("Incomplete GitHub response");
    return result;
  } catch (error) {
    // Never echo process environment, auth headers or the gh command.
    throw new Error("GitHub request failed: " + endpoint.split("?")[0] +
      (error.code ? " (" + error.code + ")" : ""));
  }
}

const { snapshot, publicationIssues } = await collectEcosystem({
  registry, previousSnapshot, request: gh, startedAt, cached, reuseCache,
  report: message => console.log(message),
});
await mkdir(path.dirname(cacheFile), { recursive: true });
await writeFile(cacheFile, JSON.stringify(cached));
await mkdir(dataDir, { recursive: true });
const temporary = snapshotFile + ".tmp";
await writeFile(temporary, JSON.stringify(snapshot, null, 2) + "\n");
// Selected aliases must still resolve to their reviewed stable identities, and
// every repository must have a complete release read. Failures cannot erase history.
if (publicationIssues.length) {
  console.error("Collection incomplete; previous snapshot retained. See " + temporary);
  for (const issue of publicationIssues) console.error(issue);
  process.exitCode = 1;
} else {
  await rename(temporary, snapshotFile);
  console.log("Saved " + snapshot.repositories.length + " canonical repositories; " +
    snapshot.problems.length + " scoped warning(s). " + snapshotFile);
}
