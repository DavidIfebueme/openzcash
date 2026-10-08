/** Semantic retrieval at runtime: one query embedding per question, cosine against the committed index, and background embedding for chunks a corpus refresh brought after the build. Any failure degrades to keyword retrieval with one fixed log line. */
import { readFile } from "node:fs/promises";
import { searchKnowledge, type ExternalCorpus, type KnowledgeDocument, type SemanticChunk, type SemanticQuery } from "./knowledge";
import { decodeIndex, dotProduct, queryText, similarityAt, type SemanticIndex } from "./semantic-index";
import { indexPath, loadEmbedder, type Embedder } from "./semantic-model";
import type { ZipCorpus } from "./zip-source";

export type SemanticStatus = "disabled" | "idle" | "loading" | "ready" | "unavailable";
export type SemanticRetriever = { queryVector(question: string): Promise<Float32Array | null>; semanticQuery(vector: Float32Array): SemanticQuery; warm(): Promise<void>; status(): SemanticStatus; extraVectors(): number };
type Dependencies = { index: () => Promise<SemanticIndex>; embedder: () => Promise<Embedder>; enabled?: () => boolean; report?: (errorClass: string) => void; extraLimit?: number; batchSize?: number; timeoutMs?: number };
/** A visitor never waits on the model: past this the question goes keyword-only while the load keeps warming for the next one. */
export const QUERY_EMBED_TIMEOUT_MS = 1_500;
/** Chunks embedded after the build live in memory only; at 384 floats each this is a few megabytes at most. */
export const EXTRA_VECTOR_LIMIT = 4_000;
const BACKGROUND_BATCH = 16;
const errorClass = (error: unknown) => error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "unknown";
const reportUnavailable = (errorClass: string) => console.warn(`[zarvis] semantic retrieval unavailable: ${errorClass}`);
const withTimeout = <T>(work: Promise<T>, ms: number): Promise<T | null> => new Promise((resolve) => {
  const timer = setTimeout(() => resolve(null), ms);
  work.then((value) => { clearTimeout(timer); resolve(value); }, () => { clearTimeout(timer); resolve(null); });
});

export function createSemanticRetriever(deps: Dependencies): SemanticRetriever {
  const enabled = deps.enabled ?? (() => true), report = deps.report ?? reportUnavailable;
  const extraLimit = deps.extraLimit ?? EXTRA_VECTOR_LIMIT, batchSize = deps.batchSize ?? BACKGROUND_BATCH, timeoutMs = deps.timeoutMs ?? QUERY_EMBED_TIMEOUT_MS;
  let status: SemanticStatus = enabled() ? "idle" : "disabled";
  let loaded: { index: SemanticIndex; embed: Embedder } | undefined, loading: Promise<void> | undefined;
  const extra = new Map<string, Float32Array>(); const queued = new Set<string>(); let backlog: SemanticChunk[] = []; let draining: Promise<void> | undefined;
  // One load per process; a failure is reported once and stays, a restart retries.
  const load = () => {
    if (loaded || status === "disabled" || status === "unavailable") return Promise.resolve();
    status = "loading";
    loading ??= Promise.all([deps.index(), deps.embedder()]).then(([index, embed]) => { loaded = { index, embed }; status = "ready"; }).catch((error: unknown) => { status = "unavailable"; report(errorClass(error)); }).finally(() => { loading = undefined; });
    return loading;
  };
  const drain = async () => {
    while (backlog.length && loaded) {
      const batch = backlog.slice(0, batchSize); backlog = backlog.slice(batchSize);
      try { (await loaded.embed(batch.map((chunk) => chunk.text))).forEach((vector, i) => extra.set(batch[i].key, vector)); }
      catch (error: unknown) { report(`BACKGROUND_${errorClass(error)}`); backlog = []; }
      await new Promise((resolve) => setImmediate(resolve));
    }
  };
  const missing = (chunks: SemanticChunk[]) => {
    if (!loaded) return;
    const fresh: SemanticChunk[] = [];
    for (const chunk of chunks) if (!queued.has(chunk.key) && queued.size < extraLimit) { queued.add(chunk.key); fresh.push(chunk); }
    if (fresh.length) { backlog = [...backlog, ...fresh]; draining ??= drain().finally(() => { draining = undefined; }); }
  };
  return {
    async queryVector(question) {
      if (status === "disabled" || status === "unavailable") return null;
      const vectors = await withTimeout(load().then(() => loaded ? loaded.embed([queryText(question)]) : []), timeoutMs);
      return vectors?.[0] ?? null;
    },
    semanticQuery(vector) {
      return { missing, similarity: (_doc: KnowledgeDocument, key: string) => {
        const position = loaded?.index.positions.get(key);
        if (position !== undefined) return similarityAt(loaded!.index, position, vector);
        const stored = extra.get(key);
        return stored ? dotProduct(stored, vector) : undefined;
      } };
    },
    warm: load, status: () => status, extraVectors: () => extra.size,
  };
}
/** The committed index from the source tree; exported for the real-model tests, which build their own retriever around it. */
export async function readBundledIndex(): Promise<SemanticIndex> {
  const bytes = await readFile(indexPath()).catch(() => { throw new Error("SEMANTIC_INDEX_MISSING"); });
  return decodeIndex(new Uint8Array(bytes));
}
/** The process-wide retriever; ZARVIS_SEMANTIC=false keeps retrieval keyword-only (the unit test run sets it). */
export const semanticRetriever = createSemanticRetriever({ index: readBundledIndex, embedder: () => loadEmbedder(), enabled: () => process.env.ZARVIS_SEMANTIC !== "false" });
export const warmSemantic = () => semanticRetriever.warm();
/** Keyword search fused with the question's meaning; identical to searchKnowledge when the model is off, loading or unavailable. */
export async function retrieveKnowledge(query: string, limit = 4, budget = 5000, corpus?: ZipCorpus, externalCorpus?: ExternalCorpus, retriever: SemanticRetriever = semanticRetriever): Promise<KnowledgeDocument[]> {
  const vector = await retriever.queryVector(query);
  return searchKnowledge(query, limit, budget, corpus, externalCorpus, vector ? retriever.semanticQuery(vector) : undefined);
}
