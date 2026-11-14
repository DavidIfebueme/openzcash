import { z } from "zod";
import {
  parseSwapSummary,
  type SwapTotals,
} from "@/lib/defi/maya-activity-model";
import { MAX_SUPPLY, ZAT, type Venue } from "./model";

// Public endpoints linked by THORChain's developer documentation.
export const THOR_MIDGARD =
  "https://gateway.liquify.com/chain/thorchain_midgard/v2";
export const THOR_NODE =
  "https://gateway.liquify.com/chain/thorchain_api/thorchain";
const POOL = "ZEC.ZEC";
const WINDOW_TOLERANCE_S = 120;
const ALL_TIME_MAX_AGE_S = 600;

const depth = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .refine((n) => Number.isSafeInteger(n) && n <= MAX_SUPPLY * ZAT);

export const thorWindowUrl = (from: number, to: number): string =>
  `${THOR_MIDGARD}/history/swaps?pool=${POOL}&from=${from}&to=${to}`;
export const THOR_ALL_TIME_URL = `${THOR_MIDGARD}/history/swaps?pool=${POOL}`;

/** ZEC in the native pool, or null when the registry lists no ZEC pool. */
export function parseThorPoolDepth(raw: unknown): number | null {
  const pools = z
    .array(z.object({ asset: z.string(), assetDepth: z.string() }))
    .parse(raw);
  const pool = pools.find((p) => p.asset === POOL);
  return pool ? depth.parse(pool.assetDepth) / ZAT : null;
}

/** The returned window must be the rolling day that was asked for. */
export function parseThorWindow(
  raw: unknown,
  from: number,
  to: number,
): SwapTotals {
  const summary = parseSwapSummary(raw);
  if (
    !summary ||
    Math.abs(summary.from - from) > WINDOW_TOLERANCE_S ||
    Math.abs(summary.to - to) > WINDOW_TOLERANCE_S
  )
    throw new Error("THORChain window unavailable");
  return summary;
}

export function thorVenue(summary: SwapTotals, source: string): Venue {
  return {
    id: "thorchain",
    name: "THORChain",
    kind: "dex",
    volumeUsd: summary.volumeUsd,
    pairs: 1,
    asOf: new Date(summary.to * 1000).toISOString(),
    source,
    note: "ZEC pool swaps, including trade and secured assets. Midgard USD cents converted to dollars. Counted once at protocol level.",
  };
}

/** Lifetime pool volume, accepted only while the index is following the chain. */
export function parseThorAllTime(
  raw: unknown,
  now: number,
): { volumeAllTimeUsd: number } {
  const summary = parseSwapSummary(raw);
  const age = summary ? now / 1000 - summary.to : Infinity;
  if (!summary || age > ALL_TIME_MAX_AGE_S || age < -60)
    throw new Error("THORChain history unavailable");
  return { volumeAllTimeUsd: summary.volumeUsd };
}
