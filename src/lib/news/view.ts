import { newsReferences } from "./merge";
import type { NewsItem, NewsSource } from "./feed";

export const NEWS_SOURCES = ["forum", "github", "sheet", "proposal", "dao"] as const satisfies readonly NewsSource[];
export const NEW_WINDOW_MS = 48 * 60 * 60 * 1000;
export type NewsSearchParams = { source?: string | string[]; q?: string | string[]; view?: string | string[]; type?: string | string[]; month?: string | string[] };

/** A single selection drives the rows, counters and links, including shared URLs. */
export function newsView(items: NewsItem[], params: NewsSearchParams, now: number) {
  const rawSource = Array.isArray(params.source) ? params.source[0] : params.source;
  const source = NEWS_SOURCES.find(value => value === (rawSource === "application" ? "proposal" : rawSource));
  const query = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() ?? "";
  const needle = query.toLowerCase();
  const matches = items.filter(item =>
    !needle || `${item.title} ${item.author ?? ""} ${item.kind ?? ""}`.toLowerCase().includes(needle),
  );
  const counts = Object.fromEntries(NEWS_SOURCES.map(value =>
    [value, matches.filter(item => hasSource(item, value)).length],
  )) as Record<typeof NEWS_SOURCES[number], number>;
  const shown = source ? matches.filter(item => hasSource(item, source)) : matches;
  const newCount = shown.filter(item => Date.parse(item.ts) > now - NEW_WINDOW_MS).length;
  return { source, query, shown, counts, totalCount: matches.length, newCount };
}

/** Forum cross-posts remain discoverable without duplicating the All sources list. */
export function hasSource(item: NewsItem, source: NewsSource): boolean {
  if (source === "proposal") return item.source === "proposal" || item.source === "application";
  if (source === "forum") return newsReferences(item).some(ref => ref.source === "forum");
  return item.source === source;
}
