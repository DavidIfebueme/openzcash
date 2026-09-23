import { getMarketDashboard } from "@/lib/markets/sources";
import { MarketAnalysis } from "./market-analysis";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "ZEC Observatory · OpenZcash",
  description:
    "Zcash markets, supply and public holdings. Compare CEX and DEX spot volume, track intent activity separately, and inspect on-chain balances and institutional disclosures.",
  alternates: { canonical: "https://openzcash.org/zec-observatory" },
};

export default async function MarketsPage() {
  return <MarketAnalysis initial={await getMarketDashboard()} />;
}
