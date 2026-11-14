/**
 * Regenerates src/data/funding/days.json: the only observed inputs of the
 * funding-history page. Everything else (who received how much) is derived
 * from these rows by src/lib/funding/consensus.ts.
 *
 *   npx tsx scripts/gen-funding-history.ts
 *
 * Published days are append-only; pass --allow-rewrite after reviewing a real
 * correction from a source.
 *
 * Inputs, one row per complete UTC day since genesis:
 * - the first block height stamped that day (Blockchair daily aggregate). A day
 *   covers heights from its first block to the block before the next day's
 *   first block, so every height belongs to exactly one day;
 * - the ZEC/USD daily close (Bitfinex tZECUSD 1D candles, UTC). Genesis day
 *   (2016-10-28) has no candle and keeps a null price.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { historyRewrite } from "./lib/funding-days-guard.mjs";

const HEIGHTS_URL =
  "https://api.blockchair.com/zcash/blocks?a=date,min(id),max(id),count()&s=date(asc)&limit=10000";
const PRICES_URL =
  "https://api-pub.bitfinex.com/v2/candles/trade:1D:tZECUSD/hist?limit=10000&sort=1";
const OUT = path.join(process.cwd(), "src/data/funding/days.json");
const DAY_MS = 86_400_000;

const blockchair = z.object({
  data: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      "min(id)": z.number().int().nonnegative(),
      "max(id)": z.number().int().nonnegative(),
    }),
  ),
  context: z.object({ total_rows: z.number().int(), state: z.number().int() }),
});
// [MTS, OPEN, CLOSE, HIGH, LOW, VOLUME]
const candles = z.array(
  z.tuple([
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
  ]),
);

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "User-Agent": "OpenZcash/1.0 (+https://openzcash.org)",
    },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}

async function publishedRows(): Promise<unknown[][]> {
  try {
    const doc = JSON.parse(await readFile(OUT, "utf8")) as { rows: unknown[][] };
    return doc.rows;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

async function main() {
  const [rawHeights, rawPrices] = await Promise.all([
    getJson(HEIGHTS_URL),
    getJson(PRICES_URL),
  ]);
  const heights = blockchair.parse(rawHeights);
  const prices = candles.parse(rawPrices);
  if (heights.data.length !== heights.context.total_rows) {
    throw new Error(
      `Blockchair returned ${heights.data.length} of ${heights.context.total_rows} days`,
    );
  }

  const days = heights.data;
  if (days[0].date !== "2016-10-28" || days[0]["min(id)"] !== 0) {
    throw new Error("The series must start at the genesis block on 2016-10-28");
  }
  for (let i = 1; i < days.length; i++) {
    const gap =
      Date.parse(`${days[i].date}T00:00:00Z`) -
      Date.parse(`${days[i - 1].date}T00:00:00Z`);
    if (gap !== DAY_MS) throw new Error(`Missing day before ${days[i].date}`);
    if (days[i]["min(id)"] <= days[i - 1]["min(id)"]) {
      throw new Error(`First height does not increase on ${days[i].date}`);
    }
  }

  const close = new Map(prices.map(([mts, , c]) => [dayOf(mts), c]));
  // Only complete UTC days: the last row (today) is still being mined.
  const rows: [string, number, number, number | null][] = [];
  for (let i = 0; i < days.length - 1; i++) {
    const { date } = days[i];
    rows.push([
      date,
      days[i]["min(id)"],
      days[i + 1]["min(id)"] - 1,
      close.get(date) ?? null,
    ]);
  }
  const missingPrice = rows.filter(([, , , c]) => c === null).map(([d]) => d);
  if (missingPrice.some((d) => d !== "2016-10-28")) {
    throw new Error(`No daily close for: ${missingPrice.join(", ")}`);
  }

  const rewrite = historyRewrite(await publishedRows(), rows);
  if (rewrite && !process.argv.includes("--allow-rewrite")) {
    throw new Error(`Refusing to rewrite history: ${rewrite}`);
  }

  const last = rows[rows.length - 1];
  const doc = {
    version: 1,
    generatedAt: new Date().toISOString(),
    through: { date: last[0], height: last[2] },
    sources: {
      heights: HEIGHTS_URL,
      prices: PRICES_URL,
      note: "Heights: first block stamped each UTC day; a day ends at the block before the next day's first block. Prices: Bitfinex ZEC/USD daily close (UTC). 2016-10-28 has no candle.",
    },
    columns: ["date", "fromHeight", "toHeight", "closeUsd"],
    rows,
  };
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(doc)}\n`);
  console.log(
    `wrote ${rows.length} days through ${last[0]} (height ${last[2]}) to ${path.relative(process.cwd(), OUT)}`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
