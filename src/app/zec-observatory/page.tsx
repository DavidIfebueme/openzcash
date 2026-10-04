import { Suspense } from "react";
import { getMarketDashboard } from "@/lib/markets/sources";
import { MarketAnalysis } from "./market-analysis";
import { LiquidityLoading, LiquidityPools } from "./liquidity-pools";
import { pageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-dynamic";
export const metadata = {
  ...pageMetadata({
    title: "ZEC Observatory · OpenZcash",
    description:
      "Zcash markets, liquidity, supply and public holdings. Compare CEX and DEX spot volume, inspect tracked pools, and explore on-chain balances and institutional disclosures.",
    path: "/zec-observatory",
  }),
  alternates: { canonical: "https://openzcash.org/zec-observatory" },
};

export default async function MarketsPage() {
  return (
    <MarketAnalysis
      initial={await getMarketDashboard()}
      liquidity={
        <Suspense fallback={<LiquidityLoading />}>
          <LiquidityPools />
        </Suspense>
      }
    />
  );
}
