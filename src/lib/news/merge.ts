import type { NewsItem, NewsReference } from "./feed";
import { titlesMatch } from "@/lib/zcg/match-titles";

export function newsReferences(item: NewsItem): NewsReference[] {
  return item.references?.length ? item.references : [{
    source: item.source === "application" ? "github" : item.source,
    url: item.url, publishedAt: item.ts,
  }];
}

/** Topic slugs, post numbers and tracking fragments are not source identities. */
function identity(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    if (["forum.zcashcommunity.com", "forum.z.cash"].includes(u.hostname)) {
      const parts = u.pathname.split("/");
      const id = parts[1] === "t" ? (/^\d+$/.test(parts[2] ?? "") ? parts[2] : /^\d+$/.test(parts[3] ?? "") ? parts[3] : null) : null;
      return id ? `forum:${id}` : null;
    }
    if (u.hostname === "github.com" && /^\/[^/]+\/[^/]+\/issues\/\d+\/?$/.test(u.pathname)) {
      return `github:${u.pathname.toLowerCase().replace(/\/$/, "")}`;
    }
  } catch { /* Relative navigation links cannot establish shared identity. */ }
  return null;
}

const proposal = (item: NewsItem) => item.source === "proposal" || item.source === "application";
const title = (text: string) => text.replace(/^\s*(?:zcg\s+)?(?:grant\s+)?(?:application|proposal)\s*[-—:–]?\s*/i, "");
const rank = (item: NewsItem) => item.source === "application" ? 2 : item.source === "proposal" ? 1 : 0;

/** One proposal, all source links. Same-source records and unrelated events stay distinct. */
export function mergeNews(items: NewsItem[]): NewsItem[] {
  const groups: NewsItem[][] = [];
  for (const item of items) {
    const candidates = groups.filter(group => {
      if (group.some(other => other.source === item.source)) return false;
      if (item.program && group.some(other => other.program && other.program !== item.program)) return false;
      if (!group.some(other => proposal(other) || proposal(item))) return false;
      if (!["forum", "proposal", "application"].includes(item.source) ||
          group.some(other => !["forum", "proposal", "application"].includes(other.source))) return false;
      const incoming = newsReferences(item).map(ref => identity(ref.url)).filter(Boolean);
      const existing = group.flatMap(other => newsReferences(other).map(ref => identity(ref.url))).filter(Boolean);
      // Two explicit GitHub issues must never be merged through similar titles.
      const a = incoming.filter(id => id!.startsWith("github:"));
      const b = existing.filter(id => id!.startsWith("github:"));
      if (a.length && b.length && !a.some(id => b.includes(id))) return false;
      return incoming.some(id => existing.includes(id)) || group.some(other =>
        title(other.title).toLowerCase() === title(item.title).toLowerCase() || titlesMatch(title(other.title), title(item.title)),
      );
    });
    // An ambiguous title is safer as a separate row than an incorrect association.
    if (candidates.length === 1) candidates[0].push(item);
    else groups.push([item]);
  }
  return groups.map(group => {
    const primary = [...group].sort((a, b) => rank(b) - rank(a))[0];
    const refs = new Map<string, NewsReference>();
    for (const item of group) for (const ref of newsReferences(item)) {
      const key = identity(ref.url) ?? ref.url;
      const prior = refs.get(key);
      if (!prior || (ref.publishedAt ?? "") > (prior.publishedAt ?? "")) refs.set(key, ref);
    }
    return {
      ...primary,
      source: proposal(primary) ? "proposal" as const : primary.source,
      ts: group.reduce((latest, item) => item.ts > latest ? item.ts : latest, primary.ts),
      references: [...refs.values()].sort((a, b) => a.source.localeCompare(b.source)),
    };
  }).sort((a, b) => b.ts.localeCompare(a.ts));
}
