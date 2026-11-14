import { HEIGHTS, blockSubsidy, halving, targetSecondsBetween } from "@/lib/funding/consensus";

/** Halving interval since NU7 (ZIP 218): 5,040,000 blocks of 25 seconds. */
const HALVING_INTERVAL = 5_040_000;
/** The first halving height above `height`: Canopy, NU6, the third halving (6,132,390), then every 5,040,000 blocks. */
export function nextHalvingHeight(height: number): number {
  const fixed = [HEIGHTS.canopy, HEIGHTS.nu6, HEIGHTS.thirdHalving];
  const known = fixed.find((h) => h > height);
  if (known) return known;
  return (
    HEIGHTS.thirdHalving +
    Math.ceil((height + 1 - HEIGHTS.thirdHalving) / HALVING_INTERVAL) *
      HALVING_INTERVAL
  );
}
const zec = (zat: number) => Math.round(zat) / 1e8;

export type ChainReading = {
  height: number | null;
  readAt: string;
  supply: {
    zec: number;
    height: number;
    pools: { id: string; zec: number }[];
    lockedZec: number;
    shieldedZec: number;
    fetchedAt: string | null;
    stale: boolean;
  } | null;
  circulating: {
    zec: number;
    quotedAt: string | null;
    fetchedAt: string;
    stale: boolean;
    sourceUrl: string;
  } | null;
};
/** Every figure with its own time or height; missing feeds stay null with a note instead of a zero. */
export function chainContext(reading: ChainReading, now = Date.now()) {
  const height =
    reading.height && Number.isSafeInteger(reading.height) && reading.height > 0
      ? reading.height
      : null;
  const next = height ? nextHalvingHeight(height) : null;
  const remaining = height && next ? next - height : null;
  // Target seconds per arriving block, so a pre-NU7 tip crosses the 75 s to 25 s change correctly.
  const remainingSeconds = height && next ? targetSecondsBetween(height, next) : null;
  const s = reading.supply;
  return {
    tip: height
      ? {
          height,
          readAt: reading.readAt,
          source: "lightwalletd chain tip through OpenZcash's 60-second cache",
          note: "The height at readAt, not a block timestamp.",
        }
      : null,
    tipNote: height
      ? undefined
      : "Current block height unavailable right now; do not estimate one.",
    halving:
      height && next && remaining !== null && remainingSeconds !== null
        ? {
            nextHeight: next,
            blocksRemaining: remaining,
            estimatedAt: new Date(
              now + remainingSeconds * 1000,
            ).toISOString(),
            estimatedDaysRemaining:
              Math.round((remainingSeconds / 86_400) * 10) /
              10,
            halvingsSoFar: halving(height),
            subsidyZecPerBlock: zec(blockSubsidy(height)),
            subsidyAfterNextZecPerBlock: zec(blockSubsidy(next)),
            basis: "Estimate from the tip height at the target block spacing (25 seconds since NU7, ZIP 218); real block times vary, so the date is not fixed. The third halving at block 6,132,390 also ends the ZCG and Lockbox streams (ZIP 214 revision 3).",
          }
        : null,
    halvingNote: height
      ? undefined
      : "Next-halving countdown needs the current height; the next halving height is protocol-defined (see the funding rules) but the date cannot be estimated without a tip.",
    supply: s
      ? {
          chainSupplyZec: s.zec,
          atHeight: s.height,
          fetchedAt: s.fetchedAt,
          stale: s.stale,
          shieldedZec: s.shieldedZec,
          transparentZec:
            s.pools.find((p) => p.id === "transparent")?.zec ?? null,
          lockboxZec: s.lockedZec,
          pools: s.pools,
          source:
            "CipherScan mainnet node value pools, reconciled to chain supply",
          note: "shieldedZec sums every pool except transparent and lockbox; chain supply counts issued coins, not exchange-reported circulating supply.",
        }
      : null,
    supplyNote: s
      ? undefined
      : "Node supply and shielded pool figures unavailable right now.",
    circulating: reading.circulating
      ? {
          zec: reading.circulating.zec,
          quotedAt: reading.circulating.quotedAt,
          fetchedAt: reading.circulating.fetchedAt,
          stale: reading.circulating.stale,
          source: "CoinGecko circulating supply",
          note: "A market-data estimate with its own methodology; compare with chain supply only with both dates.",
        }
      : null,
    circulatingNote: reading.circulating
      ? undefined
      : "Circulating-supply feed unavailable right now.",
    note: "Read-only chain and supply readings. Preserve each figure's own time, height and stale flag; a cached reading is not a live confirmation.",
  };
}

