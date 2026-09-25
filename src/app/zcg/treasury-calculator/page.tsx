import { currentZecCirculatingSupply } from "@/lib/pricing/circulating-supply";
import { currentZecUsdQuote } from "@/lib/pricing/live-price";
import { reportedDevFundData } from "@/lib/treasury/dev-fund-data";
import { TreasuryCalculator } from "./treasury-calculator";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "ZEC treasury calculator · OpenZcash",
  description:
    "Explore how ZEC price, mining, and circulating supply change the cost of reaching a treasury target.",
};

// Dated fallback only. A failed live feed must never look like a fresh reading.
const SUPPLY_FALLBACK = 16_945_106;
const SUPPLY_FALLBACK_DATE = "2026-09-23";

export default async function TreasuryCalculatorPage() {
  const [price, supply, devFundData] = await Promise.all([
    currentZecUsdQuote(),
    currentZecCirculatingSupply(),
    reportedDevFundData(),
  ]);

  return (
    <TreasuryCalculator
      devFundData={devFundData}
      initialPriceUsd={price ? price.cents / 100 : null}
      priceQuotedAt={price?.quotedAt ?? price?.fetchedAt ?? null}
      priceStale={price?.stale ?? false}
      initialCirculatingSupplyZec={
        supply ? Math.round(supply.zec) : SUPPLY_FALLBACK
      }
      supplyQuotedAt={supply?.quotedAt ?? supply?.fetchedAt ?? null}
      supplyStale={supply?.stale ?? false}
      supplyFallbackDate={supply ? null : SUPPLY_FALLBACK_DATE}
    />
  );
}
