export type Feed<T> = {
  data: T | null;
  fetchedAt: string | null;
  checkedAt: string;
  stale: boolean;
  error: string | null;
  refreshing?: boolean;
  refreshAfter?: string;
};

type ReadOptions = { waitForRefresh?: boolean };
type Reader<T> = (options?: ReadOptions) => Promise<Feed<T>>;
type CacheOptions = {
  /** Versioned identity shared by Next's separate page, API and startup bundles. */
  key?: string;
  staleWhileRevalidate?: boolean;
};

const processCache = globalThis as typeof globalThis & {
  __openZcashMarketFeedsV1?: Map<string, Reader<unknown>>;
};
const shared = (processCache.__openZcashMarketFeedsV1 ??= new Map());

/** Bounded retries, shared in-flight work, and truthful dates on saved data. */
export function cachedFeed<T>(
  loader: () => Promise<T>,
  ttl = 5 * 60_000,
  retryPartial?: (data: T) => boolean,
  options: CacheOptions = {},
): Reader<T> {
  // Share the reader, including its collector and source caches. Sharing only
  // the final value would still alternate collectors when another bundle wins.
  const existing = options.key ? shared.get(options.key) : undefined;
  if (existing) return existing as Reader<T>;

  let cache: Feed<T> | null = null;
  let retryAt = 0;
  let pending: Promise<Feed<T>> | null = null;
  const present = (value: Feed<T>): Feed<T> =>
    options.staleWhileRevalidate
      ? {
          ...value,
          stale:
            value.stale ||
            (value.fetchedAt !== null &&
              Date.now() - Date.parse(value.fetchedAt) >= ttl),
          refreshing: pending !== null,
          refreshAfter: new Date(retryAt).toISOString(),
        }
      : value;

  const read: Reader<T> = async ({ waitForRefresh = false } = {}) => {
    if (!pending && cache && Date.now() < retryAt) return present(cache);
    if (!pending) {
      pending = (async () => {
        const checkedAt = new Date().toISOString();
        try {
          const data = await loader();
          cache = {
            data,
            checkedAt,
            fetchedAt: new Date().toISOString(),
            stale: false,
            error: null,
          };
          retryAt =
            Date.now() + (retryPartial?.(data) ? Math.min(ttl, 60_000) : ttl);
        } catch {
          cache = {
            data: cache?.data ?? null,
            fetchedAt: cache?.fetchedAt ?? null,
            checkedAt,
            stale: true,
            error: "Source could not be refreshed",
          };
          retryAt = Date.now() + 60_000;
        }
        return cache;
      })().finally(() => {
        pending = null;
      });
    }
    // Page navigation stays fast after the first collection. Explicit API
    // refreshes join the same work and wait for its atomic publication.
    if (options.staleWhileRevalidate && cache?.data != null && !waitForRefresh)
      return present(cache);
    return present(await pending);
  };
  if (options.key) shared.set(options.key, read as Reader<unknown>);
  return read;
}
