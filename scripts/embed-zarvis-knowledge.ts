/** Embeds every chunk of the committed corpora into src/lib/zarvis/semantic-index.bin with the local model; --check only compares the corpus hash, so the build fails fast on a stale index without loading anything. Run with node --import tsx. No hosted API. */
import { readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { knowledgeChunks } from "../src/lib/zarvis/knowledge";
import { corpusHash, decodeIndex, encodeIndex, SEMANTIC_MODEL, type SemanticIndex, type VectorEntry } from "../src/lib/zarvis/semantic-index";
import { indexPath, loadEmbedder, modelFilesPresent } from "../src/lib/zarvis/semantic-model";

const BATCH = 32;
const current = (index: SemanticIndex | undefined, hash: string) => !!index && index.corpusHash === hash && index.model === SEMANTIC_MODEL.id && index.revision === SEMANTIC_MODEL.revision && index.dims === SEMANTIC_MODEL.dims;
async function existingIndex(target: string): Promise<SemanticIndex | undefined> {
  try { return decodeIndex(new Uint8Array(await readFile(target))); } catch { return undefined; }
}
async function main() {
  const target = indexPath();
  const chunks = knowledgeChunks(); const hash = corpusHash(chunks.map((chunk) => chunk.key));
  const existing = await existingIndex(target);
  if (process.argv.includes("--check")) {
    if (current(existing, hash)) { console.log(`Zarvis semantic index current (${chunks.length} chunks).`); return; }
    console.error("Zarvis semantic index needs rebuilding: run npm run knowledge:embed and commit src/lib/zarvis/semantic-index.bin."); process.exitCode = 1; return;
  }
  if (current(existing, hash) && !process.argv.includes("--force")) { console.log(`Zarvis semantic index current (${chunks.length} chunks).`); return; }
  if (!modelFilesPresent()) { console.error("Zarvis embedding model missing: run npm run knowledge:model first."); process.exitCode = 1; return; }
  // Vectors of unchanged chunks are carried over as stored, so a rebuild re-embeds only what the corpora changed and never re-quantizes.
  const reusable = existing && existing.model === SEMANTIC_MODEL.id && existing.revision === SEMANTIC_MODEL.revision ? existing : undefined;
  const entries: VectorEntry[] = []; const pending: typeof chunks = [];
  for (const chunk of chunks) {
    const position = reusable?.positions.get(chunk.key);
    if (position === undefined) pending.push(chunk);
    else entries.push({ key: chunk.key, quantized: { scale: reusable!.scales[position], codes: reusable!.codes.subarray(position * reusable!.dims, (position + 1) * reusable!.dims) } });
  }
  const started = performance.now();
  const embed = await loadEmbedder();
  for (let offset = 0; offset < pending.length; offset += BATCH) {
    const batch = pending.slice(offset, offset + BATCH);
    (await embed(batch.map((chunk) => chunk.text))).forEach((vector, i) => entries.push({ key: batch[i].key, vector }));
    if ((offset / BATCH) % 10 === 0) console.log(`embedded ${Math.min(offset + BATCH, pending.length)}/${pending.length}`);
  }
  const bytes = encodeIndex(entries, hash);
  await writeFile(`${target}.tmp`, bytes); await rename(`${target}.tmp`, target);
  console.log(JSON.stringify({ chunks: chunks.length, embedded: pending.length, reused: chunks.length - pending.length, bytes: bytes.length, corpusHash: hash, seconds: Math.round((performance.now() - started) / 100) / 10 }));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => { console.error("Zarvis semantic index build failed.", error instanceof Error ? error.message : "unknown"); process.exitCode = 1; });
