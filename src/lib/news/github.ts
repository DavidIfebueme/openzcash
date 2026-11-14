import "server-only";
import { ghHeaders } from "@/lib/zcg/github-headers";
import type { NewsItem } from "./feed";
import { RELEASE_REFRESH_MS, RELEASE_RETRY_MS } from "./config";

export const NEWS_GITHUB_REPOSITORIES = [
  "ZcashFoundation/zebra", "zingolabs/zaino", "zcash/zcash",
  "zcash/librustzcash", "zcash/zallet",
  "zakura-core/zakura",
  "zodl-inc/zodl-android", "zodl-inc/zodl-ios",
  "zodl-inc/zodl-swift-wallet-sdk", "zodl-inc/zodl-android-wallet-sdk",
  "ShieldedLabs/crosslink_monolith",
  "ZcashFoundation/zeeder", "ZcashFoundation/zc",
  "zcash/lightwalletd", "zcash/zcash-swift-wallet-sdk",
  "zingolabs/zingolib", "zingolabs/zingo-mobile", "zingolabs/zingo-pc",
] as const;
/** Active repositories ship several releases a week; the feed window trims older ones. */
const RELEASES_PER_REPOSITORY = 5;
export type NewsGitHubHealth = {
  repository: string;
  status: "live" | "cached" | "unavailable" | "unchecked";
  fetchedAt: string | null;
  lastSuccessAt: string | null;
  /** Failed reads in a row since the last success. */
  failures: number;
};
type Entry = { health: NewsGitHubHealth; items: NewsItem[] | null };
type Store = { entries: Map<string, Entry>; inflight: Map<string, Promise<NewsItem[]>> };
const INVALID = "GITHUB_RELEASES_UNAVAILABLE";
type Dependencies = { fetcher?: typeof fetch; now?: () => number; ttlMs?: number; retryMs?: number; store?: Store };

/** The class of a failed read for the server log: never a response body, header or credential. */
function failureReason(error: unknown): string {
  const { name, message, cause } = (error ?? {}) as { name?: unknown; message?: unknown; cause?: { message?: unknown } };
  if (typeof message === "string" && /^HTTP \d{3}$/.test(message)) return message;
  if (name === "TimeoutError") return "timeout";
  if (cause?.message === "unexpected redirect") return "redirected";
  return message === INVALID || name === "SyntaxError" ? "unexpected response" : "network error";
}

function releases(value: unknown, repository: string): NewsItem[] {
  if (!Array.isArray(value)) throw new Error(INVALID);
  const name = repository.split("/")[1];
  return value.flatMap(row => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(INVALID);
    if (row.draft === true) return [];
    if (typeof row.published_at !== "string" || !Number.isFinite(Date.parse(row.published_at)) ||
        typeof row.tag_name !== "string" || !row.tag_name.trim() || typeof row.html_url !== "string" || !URL.canParse(row.html_url)) throw new Error(INVALID);
    const url = new URL(row.html_url);
    if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password ||
        !url.pathname.toLowerCase().startsWith(`/${repository.toLowerCase()}/releases/`)) throw new Error(INVALID);
    return [{ id: `github:${url.href}`, source: "github" as const, kind: name,
      title: `${name} ${typeof row.name === "string" && row.name.trim() ? row.name : row.tag_name}${row.prerelease === true ? " (pre-release)" : ""}`,
      url: url.href, ts: new Date(row.published_at).toISOString() }];
  });
}

/** One missed read is repeated within minutes; a repository is behind once that also fails or nothing is verified yet. */
export function githubNewsBehind(health: NewsGitHubHealth[]): NewsGitHubHealth[] {
  return health.filter(source => source.status === "unavailable" || (source.status === "cached" && source.failures > 1));
}

/** Each repository retains its own last good response; an explicit [] is a success. */
export function createGitHubNewsReader({ fetcher = fetch, now = Date.now, ttlMs = RELEASE_REFRESH_MS, retryMs = RELEASE_RETRY_MS,
  store = { entries: new Map(), inflight: new Map() },
}: Dependencies = {}) {
  /** A failed read is repeated sooner than the schedule; the wait doubles, up to the schedule, while it keeps failing. */
  const spacing = (failures: number) => failures ? Math.min(ttlMs, retryMs * 2 ** (failures - 1)) : ttlMs;
  /** GitHub can refuse a credential for one organization while its releases stay public: such a read is repeated once as any visitor's. */
  async function fetchReleases(repository: string): Promise<Response> {
    const { authorization, ...anonymous } = ghHeaders();
    const send = (headers: Record<string, string>) => fetcher(`https://api.github.com/repos/${repository}/releases?per_page=${RELEASES_PER_REPOSITORY}`, {
      headers, signal: AbortSignal.timeout(7_000), cache: "no-store", redirect: "error",
    });
    const response = await send(authorization ? { ...anonymous, authorization } : anonymous);
    if (!authorization || (response.status !== 401 && response.status !== 403)) return response;
    void response.body?.cancel().catch(() => {});
    console.error(`[news] GitHub ${repository} refused the configured credential (HTTP ${response.status}); reading without it`);
    return send(anonymous);
  }
  function health(): NewsGitHubHealth[] {
    return NEWS_GITHUB_REPOSITORIES.map(repository => ({ ...(store.entries.get(repository)?.health ?? {
      repository, status: "unchecked" as const, fetchedAt: null, lastSuccessAt: null, failures: 0,
    }) }));
  }
  function read(repository: string): Promise<NewsItem[]> {
    if (!NEWS_GITHUB_REPOSITORIES.some(repo => repo === repository)) return Promise.resolve([]);
    const previous = store.entries.get(repository);
    if (previous?.health.fetchedAt && now() - Date.parse(previous.health.fetchedAt) < spacing(previous.health.failures)) return Promise.resolve(previous.items ?? []);
    const pending = store.inflight.get(repository);
    if (pending) return pending;
    const request = (async () => {
      try {
        const response = await fetchReleases(repository);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const items = releases(await response.json(), repository);
        const fetchedAt = new Date(now()).toISOString();
        store.entries.set(repository, { items, health: { repository, status: "live", fetchedAt, lastSuccessAt: fetchedAt, failures: 0 } });
        return items;
      } catch (error) {
        const prior = store.entries.get(repository);
        const kept = prior?.items !== null && prior?.items !== undefined;
        const fetchedAt = new Date(now()).toISOString();
        console.error(`[news] GitHub ${repository} refresh failed (${failureReason(error)}); ${kept ? "keeping last successful response" : "no previous response"}`);
        store.entries.set(repository, { items: prior?.items ?? null, health: {
          repository, status: kept ? "cached" : "unavailable",
          fetchedAt, lastSuccessAt: prior?.health.lastSuccessAt ?? null, failures: (prior?.health.failures ?? 0) + 1,
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
