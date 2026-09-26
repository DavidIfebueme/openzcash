import { currentZecUsdQuote } from "@/lib/pricing/live-price";

export const dynamic = "force-dynamic";

/** A small quote response, independent of the Observatory's full market collection. */
export async function GET() {
  const quote = await currentZecUsdQuote();
  return Response.json({
    asset: "ZEC",
    currency: "USD",
    quote: quote ? {
      usd: quote.cents / 100,
      source: quote.source,
      sourceUrl: quote.sourceUrl,
      quotedAt: quote.quotedAt,
      fetchedAt: quote.fetchedAt,
      stale: quote.stale,
    } : null,
    note: quote
      ? "usd is US dollars per 1 ZEC. quotedAt is the provider's quote time; fetchedAt is retrieval time. A stale quote is a saved reference, not a verified current price."
      : "The price feed is unavailable and no saved quote exists. Do not invent a current price or interpret this as zero.",
  }, {
    status: quote ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
