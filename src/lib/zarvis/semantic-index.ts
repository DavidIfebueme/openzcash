/** The committed embedding index: text keys, int8 vectors and the arithmetic over them. Pure; no model and no I/O, so the build script, the runtime and the tests share one layout. */
import { createHash } from "node:crypto";

/** Pinned model: the ONNX export of intfloat/multilingual-e5-small (MIT), int8 weights, 384 dimensions. The revision is a commit of the Hugging Face repository, so a later upload cannot change what the index was built with. */
export const SEMANTIC_MODEL = { id: "Xenova/multilingual-e5-small", revision: "761b726dd34fb83930e26aab4e9ac3899aa1fa78", dtype: "int8", dims: 384 } as const;
/** E5 was trained with these prefixes; a query and a passage embed differently on purpose. */
export const queryText = (question: string) => `query: ${question.trim()}`;
export const embeddingText = (doc: { title: string; section?: string; text: string }) => `passage: ${doc.title}${doc.section ? ` > ${doc.section}` : ""}\n${doc.text.trim()}`;
/** Chunks are keyed by what was embedded, not by position: a corpus refresh that moves a chunk keeps its vector, a changed sentence gets a new one. */
export const contentKey = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 16);
/** One hash over every key of the committed corpora; the build fails when the index was made for a different set. */
export const corpusHash = (keys: Iterable<string>) => createHash("sha256").update([...new Set(keys)].sort().join("\n")).digest("hex");

/** A fresh embedding, or codes carried over from an earlier index so a rebuild never re-quantizes what it did not re-embed. */
export type VectorEntry = { key: string; vector: Float32Array } | { key: string; quantized: { scale: number; codes: Int8Array } };
export type SemanticIndex = { model: string; revision: string; corpusHash: string; dims: number; keys: string[]; scales: Float32Array; codes: Int8Array; positions: Map<string, number> };
const MAGIC = "ZRVSEM01";
const QUANT_MAX = 127;

export function normalize(vector: Float32Array): Float32Array {
  let sum = 0;
  for (const value of vector) sum += value * value;
  const norm = Math.sqrt(sum);
  return norm > 0 ? vector.map((value) => value / norm) : vector.slice();
}
/** Symmetric per-vector int8 quantization: one scale per chunk keeps the file at a quarter of Float32 with a cosine error well under 1%. */
export function quantize(vector: Float32Array): { scale: number; codes: Int8Array } {
  const largest = vector.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  const scale = largest > 0 ? largest / QUANT_MAX : 1;
  return { scale, codes: Int8Array.from(vector, (value) => Math.round(value / scale)) };
}
export function dequantize(scale: number, codes: Int8Array): Float32Array {
  return Float32Array.from(codes, (code) => code * scale);
}
/** Cosine between a unit query vector and the stored unit vector at a position; the stored scale restores magnitude. */
export function similarityAt(index: SemanticIndex, position: number, query: Float32Array): number {
  const { dims, codes, scales } = index; const offset = position * dims; let sum = 0;
  for (let i = 0; i < dims; i++) sum += codes[offset + i] * query[i];
  return sum * scales[position];
}
export function dotProduct(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}
/** Layout: magic, u32 header length, JSON header (model, revision, hash, dims, keys), Float32 scales, then int8 codes. Little-endian; the decoder copies its views, so alignment never matters. */
export function encodeIndex(entries: VectorEntry[], hash: string, model: { id: string; revision: string; dims: number } = SEMANTIC_MODEL): Uint8Array {
  const sorted = [...entries].sort((a, b) => a.key.localeCompare(b.key));
  if (sorted.some((entry) => ("vector" in entry ? entry.vector.length : entry.quantized.codes.length) !== model.dims)) throw new Error("SEMANTIC_INDEX_DIMENSIONS");
  if (new Set(sorted.map((entry) => entry.key)).size !== sorted.length) throw new Error("SEMANTIC_INDEX_DUPLICATE_KEY");
  const header = Buffer.from(JSON.stringify({ model: model.id, revision: model.revision, corpusHash: hash, dims: model.dims, keys: sorted.map((entry) => entry.key) }), "utf8");
  const quantized = sorted.map((entry) => "vector" in entry ? quantize(normalize(entry.vector)) : entry.quantized);
  const scales = Buffer.from(Float32Array.from(quantized, (item) => item.scale).buffer);
  const codes = Buffer.concat(quantized.map((item) => Buffer.from(item.codes.buffer, item.codes.byteOffset, item.codes.byteLength)));
  const length = Buffer.alloc(4); length.writeUInt32LE(header.length);
  return new Uint8Array(Buffer.concat([Buffer.from(MAGIC, "ascii"), length, header, scales, codes]));
}
export function decodeIndex(bytes: Uint8Array): SemanticIndex {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (buffer.length < 12 || buffer.toString("ascii", 0, 8) !== MAGIC) throw new Error("SEMANTIC_INDEX_FORMAT");
  const headerLength = buffer.readUInt32LE(8);
  const header = JSON.parse(buffer.toString("utf8", 12, 12 + headerLength)) as { model: string; revision: string; corpusHash: string; dims: number; keys: string[] };
  const count = header.keys.length, dims = header.dims;
  const scalesStart = 12 + headerLength, codesStart = scalesStart + count * 4;
  if (!Number.isInteger(dims) || dims <= 0 || buffer.length !== codesStart + count * dims) throw new Error("SEMANTIC_INDEX_FORMAT");
  const scales = new Float32Array(Uint8Array.prototype.slice.call(buffer, scalesStart, codesStart).buffer);
  const codes = new Int8Array(Uint8Array.prototype.slice.call(buffer, codesStart).buffer);
  return { model: header.model, revision: header.revision, corpusHash: header.corpusHash, dims, keys: header.keys, scales, codes, positions: new Map(header.keys.map((key, i) => [key, i])) };
}
