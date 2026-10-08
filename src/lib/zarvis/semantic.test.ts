import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { bundledZipCorpus, knowledgeChunks, searchKnowledge, semanticBonus, SEMANTIC_FUSION, type ExternalCorpus } from "./knowledge";
import { decodeIndex, encodeIndex, normalize, SEMANTIC_MODEL } from "./semantic-index";
import { createSemanticRetriever, retrieveKnowledge, type SemanticRetriever } from "./semantic";
import { MODEL_FILES } from "./semantic-model";
import { MODEL } from "../../../scripts/fetch-zarvis-model.mjs";

/** A bilingual toy embedder: each concept is one axis, and the Portuguese and English words for it land on the same axis; text with no concept is the zero vector (similarity 0 to everything). Deterministic, no model. */
const CONCEPTS = [/\b(?:zashi|wallet|carteira|app|aplicativo)\b/, /\b(?:fast|faster|veloz|rapid[ao]|performance|desempenho)\b/, /\b(?:restore|restauracao|recovery|recuperacao)\b/, /\b(?:tor|protection|protecao|protege)\b/, /\b(?:election|eleicao|voting|votacao)\b/, /\b(?:recipe|receita|lasagne|lasanha)\b/];
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const toyVector = (text: string) => normalize(Float32Array.from({ length: SEMANTIC_MODEL.dims }, (_, i) => i < CONCEPTS.length ? (fold(text).match(new RegExp(CONCEPTS[i].source, "g")) ?? []).length : 0));
const toyEmbedder = async (texts: string[]) => texts.map(toyVector);
const blogUrl = "https://electriccoin.co/blog/zashi-2-4-9-is-faster/";
const fixture: ExternalCorpus = { version: 1, retrievedAt: "2026-10-08T00:00:00.000Z", sources: [
  { id: "blog:electriccoin.co:zashi-2-4-9", kind: "official blog", site: "electriccoin.co", title: "Zashi 2.4.9 Is Faster!", url: blogUrl, publishedOn: "2025-12-04", retrievedAt: "2026-10-08T00:00:00.000Z", sha256: "a".repeat(64), author: null, source: null,
    text: "Electric Coin Company announces Zashi 2.4.9 with a performance boost and Tor protection in the restore flow. The update reduces sync time on older phones and keeps the recovery phrase screen behind biometrics. ".repeat(2) },
  { id: "forum:53533", kind: "forum topic", site: "forum.zcashcommunity.com", title: "Proposal to switch ZCG elections to token holder voting", url: "https://forum.zcashcommunity.com/t/53533", publishedOn: "2025-11-02", retrievedAt: "2026-10-08T00:00:00.000Z", sha256: "c".repeat(64), author: "example", source: null,
    text: "This forum thread proposes that ZCG committee elections move from ZCAP polls to coinholder token voting. Discussion of governance trade-offs follows. ".repeat(3) },
] };
/** The Portuguese question shares no indexed keyword with the English post ("aplicativo", "veloz", "protege" and "restauração" have no alias), so keyword retrieval alone abstains. */
const paraphrase = "O aplicativo ficou veloz e protege a restauração?";
const toyRetriever = (overrides: Partial<Parameters<typeof createSemanticRetriever>[0]> = {}, indexed = knowledgeChunks(bundledZipCorpus, fixture)) => createSemanticRetriever({
  index: async () => decodeIndex(encodeIndex(indexed.map((chunk) => ({ key: chunk.key, vector: toyVector(chunk.text) })), "toy")),
  embedder: async () => toyEmbedder, report: vi.fn(), ...overrides,
});
const urls = (docs: Array<{ url: string }>) => docs.map((doc) => doc.url);

