import Link from "next/link";
import { SectionHeading } from "@/components/workspace";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { getDefiPools } from "@/lib/defi/pools";

export const dynamic = "force-dynamic";
export const metadata = { title: "ZEC DeFi liquidity · OpenZcash" };

function usd0(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function zec(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export default async function DefiPage() {
  const pools = await getDefiPools();
  const totalZec = pools.reduce((s, p) => s + p.zecDepth, 0);
  const totalTvl = pools.reduce((s, p) => s + p.tvlUsd, 0);

  return (
    <>
      <PageHeader
        title="ZEC DeFi liquidity"
        subtitle="Native ZEC pool depth, value locked and yield from public Midgard APIs (Maya Protocol, THORChain), refreshed every few minutes."
      />

      <p className="ws-copilot-fine" style={{ marginBottom: 18 }}>
        ZCG&rsquo;s own position on Maya, its value and the fees it earns, is on{" "}
        <Link href="/zcg/investments">Investments →</Link>.
        {" "}Compare trading activity and public exchange balances on{" "}
        <Link href="/cex-zec-dex">CEX &lt; ZEC &gt; DEX →</Link>.
      </p>

      <SectionHeading
        title="Native ZEC liquidity"
        description="Pool depth, value locked and yield across the venues that hold native ZEC, from their public APIs."
      />
      <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat
          label="Pools live"
          value={String(pools.length)}
          sub="venues reporting"
        />
        <Stat
          label="ZEC in pools"
          value={zec(totalZec)}
          sub="native ZEC liquidity"
        />
        <Stat
          label="Total value locked"
          value={usd0(totalTvl)}
          sub="both sides · live"
        />
      </section>

      {pools.length === 0 ? (
        <Card>
          <p className="text-sm text-stone-600">
            No pool data right now. The venues&rsquo; APIs may be briefly
            unreachable. This refreshes automatically.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {pools.map((p) => (
            <a
              key={p.venue}
              href={p.url}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <Card interactive>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-stone-600">
                      {p.venue}
                    </p>
                    <p className="mt-1 text-sm font-medium text-stone-900">
                      {p.asset} pool
                    </p>
                  </div>
                  <Badge tone="emerald">
                    {p.apyPct != null
                      ? `${p.apyPct.toFixed(2)}% APY`
                      : p.volume24hUsd != null
                        ? `${usd0(p.volume24hUsd)} · 24h`
                        : p.asset}
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] text-stone-600">ZEC depth</p>
                    <p className="truncate text-sm font-semibold text-stone-900 tnum">
                      {zec(p.zecDepth)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-stone-600">TVL</p>
                    <p className="truncate text-sm font-semibold text-stone-900 tnum">
                      {usd0(p.tvlUsd)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-stone-600">ZEC price</p>
                    <p className="truncate text-sm font-semibold text-stone-900 tnum">
                      {usd0(p.priceUsd)}
                    </p>
                  </div>
                </div>
              </Card>
            </a>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-stone-600">
        Data: Maya &amp; THORChain (Midgard v2) and NEAR / Rhea Finance
        (GeckoTerminal). NEAR Intents holds further large cross-chain ZEC
        liquidity across many bridged pairs, not summed here to avoid
        double-counting their shared vault.
      </p>
    </>
  );
}
