import "server-only";

import { z } from "zod";
import type { NetworkFreshness, NetworkInflation, NetworkMarket } from "./types";

const EMISSION_URL = "https://api.zecblock.com/v1/network/emission?period=7d";
const MARKET_URL = "https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=btc&include_last_updated_at=true";
const MARKET_FALLBACK_URL = "https://api.coinpaprika.com/v1/tickers/zec-zcash?quotes=BTC";
const EMISSION_SOURCE = { name: "ZecBlock", url: "https://zecblock.com/", docsUrl: "https://zecblock.com/docs" };
const MARKET_SOURCE = { name: "CoinGecko", url: "https://www.coingecko.com/en/coins/zcash", docsUrl: "https://docs.coingecko.com/reference/simple-price" };
const MARKET_FALLBACK_SOURCE = { name: "CoinPaprika", url: "https://coinpaprika.com/coin/zec-zcash/", docsUrl: "https://docs.coinpaprika.com/api-reference/tickers/get-ticker-for-a-specific-coin" };
const TTL_MS = 10 * 60_000;
const DAY_MS = 86_400_000;
const FUTURE_TOLERANCE_MS = 60_000;
const iso = z.iso.datetime({ offset: true });
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const zatoshis = z.union([integer, z.string().regex(/^\d+$/).transform(Number).pipe(integer)]);

const emissionSchema = z.object({
  data: z.object({
    supplyHistory: z.array(z.object({ date: iso, circulatingZat: zatoshis, height: integer })).min(2),
  }),
  meta: z.object({ network: z.literal("mainnet"), freshness: z.object({ status: z.string() }).optional() }),
}).superRefine((value, context) => {
  if (!completedPair(value.data.supplyHistory) || value.data.supplyHistory.some(
    (point) => Date.parse(point.date) > Date.now() + FUTURE_TOLERANCE_MS,
  )) context.addIssue({ code: "custom", message: "Invalid daily supply observations" });
});
const btcValue = z.number().finite().positive().max(Number.MAX_VALUE / 100);
const marketSchema = z.object({
  zcash: z.object({ btc: btcValue, last_updated_at: integer.positive() }),
}).superRefine((value, context) => {
  const at = value.zcash.last_updated_at * 1_000;
  if (!Number.isSafeInteger(at) || at > Date.now() + FUTURE_TOLERANCE_MS) {
    context.addIssue({ code: "custom", message: "Invalid market observation time" });
  }
}).transform(({ zcash }) => ({
  btc: zcash.btc, observedAt: new Date(zcash.last_updated_at * 1_000).toISOString(), source: MARKET_SOURCE,
}));
const marketFallbackSchema = z.object({
  id: z.literal("zec-zcash"), last_updated: iso,
  quotes: z.object({ BTC: z.object({ price: btcValue }) }),
}).superRefine((value, context) => {
  const at = Date.parse(value.last_updated);
  if (at <= 0 || at > Date.now() + FUTURE_TOLERANCE_MS) {
    context.addIssue({ code: "custom", message: "Invalid market observation time" });
  }
}).transform((value) => ({
  btc: value.quotes.BTC.price, observedAt: new Date(value.last_updated).toISOString(), source: MARKET_FALLBACK_SOURCE,
}));

type Resource<T> = NetworkFreshness & { data: T; at: number };
const cache = new Map<string, Resource<unknown>>();
const pending = new Map<string, Promise<Resource<unknown> | null>>();
const retryAfter = new Map<string, number>();

async function resource<T>(url: string, schema: z.ZodType<T>): Promise<Resource<T> | null> {
  const previous = cache.get(url) as Resource<T> | undefined;
  const now = Date.now();
  const fallback = () => previous ? { ...previous, stale: true } : null;
  if (now < (retryAfter.get(url) ?? 0)) return fallback();
  if (previous && now - previous.at < TTL_MS) return { ...previous, stale: false };
  const inFlight = pending.get(url);
  if (inFlight) return inFlight as Promise<Resource<T> | null>;
  const request = (async (): Promise<Resource<T> | null> => {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" }, cache: "no-store",
        signal: AbortSignal.timeout(4_000),
      });
      if (!response.ok) throw new Error("Network economics unavailable");
      const data = schema.parse(await response.json());
      const at = Date.now();
      const value = { data, at, fetchedAt: new Date(at).toISOString(), stale: false };
      cache.set(url, value);
      retryAfter.delete(url);
      return value;
    } catch {
      retryAfter.set(url, Date.now() + 30_000);
      return fallback();
    } finally {
      pending.delete(url);
    }
  })();
  pending.set(url, request as Promise<Resource<unknown> | null>);
  return request;
}

