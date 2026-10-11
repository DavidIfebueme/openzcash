import { z } from "zod/v3";
import { fundingQuoteExpiresAt, MAX_RATE_USD_E8 } from "@/lib/participate/workspace/domain/funding-quote";

const priceSchema = z.object({
  rateUsdPerZecE8: z.string().regex(/^[1-9]\d{0,15}$/),
  quotedAt: z.string().datetime(),
  retrievedAt: z.string().datetime(),
  expiresAt: z.string().datetime()
}).strict();

/** Public market data only; never a payment quote, balance or settlement record. */
export type PublicZecPrice = z.infer<typeof priceSchema>;

function readZecPrice(input: unknown, now: Date, futureToleranceMs: number): PublicZecPrice {
  const price = priceSchema.parse(input);
  const quotedAt = new Date(price.quotedAt);
  const retrievedAt = new Date(price.retrievedAt);
  const expiresAt = fundingQuoteExpiresAt(quotedAt);
  if (!Number.isFinite(+now) || +quotedAt > +now + futureToleranceMs || +expiresAt <= +now ||
    Math.floor(+quotedAt / 86_400_000) !== Math.floor(+now / 86_400_000) ||
    BigInt(price.rateUsdPerZecE8) > MAX_RATE_USD_E8 || +retrievedAt < +quotedAt ||
    +retrievedAt > +now + futureToleranceMs || +retrievedAt >= +expiresAt ||
    price.expiresAt !== expiresAt.toISOString()) {
    throw new Error("A current ZEC price is unavailable");
  }
  return price;
}

/** Strict validation for the public server response; no future timestamp allowance. */
export function readFreshZecPrice(input: unknown, now = new Date()): PublicZecPrice {
  return readZecPrice(input, now, 0);
}

/** Browser display only: allow small clock skew, never extend the source's expiry. */
export function readDisplayZecPrice(input: unknown, now = new Date()): PublicZecPrice {
  return readZecPrice(input, now, 2_000);
}

/** Two decimals for a compact estimate, rounded from exact zatoshis. */
export function formatEstimatedZec(amountZat: bigint): string {
  if (amountZat < 0n) throw new Error("Invalid ZEC estimate");
  if (amountZat > 0n && amountZat < 1_000_000n) return "<0.01";
  const hundredths = (amountZat + 500_000n) / 1_000_000n;
  return `${(hundredths / 100n).toLocaleString("en-US")}.${(hundredths % 100n).toString().padStart(2, "0")}`;
}
