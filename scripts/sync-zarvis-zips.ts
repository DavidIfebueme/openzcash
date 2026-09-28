/** Full public ZIP sync. Run with node --import tsx; no AI key or model calls. */
import { readFile, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { refreshZipCorpus, type ZipCorpus } from "../src/lib/zarvis/zip-source";
async function main() {
  const target = fileURLToPath(new URL("../src/lib/zarvis/zip-content.json", import.meta.url));
  let old: ZipCorpus | undefined;
  try { old = JSON.parse(await readFile(target, "utf8")); } catch { /* first sync */ }
  const corpus = await refreshZipCorpus(old, { timeoutMs: 180_000, maxChanged: 402 });
  await writeFile(target + ".tmp", JSON.stringify(corpus, null, 2) + "\n");
  await rename(target + ".tmp", target);
  console.log(JSON.stringify({ numbered: corpus.documents.filter((d) => d.number !== null).length, unnumberedDrafts: corpus.documents.filter((d) => d.number === null).length, revision: corpus.revision, retrievedAt: corpus.retrievedAt, characters: corpus.documents.reduce((n, d) => n + d.text.length, 0) }));
}
main().catch((error) => { console.error("ZIP sync failed; previous snapshot preserved.", error instanceof Error ? error.message : "unknown"); process.exitCode = 1; });
