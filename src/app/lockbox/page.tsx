
import { PageHeader } from "@/components/ui";
import { LockboxLiveFeed } from "@/components/lockbox-live-feed";
import { currentZecUsdCents } from "@/lib/pricing/live-price";
import { getCurrentHeight } from "@/lib/zcash/real/lwd/lwd-client";
import { BLOCKS_PER_DAY, LOCKBOX_ZEC_PER_BLOCK } from "@/lib/zcash/lockbox";
import { latestSnapshot } from "@/lib/zcg/snapshots-repo";
import { pageMetadata } from "@/lib/seo/page-metadata";

/** The stream as NU7 left it: a third per block, three times as often. */
const STREAM = `Since NU7, every block mined adds ${LOCKBOX_ZEC_PER_BLOCK} ZEC (12% of the block subsidy) to the in-protocol Lockbox, about ${Math.round(LOCKBOX_ZEC_PER_BLOCK * BLOCKS_PER_DAY)} ZEC a day.`;

export const metadata = pageMetadata({
  title: "Lockbox · live funding · OpenZcash",
  description: `Real-time view of the Zcash deferred Dev Fund. ${STREAM}`,
  path: "/lockbox",
  card: { title: "Lockbox" },
});
export const dynamic = "force-dynamic";

const LWD_URL = process.env.LWD_URL ?? "zec.rocks:443";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("t")), ms)),
  ]);
}

export default async function TransacoesPage() {
  // Initial chain tip for SSR; the client refines it by polling /api/chain-tip.
  let initialHeight = 0;
  try {
    initialHeight = await withTimeout(getCurrentHeight(LWD_URL), 5_000);
  } catch {
    initialHeight = 0;
  }
  // Anchor the live total to the spreadsheet's real Lockbox balance so it
  // agrees with the other screens; live blocks only add to it from there.
  const snap = await latestSnapshot("lockbox_coinholder");
  const baselineZec = snap?.zecBalanceZat
    ? Number(snap.zecBalanceZat) / 1e8
    : 0;
  const baselineHeight = snap?.blockHeight ? Number(snap.blockHeight) : 0;

  // Live market price (CoinGecko, then CoinPaprika or Coinbase; ~10 min cache); fall back to the sheet price.
  const liveCents = await currentZecUsdCents();
  const zecUsd = (liveCents ?? Number(snap?.zecusdPriceCents ?? 39_200)) / 100;

  return (
    <>
      <PageHeader
        title="Lockbox · live funding"
        subtitle={`Real-time view of the Zcash deferred Dev Fund. ${STREAM} This is the protocol funding stream read straight from the chain tip, not viewing-key data.`}
      />
      <>
        <LockboxLiveFeed
          initialHeight={initialHeight}
          zecUsd={zecUsd}
          baselineZec={baselineZec}
          baselineHeight={baselineHeight}
        />
      </>
    </>
  );
}