type SupplyPoint = { date: string; circulatingZat: number; height: number };
function completedPair(history: SupplyPoint[]): { latest: SupplyPoint; previous: SupplyPoint } | null {
  const today = Math.floor(Date.now() / DAY_MS) * DAY_MS;
  // The feed labels completed UTC-day snapshots at 23:59:59. Current partial
  // days and irregular snapshots must never be annualized as a full day.
  const points = history.filter((point) => {
    const at = Date.parse(point.date);
    return at < today && at % DAY_MS === DAY_MS - 1_000;
  }).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const latest = points.at(-1);
  const previous = points.at(-2);
  if (!latest || !previous || latest.circulatingZat <= 0 || previous.circulatingZat <= 0
    || Date.parse(latest.date) - Date.parse(previous.date) !== DAY_MS
    || latest.height <= previous.height) return null;
  return { latest, previous };
}

function inflationData(value: Resource<z.infer<typeof emissionSchema>> | null): NetworkInflation | null {
  if (!value) return null;
  const pair = completedPair(value.data.data.supplyHistory);
  if (!pair) return null;
  const { latest, previous } = pair;
  const today = Math.floor(Date.now() / DAY_MS) * DAY_MS;
  const netIssuedZat = latest.circulatingZat - previous.circulatingZat;
  return {
    source: EMISSION_SOURCE, fetchedAt: value.fetchedAt,
    stale: value.stale || Date.parse(latest.date) !== today - 1_000
      || ["stale", "unavailable", "expired"].includes(value.data.meta.freshness?.status.toLowerCase() ?? ""),
    day: new Date(latest.date).toISOString().slice(0, 10), observedAt: latest.date,
    dailyIssuanceZec: netIssuedZat / 100_000_000,
    supplyZec: latest.circulatingZat / 100_000_000,
    // Supply includes the Lockbox. Releasing already-issued Lockbox funds is
    // a transfer, so it cannot be counted as new issuance a second time.
    annualizedPercent: netIssuedZat / latest.circulatingZat * 365 * 100,
  };
}

function marketData(value: Resource<z.infer<typeof marketSchema>> | null): NetworkMarket | null {
  if (!value) return null;
  const { btc, observedAt, source } = value.data;
  const at = Date.parse(observedAt);
  if (!Number.isSafeInteger(at) || at > Date.now() + FUTURE_TOLERANCE_MS) return null;
  return {
    source, fetchedAt: value.fetchedAt,
    stale: value.stale || Date.now() - at >= TTL_MS,
    observedAt: new Date(at).toISOString(), zecBtc: btc, btcPercent: btc * 100,
  };
}

async function marketQuote(): Promise<NetworkMarket | null> {
  const primary = marketData(await resource(MARKET_URL, marketSchema));
  if (primary && !primary.stale) return primary;
  const fallback = marketData(await resource(MARKET_FALLBACK_URL, marketFallbackSchema));
  if (fallback && !fallback.stale) return fallback;
  // During a full outage, retain the newest available observation with its
  // original provider and timestamps, rather than relabelling it as current.
  if (!primary) return fallback;
  if (!fallback) return primary;
  return Date.parse(fallback.observedAt) > Date.parse(primary.observedAt) ? fallback : primary;
}

/** Each quote retains its own source time, refresh cadence and failure state. */
export async function getNetworkEconomics(): Promise<{
  inflation: NetworkInflation | null; market: NetworkMarket | null;
}> {
  const [emission, market] = await Promise.all([
    resource(EMISSION_URL, emissionSchema), marketQuote(),
  ]);
  return { inflation: inflationData(emission), market };
}
