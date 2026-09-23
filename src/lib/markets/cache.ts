export type Feed<T> = {
  data: T | null;
  fetchedAt: string | null;
  checkedAt: string;
  stale: boolean;
  error: string | null;
};

/** Bounded retries, shared in-flight work, and truthful dates on saved data. */
export function cachedFeed<T>(
  loader: () => Promise<T>,
  ttl = 5 * 60_000,
  retryPartial?: (data: T) => boolean,
) {
  let cache: Feed<T> | null = null;
  let retryAt = 0;
  let pending: Promise<Feed<T>> | null = null;
  return async (): Promise<Feed<T>> => {
    if (pending) return pending;
    if (cache && Date.now() < retryAt) return cache;
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
    })();
    try {
      return await pending;
    } finally {
      pending = null;
    }
  };
}
