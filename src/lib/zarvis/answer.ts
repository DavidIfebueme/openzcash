import type { Response as OpenAIResponse } from "openai/resources/responses/responses";
import { safeSourceUrl } from "./sources";
import type { ZarvisSource } from "./types";

/** Convert provider citation annotations into clickable, allowlisted source links. */
export function renderResponse(response: OpenAIResponse): { text: string; sources: ZarvisSource[] } {
  const sources = new Map<string, ZarvisSource>();
  const paragraphs: string[] = [];
  for (const item of response.output) {
    if (item.type !== "message") continue;
    for (const part of item.content) {
      if (part.type === "refusal") { paragraphs.push(part.refusal); continue; }
      if (part.type !== "output_text") continue;
      let text = part.text;
      const citations = (part.annotations ?? []).filter((a) => a.type === "url_citation").sort((a, b) => b.start_index - a.start_index);
      for (const citation of citations) {
        const url = safeSourceUrl(citation.url);
        if (!url) continue;
        const title = (citation.title || "Source").replace(/[\[\]\r\n]/g, " ").slice(0, 150) || "Source";
        sources.set(url, { title, url, retrievedAt: new Date().toISOString() });
        if (citation.start_index >= 0 && citation.end_index > citation.start_index && citation.end_index <= text.length)
          text = text.slice(0, citation.start_index) + `[${title}](${url})` + text.slice(citation.end_index);
      }
      // xAI can return zero-offset source inventories and internal citation markers.
      // Inventories belong in the source list, never inserted at the start of the prose.
      paragraphs.push(text.replace(/\uE200render_inline_citation[^\r\n\u0081]{0,500}\u0081/gu, "").replace(/\uE200[^\uE201]*\uE201/gu, ""));
    }
  }
  return { text: paragraphs.join("\n\n"), sources: [...sources.values()] };
}

export function citedSources(text: string, candidates: ZarvisSource[]) {
  const cited = new Set(Array.from(text.matchAll(/https:\/\/[^\s<>"\])]+/g), (m) => safeSourceUrl(m[0].replace(/[.,;!?]+$/, ""))).filter(Boolean));
  return [...new Map(candidates.filter((source) => cited.has(source.url)).map((source) => [source.url, source])).values()].slice(0, 20);
}
