import "server-only";

const MARKET_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=zcash&sparkline=false";
const TTL_MS = 10 * 60_000;

export type ZecCirculatingSupply = {
  zec: number;
  sourceUrl: string;
  quotedAt: string | null;
  fetchedAt: string;
  stale: boolean;
};

let cache: { value: Omit<ZecCirculatingSupply, "stale">; at: number } | null = null;

function cached(now: number): ZecCirculatingSupply | null {
  if (!cache) return null;
  const quotedAt = cache.value.quotedAt
    ? Date.parse(cache.value.quotedAt)
    : cache.at;
  return {
    ...cache.value,
    stale: now - Math.min(cache.at, quotedAt) >= TTL_MS,
  };
}

export async function currentZecCirculatingSupply(): Promise<ZecCirculatingSupply | null> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cached(now);

  try {
    const response = await fetch(MARKET_URL, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (response.ok) {
      const data = (await response.json()) as Array<{
        id?: string;
        circulating_supply?: number;
        last_updated?: string;
      }>;
      const item = Array.isArray(data)
        ? data.find((coin) => coin.id === "zcash")
        : null;
      const zec = item?.circulating_supply;
      if (
        typeof zec === "number" &&
        Number.isFinite(zec) &&
        zec > 0 &&
        zec <= 21_000_000
      ) {
        const at = Date.now();
        const sourceTime = item?.last_updated
          ? Date.parse(item.last_updated)
          : Number.NaN;
        cache = {
          at,
          value: {
            zec,
            sourceUrl: MARKET_URL,
            quotedAt:
              Number.isFinite(sourceTime) && sourceTime <= at + 60_000
                ? new Date(sourceTime).toISOString()
                : null,
            fetchedAt: new Date(at).toISOString(),
          },
        };
        return cached(at);
      }
    }
  } catch {
    // Show a dated fallback in the page when this feed is unavailable.
  }
  return cached(Date.now());
}
