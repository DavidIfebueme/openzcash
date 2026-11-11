import { z } from "zod";
import { amount, quoteIsFresh, type Venue } from "./model";

/**
 * Centralized exchanges whose ZEC spot market the aggregator does not list,
 * read from each exchange's own public, keyless ticker. The IDs are the
 * aggregator's exchange IDs: `DIRECT_EXCHANGE_IDS` in the model drops an
 * aggregator row for them if one ever appears, so a venue has one source.
 */
type Reading = { volumeUsd: number; at: number };
export type DirectExchange = {
  id: string;
  name: string;
  /** The ticker endpoint: the venue's source link and its source-list entry. */
  endpoint: string;
  /** The exact request of one read; it may add the caller's clock. */
  url: (now: number) => string;
  read: (raw: unknown) => Reading;
  /** Shown with the venue in the market list. */
  note: string;
  /** Shown with the feed in the source list. */
  coverage: string;
};

const DAY = 86_400_000;
const WINDOW_TOLERANCE_MS = 60_000;
const REPLACES = "Replaces any aggregator row for this exchange.";
const epoch = z
  .union([z.number(), z.string().regex(/^\d+$/)])
  .transform(Number)
  .pipe(z.number().int().positive().safe());

// One row for the one symbol asked for; anything else is a changed contract.
const bitgetTicker = z.object({
  code: z.literal("00000"),
  data: z.tuple([
    z.object({ symbol: z.literal("ZECUSDT"), usdtVolume: amount, ts: epoch }),
  ]),
});
const bingxTicker = z.object({
  code: z.literal(0),
  data: z.tuple([
    z
      .object({
        symbol: z.literal("ZEC-USDT"),
        quoteVolume: amount,
        openTime: epoch,
        closeTime: epoch,
      })
      .refine(
        (t) => Math.abs(t.closeTime - t.openTime - DAY) <= WINDOW_TOLERANCE_MS,
      ),
  ]),
});
// The single-pair reply carries no pair name: the request path selects it, and
// an unknown path is answered with an array of every ticker, which fails here.
const bitstampTicker = z.object({
  market_type: z.literal("SPOT"),
  volume: amount,
  vwap: amount,
  timestamp: epoch,
});

export const BITGET: DirectExchange = {
  id: "bitget",
  name: "Bitget",
  endpoint: "https://api.bitget.com/api/v2/spot/market/tickers?symbol=ZECUSDT",
  url: () => BITGET.endpoint,
  read: (raw) => {
    const [ticker] = bitgetTicker.parse(raw).data;
    return { volumeUsd: ticker.usdtVolume, at: ticker.ts };
  },
  note: "ZEC/USDT spot, 24-hour turnover reported by the exchange's public API. USDT treated as USD.",
  coverage: `Exchange's own spot ticker, exact ZECUSDT symbol; ticker time within the two-hour freshness window. ${REPLACES}`,
};

export const BINGX: DirectExchange = {
  id: "bingx",
  name: "BingX",
  endpoint:
    "https://open-api.bingx.com/openApi/spot/v1/ticker/24hr?symbol=ZEC-USDT",
  // The ticker request takes the caller's clock in milliseconds.
  url: (now) => `${BINGX.endpoint}&timestamp=${now}`,
  read: (raw) => {
    const [ticker] = bingxTicker.parse(raw).data;
    return { volumeUsd: ticker.quoteVolume, at: ticker.closeTime };
  },
  note: "ZEC/USDT spot, turnover over the exchange's stated 24-hour window. USDT treated as USD.",
  coverage: `Exchange's own spot ticker, exact ZEC-USDT symbol and a stated 24-hour window; close time within the two-hour freshness window. ${REPLACES}`,
};

export const BITSTAMP: DirectExchange = {
  id: "bitstamp",
  name: "Bitstamp",
  endpoint: "https://www.bitstamp.net/api/v2/ticker/zecusd/",
  url: () => BITSTAMP.endpoint,
  read: (raw) => {
    const ticker = bitstampTicker.parse(raw);
    return {
      // Whole cents: the product of two decimals is not a reported figure.
      volumeUsd: Math.round(ticker.volume * ticker.vwap * 100) / 100,
      at: ticker.timestamp * 1000,
    };
  },
  note: "ZEC/USD spot: 24-hour ZEC volume × the exchange's 24-hour volume-weighted average price. The smaller ZEC/EUR book is not added.",
  coverage: `Exchange's own ZEC/USD spot ticker; 24-hour ZEC volume priced at the 24-hour VWAP, ticker time within the two-hour freshness window. ZEC/EUR is not added. ${REPLACES}`,
};

export const DIRECT_EXCHANGES: readonly DirectExchange[] = [
  BITGET,
  BINGX,
  BITSTAMP,
];

/** One CEX venue from a verified ticker, dated by the exchange's own clock. */
export function directVenue(
  exchange: DirectExchange,
  raw: unknown,
  now: number,
): Venue {
  const { volumeUsd, at } = exchange.read(raw);
  if (!quoteIsFresh(at, now))
    throw new Error(`${exchange.name} ticker outside the freshness window`);
  return {
    id: exchange.id,
    name: exchange.name,
    kind: "cex",
    volumeUsd,
    pairs: 1,
    asOf: new Date(at).toISOString(),
    source: exchange.endpoint,
    note: exchange.note,
  };
}

export async function readDirectExchange(
  exchange: DirectExchange,
  fetchJson: (url: string) => Promise<unknown>,
  now: number = Date.now(),
): Promise<Venue> {
  return directVenue(exchange, await fetchJson(exchange.url(now)), now);
}
