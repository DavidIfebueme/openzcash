import { z } from "zod";

// Midgard USD volumes are integer cents, already priced at the time of each
// swap. Never revalue historical volume at today's ZEC or CACAO price.
const integer = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .refine(Number.isSafeInteger);
const decimal = z
  .string()
  .trim()
  .min(1)
  .transform(Number)
  .refine((n) => Number.isFinite(n) && n >= 0);
const swapSchema = z.object({
  startTime: integer,
  endTime: integer,
  totalVolumeUSD: integer,
  totalCount: integer,
  toAssetVolumeUSD: integer.optional(),
  toRuneVolumeUSD: integer.optional(),
  toTradeVolumeUSD: integer.optional(),
  fromTradeVolumeUSD: integer.optional(),
  synthMintVolumeUSD: integer.optional(),
  synthRedeemVolumeUSD: integer.optional(),
});

export type SwapTotals = {
  from: number;
  to: number;
  volumeUsd: number;
  count: number;
  breakdown: { native: number; trade: number; synth: number } | null;
};
export type VolumeMonth = SwapTotals & { month: string };
export type MayaPool = {
  zec: number;
  cacao: number;
  quotedTvlUsd: number | null;
  status: string;
};
export type MayaHealth = { inSync: boolean; indexedAt: string | null };

/**
 * Pool availability does not describe chain halts; use the node's own flags.
 * `halted` is always published. MayaNode stopped sending the trading-pause
 * fields for ZEC, while THORNode sends both, so they count only when present.
 */
export function parseMayaNetwork(raw: unknown) {
  const rows = z
    .array(
      z.object({
        chain: z.string(),
        halted: z.boolean(),
        chain_trading_paused: z.boolean().optional(),
        global_trading_paused: z.boolean().optional(),
      }),
    )
    .parse(raw);
  const zec = rows.find((row) => row.chain === "ZEC");
  if (!zec) throw new Error("ZEC network status unavailable");
  return {
    paused:
      zec.halted ||
      zec.chain_trading_paused === true ||
      zec.global_trading_paused === true,
  };
}

/** Block age alone: the direct evidence that an index is following its chain. */
export function midgardIndexRecent(health: MayaHealth | null, now: number) {
  if (!health?.indexedAt) return false;
  const age = now - Date.parse(health.indexedAt);
  return age >= -60_000 && age <= 5 * 60_000;
}

export function mayaIndexCurrent(health: MayaHealth | null, now: number) {
  return health?.inSync === true && midgardIndexRecent(health, now);
}

function swapTotals(input: z.infer<typeof swapSchema>): SwapTotals | null {
  if (input.endTime <= input.startTime || input.endTime > 8_640_000_000_000)
    return null;
  const fields = [
    input.toAssetVolumeUSD,
    input.toRuneVolumeUSD,
    input.toTradeVolumeUSD,
    input.fromTradeVolumeUSD,
    input.synthMintVolumeUSD,
    input.synthRedeemVolumeUSD,
  ];
  let breakdown: SwapTotals["breakdown"] = null;
  if (fields.every((n) => n != null)) {
    const [buy, sell, tradeIn, tradeOut, mint, redeem] = fields as number[];
    // Hide a partial/inconsistent breakdown instead of inventing its remainder.
    if (
      Math.abs(
        buy + sell + tradeIn + tradeOut + mint + redeem - input.totalVolumeUSD,
      ) <= 1
    ) {
      breakdown = {
        native: (buy + sell) / 100,
        trade: (tradeIn + tradeOut) / 100,
        synth: (mint + redeem) / 100,
      };
    }
  }
  return {
    from: input.startTime,
    to: input.endTime,
    volumeUsd: input.totalVolumeUSD / 100,
    count: input.totalCount,
    breakdown,
  };
}

export function parseSwapSummary(raw: unknown): SwapTotals | null {
  const parsed = z.object({ meta: swapSchema }).safeParse(raw);
  return parsed.success ? swapTotals(parsed.data.meta) : null;
}

export function parseVolumeHistory(raw: unknown): VolumeMonth[] | null {
  const parsed = z
    .object({ intervals: z.array(swapSchema).min(1) })
    .safeParse(raw);
  if (!parsed.success) return null;
  const months: VolumeMonth[] = [];
  for (const interval of parsed.data.intervals) {
    const value = swapTotals(interval);
    if (!value) return null;
    months.push({
      ...value,
      month: new Date(value.from * 1000).toISOString().slice(0, 7),
    });
  }
  months.sort((a, b) => a.from - b.from);
  if (new Set(months.map((m) => m.month)).size !== months.length) return null;
  // Omit months before the pool's first activity; keep internal/trailing zeros.
  const first = months.findIndex((m) => m.count > 0 || m.volumeUsd > 0);
  return first < 0 ? months : months.slice(first);
}

export function parseMayaPool(raw: unknown): MayaPool | null {
  const parsed = z
    .object({
      asset: z.literal("ZEC.ZEC"),
      assetDepth: decimal,
      runeDepth: decimal,
      assetPriceUSD: decimal.optional(),
      status: z.string().min(1),
    })
    .safeParse(raw);
  if (!parsed.success) return null;
  const p = parsed.data;
  // ZEC uses 8 decimals; native CACAO uses 10 (not THORChain RUNE's 8).
  const zec = p.assetDepth / 1e8;
  return {
    zec,
    cacao: p.runeDepth / 1e10,
    status: p.status,
    quotedTvlUsd:
      p.assetPriceUSD && p.assetPriceUSD > 0 ? zec * p.assetPriceUSD * 2 : null,
  };
}

export function parseMayaHealth(raw: unknown): MayaHealth | null {
  const parsed = z
    .object({
      inSync: z.boolean(),
      lastAggregated: z
        .object({
          timestamp: z.number().int().positive().max(8_640_000_000_000),
        })
        .optional(),
    })
    .safeParse(raw);
  return parsed.success
    ? {
        inSync: parsed.data.inSync,
        indexedAt: parsed.data.lastAggregated
          ? new Date(parsed.data.lastAggregated.timestamp * 1000).toISOString()
          : null,
      }
    : null;
}

export function volumeSeries(
  months: VolumeMonth[],
  cumulative: boolean,
  count: number | null,
) {
  let sum = 0;
  const series = months.map((m) => {
    sum += m.volumeUsd;
    return { ...m, value: cumulative ? sum : m.volumeUsd };
  });
  // Accumulate before cropping: "6M" must not reset the all-time total.
  return count == null ? series : series.slice(-count);
}
