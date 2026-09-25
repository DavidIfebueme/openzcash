import { STREAM_IDS, ZAT_PER_ZEC } from "@/lib/funding/consensus";
import {
  HISTORY_META,
  dailySeries,
  seriesCsv,
  streamTotals,
  yearlyTotals,
} from "@/lib/funding/history";
import { STREAMS } from "@/lib/funding/streams";

export const dynamic = "force-dynamic";

const zec = (zat: number) => Number((zat / ZAT_PER_ZEC).toFixed(8));
const dollars = (n: number) => Math.round(n * 100) / 100;

/**
 * Every ZEC allocated outside mining since genesis. Default: totals by
 * recipient and year. ?format=csv returns the daily series; ?daily=1 adds it
 * to the JSON.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const points = dailySeries();
  if (url.searchParams.get("format") === "csv") {
    return new Response(seriesCsv(points), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="zcash-funding-history.csv"',
      },
    });
  }
  const totals = streamTotals(points);
  const body = {
    through: HISTORY_META.through,
    generatedAt: HISTORY_META.generatedAt,
    sources: HISTORY_META.sources,
    method:
      "Amounts derive from block heights through the consensus rules (protocol spec §7.8; ZIPs 207, 214, 1015, 2001). usdAtReceipt values each day's ZEC at that day's close.",
    streams: STREAMS.map((s) => {
      const t = totals.find((x) => x.id === s.id)!;
      return {
        id: s.id,
        label: s.label,
        recipient: s.recipient,
        share: s.share,
        fromHeight: s.fromHeight,
        toHeight: s.toHeight,
        firstDate: t.firstDate,
        lastDate: t.lastDate,
        zec: zec(t.zat),
        usdAtReceipt: dollars(t.usdAtReceipt),
        zecWithoutPrice: zec(t.zatWithoutPrice),
        rules: s.rules,
      };
    }),
    years: yearlyTotals(points).map((y) => ({
      year: y.year,
      zec: Object.fromEntries(STREAM_IDS.map((id) => [id, zec(y.zat[id])])),
      usdAtReceipt: Object.fromEntries(
        STREAM_IDS.map((id) => [id, dollars(y.usd[id])]),
      ),
    })),
    ...(url.searchParams.get("daily") === "1"
      ? {
          daily: points.map((p) => ({
            date: p.date,
            fromHeight: p.fromHeight,
            toHeight: p.toHeight,
            closeUsd: p.closeUsd,
            zec: Object.fromEntries(
              STREAM_IDS.map((id) => [id, zec(p.allocation[id])]),
            ),
          })),
        }
      : {}),
  };
  return Response.json(body);
}