describe("Semantic fusion policy", () => {
  it("adds nothing below the floor, the full weight from the ceiling, and lets a chunk without keyword evidence in only when it is long and clearly close", () => {
    expect(semanticBonus(undefined, true, 1000)).toBe(0); expect(semanticBonus(NaN, true, 1000)).toBe(0);
    expect(semanticBonus(SEMANTIC_FUSION.floor, true, 1000)).toBe(0);
    expect(semanticBonus((SEMANTIC_FUSION.floor + SEMANTIC_FUSION.ceiling) / 2, true, 1000)).toBeCloseTo(SEMANTIC_FUSION.weight / 2, 6);
    expect(semanticBonus(SEMANTIC_FUSION.ceiling, true, 1000)).toBe(SEMANTIC_FUSION.weight); expect(semanticBonus(0.99, true, 1000)).toBe(SEMANTIC_FUSION.weight);
    expect(semanticBonus(SEMANTIC_FUSION.entryFloor - 0.001, false, 1000)).toBe(0);
    expect(semanticBonus(SEMANTIC_FUSION.entryFloor, false, SEMANTIC_FUSION.entryMinChars - 1)).toBe(0);
    expect(semanticBonus(SEMANTIC_FUSION.entryFloor, false, SEMANTIC_FUSION.entryMinChars)).toBeGreaterThan(0);
  });
  it("pins the same model in the fetch script and the index module", () => {
    expect(MODEL.id).toBe(SEMANTIC_MODEL.id); expect(MODEL.revision).toBe(SEMANTIC_MODEL.revision);
    expect(Object.keys(MODEL.files).sort()).toEqual([...MODEL_FILES].sort());
  });
});
describe("Semantic retrieval with a deterministic embedder", () => {
  it("reaches the English chunk from a Portuguese paraphrase that shares no keyword with it", async () => {
    expect(urls(searchKnowledge(paraphrase, 4, 5000, undefined, fixture))).not.toContain(blogUrl);
    const retriever = toyRetriever();
    const docs = await retrieveKnowledge(paraphrase, 4, 5000, undefined, fixture, retriever);
    expect(retriever.status()).toBe("ready");
    expect(docs[0]?.url).toBe(blogUrl); expect(docs[0]?.kind).toBe("official blog");
  });
  it("still abstains on an unrelated question: similarity alone never selects a chunk under the floor", async () => {
    const retriever = toyRetriever();
    expect(await retrieveKnowledge("receita de lasanha", 4, 5000, undefined, fixture, retriever)).toEqual([]);
    expect(await retrieveKnowledge("zzzzunknownphrasezzzz", 4, 5000, undefined, fixture, retriever)).toEqual([]);
  });
  it("is identical to keyword retrieval when the model is disabled, still loading, or failed", async () => {
    const question = "What did ECC announce about Zashi 2.4.9?";
    const keyword = searchKnowledge(question, 4, 5000, undefined, fixture);
    expect(await retrieveKnowledge(question, 4, 5000, undefined, fixture, toyRetriever({ enabled: () => false }))).toEqual(keyword);
    const slow = toyRetriever({ embedder: () => new Promise(() => {}), timeoutMs: 20 });
    expect(await retrieveKnowledge(question, 4, 5000, undefined, fixture, slow)).toEqual(keyword);
    expect(slow.status()).toBe("loading");
    const report = vi.fn();
    const failed = toyRetriever({ embedder: async () => { throw new Error("SEMANTIC_MODEL_MISSING"); }, report });
    expect(await retrieveKnowledge(question, 4, 5000, undefined, fixture, failed)).toEqual(keyword);
    expect(await retrieveKnowledge(paraphrase, 4, 5000, undefined, fixture, failed)).toEqual([]);
    expect(failed.status()).toBe("unavailable"); expect(report).toHaveBeenCalledTimes(1); expect(report).toHaveBeenCalledWith("SEMANTIC_MODEL_MISSING");
  });
  it("embeds chunks the index does not know in the background and ranks them by keywords until then", async () => {
    // The index was built before the fixture post existed, the way a runtime ZIP refresh brings new documents.
    const retriever = toyRetriever({ batchSize: 2 }, knowledgeChunks(bundledZipCorpus, fixture).filter((chunk) => !chunk.text.includes("Zashi 2.4.9")));
    expect(await retrieveKnowledge(paraphrase, 4, 5000, undefined, fixture, retriever)).toEqual([]);
    await vi.waitFor(() => expect(retriever.extraVectors()).toBeGreaterThan(0));
    expect((await retrieveKnowledge(paraphrase, 4, 5000, undefined, fixture, retriever))[0]?.url).toBe(blogUrl);
  });
  it("bounds the vectors kept for chunks embedded after the build", async () => {
    const retriever: SemanticRetriever = toyRetriever({ extraLimit: 1, batchSize: 1 }, []);
    await retrieveKnowledge(paraphrase, 4, 5000, undefined, fixture, retriever);
    await vi.waitFor(() => expect(retriever.extraVectors()).toBe(1));
    await retrieveKnowledge("another question entirely", 4, 5000, undefined, fixture, retriever);
    await new Promise((resolve) => setImmediate(resolve));
    expect(retriever.extraVectors()).toBe(1);
  });
});
