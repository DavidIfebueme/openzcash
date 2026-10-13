import "server-only";
import { ghHeaders } from "@/lib/zcg/github-headers";
import type { NewsItem } from "./feed";
import { RELEASE_REFRESH_MS } from "./config";

export const NEWS_GITHUB_REPOSITORIES = [
  "ZcashFoundation/zebra", "zingolabs/zaino", "zcash/zcash",
  "zcash/librustzcash", "zcash/zallet",
] as const;
export type NewsGitHubHealth = {
  repository: string;
  status: "live" | "cached" | "unavailable" | "unchecked";
  fetchedAt: string | null;
  lastSuccessAt: string | null;
};
type Entry = { health: NewsGitHubHealth; items: NewsItem[] | null };
type Store = { entries: Map<string, Entry>; inflight: Map<string, Promise<NewsItem[]>> };
type Dependencies = { fetcher?: typeof fetch; now?: () => number; ttlMs?: number; store?: Store };

function releases(value: unknown, repository: string): NewsItem[] {
  if (!Array.isArray(value)) throw new Error("GITHUB_RELEASES_UNAVAILABLE");
  const name = repository.split("/")[1];
  return value.flatMap(row => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("GITHUB_RELEASES_UNAVAILABLE");
    if (row.draft === true) return [];
    if (typeof row.published_at !== "string" || !Number.isFinite(Date.parse(row.published_at)) ||
        typeof row.tag_name !== "string" || !row.tag_name.trim() || typeof row.html_url !== "string") throw new Error("GITHUB_RELEASES_UNAVAILABLE");
    const url = new URL(row.html_url);
    if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password ||
        !url.pathname.toLowerCase().startsWith(`/${repository.toLowerCase()}/releases/`)) throw new Error("GITHUB_RELEASES_UNAVAILABLE");
    return [{ id: `github:${url.href}`, source: "github" as const, kind: name,
      title: `${name} ${typeof row.name === "string" && row.name.trim() ? row.name : row.tag_name}`,
      url: url.href, ts: new Date(row.published_at).toISOString() }];
  });
}

/** Each repository retains its own last good response; an explicit [] is a success. */
export function createGitHubNewsReader({ fetcher = fetch, now = Date.now, ttlMs = RELEASE_REFRESH_MS,
  store = { entries: new Map(), inflight: new Map() },
}: Dependencies = {}) {
  function health(): NewsGitHubHealth[] {
    return NEWS_GITHUB_REPOSITORIES.map(repository => ({ ...(store.entries.get(repository)?.health ?? {
      repository, status: "unchecked" as const, fetchedAt: null, lastSuccessAt: null,
    }) }));
  }
  function read(repository: string): Promise<NewsItem[]> {
    if (!NEWS_GITHUB_REPOSITORIES.some(repo => repo === repository)) return Promise.resolve([]);
    const previous = store.entries.get(repository);
    if (previous?.health.fetchedAt && now() - Date.parse(previous.health.fetchedAt) < ttlMs) return Promise.resolve(previous.items ?? []);
    const pending = store.inflight.get(repository);
    if (pending) return pending;
    const request = (async () => {
      try {
        const response = await fetcher(`https://api.github.com/repos/${repository}/releases?per_page=2`, {
          headers: ghHeaders(), signal: AbortSignal.timeout(7_000), cache: "no-store", redirect: "error",
        });
        if (!response.ok) throw new Error("GITHUB_RELEASES_UNAVAILABLE");
        const items = releases(await response.json(), repository);
        const fetchedAt = new Date(now()).toISOString();
        store.entries.set(repository, { items, health: { repository, status: "live", fetchedAt, lastSuccessAt: fetchedAt } });
        return items;
      } catch {
        const prior = store.entries.get(repository);
        const fetchedAt = new Date(now()).toISOString();
        store.entries.set(repository, { items: prior?.items ?? null, health: {
          repository, status: prior?.items !== null && prior?.items !== undefined ? "cached" : "unavailable",
          fetchedAt, lastSuccessAt: prior?.health.lastSuccessAt ?? null,
        } });
        return prior?.items ?? [];
      }
    })().finally(() => { store.inflight.delete(repository); });
    store.inflight.set(repository, request);
    return request;
  }
  return { read, health };
}

// Next may bundle readers separately for page and navigation routes. Share the
// public last-good responses in this Node process; credentials are never stored.
const globalStore = globalThis as typeof globalThis & { __openZcashNewsGitHub?: Store };
const reader = createGitHubNewsReader({ store: globalStore.__openZcashNewsGitHub ??= { entries: new Map(), inflight: new Map() } });
export const readGitHubNews = reader.read;
export const githubNewsHealth = reader.health;
