/** The local embedding model: transformers.js on Node with the pinned int8 weights, read from the directory the build fetched. Never a network call at request time, never a hosted API. */
import { existsSync } from "node:fs";
import path from "node:path";
import { SEMANTIC_MODEL } from "./semantic-index";

/** Embeds already-prefixed texts (queryText / embeddingText) into unit vectors, one Float32Array per input, in input order. */
export type Embedder = (texts: string[]) => Promise<Float32Array[]>;
/** Where scripts/fetch-zarvis-model.mjs puts the files: inside the app directory, which Nixpacks keeps for the running service. */
export const modelDirectory = () => process.env.ZARVIS_MODEL_DIR || path.join(process.cwd(), ".cache", "zarvis-models");
/** The four files transformers.js reads for this model; the fetch script pins their hashes. */
export const MODEL_FILES = ["config.json", "tokenizer.json", "tokenizer_config.json", `onnx/model_${SEMANTIC_MODEL.dtype}.onnx`] as const;
export const modelFilesPresent = (dir = modelDirectory()) => MODEL_FILES.every((file) => existsSync(path.join(dir, SEMANTIC_MODEL.id, file)));
/** The committed index, read from the source tree at runtime like the lightwalletd protos are. */
export const indexPath = () => process.env.ZARVIS_SEMANTIC_INDEX || path.join(process.cwd(), "src", "lib", "zarvis", "semantic-index.bin");

let loading: Promise<Embedder> | undefined;
/** Loads once per process and shares the promise; a failed load is not cached, so a later warm can retry after the files appear. */
export function loadEmbedder(dir = modelDirectory()): Promise<Embedder> {
  loading ??= createEmbedder(dir).catch((error: unknown) => { loading = undefined; throw error; });
  return loading;
}
async function createEmbedder(dir: string): Promise<Embedder> {
  if (!modelFilesPresent(dir)) throw new Error("SEMANTIC_MODEL_MISSING");
  const { env, pipeline } = await import("@huggingface/transformers");
  env.localModelPath = dir; env.allowLocalModels = true; env.allowRemoteModels = false;
  const extractor = await pipeline("feature-extraction", SEMANTIC_MODEL.id, { dtype: SEMANTIC_MODEL.dtype });
  return async (texts) => {
    if (!texts.length) return [];
    // The pipeline pads and truncates at the tokenizer's 512-token limit; a chunk is at most ~1,400 characters, so nothing is cut.
    const output = await extractor(texts, { pooling: "mean", normalize: true });
    const data = output.data as Float32Array; const dims = output.dims[1];
    if (dims !== SEMANTIC_MODEL.dims) throw new Error("SEMANTIC_MODEL_DIMENSIONS");
    return texts.map((_, i) => data.slice(i * dims, (i + 1) * dims));
  };
}
export function resetEmbedderForTests() { loading = undefined; }
