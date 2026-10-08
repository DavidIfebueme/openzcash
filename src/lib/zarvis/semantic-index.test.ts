import { describe, expect, it } from "vitest";
import { contentKey, corpusHash, decodeIndex, dequantize, dotProduct, embeddingText, encodeIndex, normalize, quantize, queryText, similarityAt, SEMANTIC_MODEL } from "./semantic-index";

/** Deterministic pseudo-random unit vectors, so the round trip is checked on realistic magnitudes without a model. */
function vector(seed: number, dims = SEMANTIC_MODEL.dims): Float32Array {
  let state = seed * 2654435761 + 1;
  return normalize(Float32Array.from({ length: dims }, () => { state = (state * 1103515245 + 12345) % 2147483648; return state / 2147483648 - 0.5; }));
}
describe("Semantic index: keys, quantization and the binary layout", () => {
  it("prefixes queries and passages the way E5 expects and keys chunks by their embedded text", () => {
    expect(queryText("  Como funciona?  ")).toBe("query: Como funciona?");
    expect(embeddingText({ title: "ZIP 310: Security Properties", section: "Abstract", text: "An incoming viewing key...\n" })).toBe("passage: ZIP 310: Security Properties > Abstract\nAn incoming viewing key...");
    expect(embeddingText({ title: "zcg", text: "Totals" })).toBe("passage: zcg\nTotals");
    expect(contentKey("same")).toBe(contentKey("same")); expect(contentKey("same")).not.toBe(contentKey("other")); expect(contentKey("x")).toMatch(/^[0-9a-f]{16}$/);
    expect(corpusHash(["b", "a", "a"])).toBe(corpusHash(["a", "b"])); expect(corpusHash(["a"])).not.toBe(corpusHash(["a", "b"]));
  });
  it("keeps cosine within 1% through int8 quantization", () => {
    const a = vector(1), b = vector(2);
    const qa = quantize(a);
    expect(dotProduct(dequantize(qa.scale, qa.codes), a)).toBeCloseTo(1, 2);
    expect(dotProduct(dequantize(qa.scale, qa.codes), b)).toBeCloseTo(dotProduct(a, b), 2);
    expect(quantize(new Float32Array(4)).codes).toEqual(new Int8Array(4));
  });
  it("round-trips entries through the binary file in key order and rejects corrupt bytes", () => {
    const entries = [{ key: "k2", vector: vector(2) }, { key: "k1", vector: vector(1) }, { key: "k3", vector: vector(3) }];
    const bytes = encodeIndex(entries, "hash-1");
    const index = decodeIndex(bytes);
    expect(index).toMatchObject({ model: SEMANTIC_MODEL.id, revision: SEMANTIC_MODEL.revision, corpusHash: "hash-1", dims: SEMANTIC_MODEL.dims, keys: ["k1", "k2", "k3"] });
    expect(bytes.length).toBeLessThan(3 * (SEMANTIC_MODEL.dims + 4) + 400);
    for (const entry of entries) {
      const position = index.positions.get(entry.key)!;
      expect(similarityAt(index, position, entry.vector)).toBeCloseTo(1, 2);
      expect(similarityAt(index, position, vector(9))).toBeCloseTo(dotProduct(entry.vector, vector(9)), 2);
    }
    expect(() => decodeIndex(bytes.slice(0, bytes.length - 1))).toThrow("SEMANTIC_INDEX_FORMAT");
    expect(() => decodeIndex(new TextEncoder().encode("not an index"))).toThrow("SEMANTIC_INDEX_FORMAT");
    expect(() => encodeIndex([{ key: "k", vector: new Float32Array(3) }], "h")).toThrow("SEMANTIC_INDEX_DIMENSIONS");
    expect(() => encodeIndex([{ key: "k", vector: vector(1) }, { key: "k", vector: vector(2) }], "h")).toThrow("SEMANTIC_INDEX_DUPLICATE_KEY");
  });
});
