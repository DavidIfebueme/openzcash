import { PROGRAM } from "@/lib/coinholder/program";
import { currentZecUsdQuote } from "@/lib/pricing/live-price";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { OverviewView } from "../round-view";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: `Program overview · ${PROGRAM.officialName} · OpenZcash`,
  description: "The Coinholder Grants program across every round: participation, grant outcomes, voting value, funding and counting rules.",
  path: "/coinholders/overview",
  card: { title: "Coinholder Grants", stat: "Program overview" },
});

export default async function CoinholderOverviewPage() {
  const quote = await currentZecUsdQuote();
  return <OverviewView today={quote ? { usd: quote.cents / 100, source: quote.source } : null} />;
}
