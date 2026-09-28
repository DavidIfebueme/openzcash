import "server-only";
import type { Tool } from "openai/resources/responses/responses";
import { z } from "zod";
import { bundledZipCorpus, searchKnowledge } from "./knowledge";
import { createZipStore } from "./zip-source";
import { zipCatalogEvidence } from "./zip-catalog";
import { boundedRead } from "./timeout";
const store = createZipStore(bundledZipCorpus);
export const getZipCorpus = (signal: AbortSignal) => boundedRead(() => store.get(), signal, 9_000);
const querySchema = z.object({ query: z.string().trim().min(1).max(300) }).strict();
export const zipTool: Tool = {
  type: "function", name: "lookup_zcash_zips", strict: true,
  description: "Search the complete internal official ZIP/draft corpus and catalog before external research. Returns dated status/Created metadata and relevant document passages. Name a ZIP number and the missing aspect to retrieve more detail. Does not search the web with an AI provider.",
  parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false },
};
export async function lookupZips(args: unknown, signal: AbortSignal) {
  const parsed = querySchema.safeParse(args);
  if (!parsed.success) return { content: JSON.stringify({ error: "Invalid ZIP lookup query." }) };
  const { corpus, stale } = await getZipCorpus(signal);
  const catalog = zipCatalogEvidence(parsed.data.query, corpus, stale);
  return { ...catalog, content: JSON.stringify({ ...JSON.parse(catalog.content), documents: searchKnowledge(parsed.data.query, 4, 5000, corpus) }) };
}