export type DayRow = [
  date: string,
  fromHeight: number,
  toHeight: number,
  closeUsd: number | null,
];
export type DaysDoc = {
  generatedAt: string;
  through: { date: string; height: number };
  sources: { prices: string; note: string };
  rows: DayRow[];
};
const MONTHS = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");
const MONTHS_PT =
  "janeiro fevereiro marco abril maio junho julho agosto setembro outubro novembro dezembro".split(
    " ",
  );
const cents = (v: number) => Math.round(v * 100) / 100;
function summarize(rows: DayRow[]) {
  const priced = rows.filter((r) => r[3] !== null) as Array<
    [string, number, number, number]
  >;
  if (!priced.length) return null;
  const low = priced.reduce((a, b) => (b[3] < a[3] ? b : a)),
    high = priced.reduce((a, b) => (b[3] > a[3] ? b : a));
  return {
    firstDate: priced[0][0],
    firstClose: priced[0][3],
    lastDate: priced.at(-1)![0],
    lastClose: priced.at(-1)![3],
    low: { date: low[0], usd: low[3] },
    high: { date: high[0], usd: high[3] },
    averageClose: cents(priced.reduce((n, r) => n + r[3], 0) / priced.length),
    daysWithPrice: priced.length,
    daysWithoutPrice: rows.length - priced.length,
  };
}
/** The period a question names, as YYYY, YYYY-MM or YYYY-MM-DD. */
export function requestedPeriod(
  query: string,
): { kind: "day" | "month" | "year"; value: string } | null {
  const q = query.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const iso = q.match(/\b(20\d{2})-(\d{2})(?:-(\d{2}))?\b/);
  if (iso)
    return iso[3]
      ? { kind: "day", value: `${iso[1]}-${iso[2]}-${iso[3]}` }
      : { kind: "month", value: `${iso[1]}-${iso[2]}` };
  // Day-first ("2 de janeiro de 2026") before month-first ("January 2026", "Jan 3rd, 2026").
  const named =
    q.match(
      new RegExp(
        `\\b(\\d{1,2})(?: de| of)? (${[...MONTHS, ...MONTHS_PT].join("|")})[a-z]*\\.?(?: de| of)? (20\\d{2})\\b`,
      ),
    ) ??
    q.match(
      new RegExp(
        `\\b(${[...MONTHS, ...MONTHS_PT].join("|")})[a-z]*\\.?(?: (\\d{1,2})(?:st|nd|rd|th)?,?)?(?: de| of)? (20\\d{2})\\b`,
      ),
    );
  if (named) {
    const [a, b, year] = named.slice(1);
    const monthWord = /^\d+$/.test(a) ? b : a,
      day = /^\d+$/.test(a) ? a : b;
    const index =
      MONTHS.indexOf(monthWord.slice(0, 3)) + 1 ||
      MONTHS_PT.indexOf(monthWord) + 1;
    if (!index) return null;
    const month = `${year}-${String(index).padStart(2, "0")}`;
    return day
      ? { kind: "day", value: `${month}-${day.padStart(2, "0")}` }
      : { kind: "month", value: month };
  }
  const year = q.match(/\b(20[12]\d)\b/);
  return year ? { kind: "year", value: year[1] } : null;
}
/** Daily closes for the named day, month or year from the site's funding-history dataset; the default is the last 30 recorded days. */
export function priceHistoryContext(query: string, doc: DaysDoc) {
  const period = requestedPeriod(query);
  const rows = period
    ? doc.rows.filter((r) => r[0].startsWith(period.value))
    : doc.rows.slice(-30);
  const days = (list: DayRow[]) =>
    list.map(([date, , , closeUsd]) => ({ date, closeUsd }));
  const months =
    period?.kind === "year"
      ? [...new Set(rows.map((r) => r[0].slice(0, 7)))].map((m) => ({
          month: m,
          ...summarize(rows.filter((r) => r[0].startsWith(m))),
        }))
      : undefined;
  return {
    source: doc.sources.prices,
    generatedAt: doc.generatedAt,
    through: doc.through.date,
    requested: period ?? { kind: "recent", value: "last 30 recorded days" },
    covered: rows.length ? { from: rows[0][0], to: rows.at(-1)![0] } : null,
    summary: summarize(rows),
    months,
    days: period?.kind === "year" ? undefined : days(rows),
    note: rows.length
      ? "Bitfinex ZEC/USD daily closes (UTC) from OpenZcash's funding-history dataset, regenerated by a maintainer script (generatedAt); not intraday prices and not the current quote. Days after `through` are not in the dataset. 2016-10-28 has no candle."
      : `No recorded closes for ${period?.value ?? "that period"}: the dataset runs from 2016-10-28 through ${doc.through.date}. Do not estimate a price.`,
  };
}
