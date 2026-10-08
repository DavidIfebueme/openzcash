/** Fetches the pinned embedding model into .cache/zarvis-models before the build (prebuild/predev). Public open-weight files from the Hugging Face hub, verified by SHA-256; idempotent; no hosted API and no credential. */
import { createHash } from "node:crypto";
import fs from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Mirrors SEMANTIC_MODEL in src/lib/zarvis/semantic-index.ts; semantic.test.ts asserts they agree. Hashes were taken from the pinned revision. */
export const MODEL = {
  id: "Xenova/multilingual-e5-small", revision: "761b726dd34fb83930e26aab4e9ac3899aa1fa78",
  files: {
    "config.json": "cb99455288675345e1a4f411438d5d0adbba5fbd3a67ea4fb03c015433b996c1",
    "tokenizer.json": "0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39",
    "tokenizer_config.json": "a1d6bc8734a6f635dc158508bef000f8e2e5a759c7d92f984b2c86e5ff53425b",
    "onnx/model_int8.onnx": "4d24e2bc01a447951524466ef533e52944bf48509e6552810bcee1a2711cb02c",
  },
};
const MAX_BYTES = 200_000_000, TIMEOUT_MS = 300_000;
const RETRY = { attempts: 3, delayMs: 2_000 };
export const modelDirectory = () => process.env.ZARVIS_MODEL_DIR || path.join(process.cwd(), ".cache", "zarvis-models");
export const sha256 = async (file) => createHash("sha256").update(await readFile(file)).digest("hex");
export async function verified(file, expected) {
  try { return (await sha256(file)) === expected; } catch { return false; }
}
async function download(url, target, expected, fetcher = fetch) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": "OpenZcash-Zarvis-model-fetch" } });
  if (!response.ok || Number(response.headers.get("content-length")) > MAX_BYTES) throw new Error("MODEL_SOURCE_UNAVAILABLE");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_BYTES || createHash("sha256").update(bytes).digest("hex") !== expected) throw new Error("MODEL_HASH_MISMATCH");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(`${target}.tmp`, bytes); await rename(`${target}.tmp`, target);
}
/** Downloads what is missing or corrupt; returns the names fetched. Throws the fixed error class of the last failed attempt. */
export async function fetchModel(dir = modelDirectory(), fetcher = fetch, retry = RETRY) {
  const fetched = [];
  for (const [name, expected] of Object.entries(MODEL.files)) {
    const target = path.join(dir, MODEL.id, name);
    if (await verified(target, expected)) continue;
    let failure;
    for (let attempt = 1; attempt <= retry.attempts; attempt++) {
      try { await download(`https://huggingface.co/${MODEL.id}/resolve/${MODEL.revision}/${name}`, target, expected, fetcher); failure = undefined; break; }
      catch (error) { failure = error; await new Promise((resolve) => setTimeout(resolve, retry.delayMs * attempt)); }
    }
    if (failure) throw failure;
    fetched.push(name);
  }
  return fetched;
}
export const modelPresent = async (dir = modelDirectory()) => { for (const [name, expected] of Object.entries(MODEL.files)) if (!(await verified(path.join(dir, MODEL.id, name), expected))) return false; return true; };
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = modelDirectory();
  if (process.argv.includes("--check")) {
    if (await modelPresent(dir)) console.log("Zarvis embedding model present."); else { console.error("Zarvis embedding model missing: run npm run knowledge:model."); process.exitCode = 1; }
  } else {
    try {
      const fetched = await fetchModel(dir);
      console.log(fetched.length ? `Zarvis embedding model fetched: ${fetched.join(", ")} -> ${dir}` : "Zarvis embedding model present.");
    } catch (error) {
      // The site answers without the model (keyword retrieval); a build should not fail on a hub outage unless the deploy asks for it.
      const reason = error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "unknown";
      if (process.env.ZARVIS_SEMANTIC_REQUIRED === "true") { console.error(`Zarvis embedding model download failed: ${reason}`); process.exitCode = 1; }
      else console.warn(`Zarvis embedding model download failed: ${reason}; semantic retrieval stays off until the next build.`);
    }
  }
  for (const stale of fs.existsSync(path.join(dir, MODEL.id)) ? fs.readdirSync(path.join(dir, MODEL.id), { recursive: true }) : []) if (String(stale).endsWith(".tmp")) fs.rmSync(path.join(dir, MODEL.id, String(stale)), { force: true });
}
