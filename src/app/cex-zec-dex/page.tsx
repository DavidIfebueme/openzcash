import { getMarketDashboard } from "@/lib/markets/sources";
import { MarketAnalysis } from "./market-analysis";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "CEX < ZEC > DEX · OpenZcash",
  description:
    "Follow Zcash's shift toward decentralized trading. Compare reported CEX and DEX volume, explore known exchange balances, and verify public institutional holdings against on-chain supply.",
};

export default async function MarketsPage() {
  return <MarketAnalysis initial={await getMarketDashboard()} />;
}
