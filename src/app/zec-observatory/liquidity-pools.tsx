import Link from "next/link";
import { getDefiPools } from "@/lib/defi/pools";
import styles from "./markets.module.css";

const usd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
const zec = (value: number) =>
  value.toLocaleString("en-US", { maximumFractionDigits: 2 });

export function LiquidityLoading() {
  return <p className={styles.empty} role="status">Loading pool liquidity…</p>;
}

export async function LiquidityPools() {
  const pools = await getDefiPools();

  return (
    <>
      {pools.length === 0 ? (
        <p className={styles.empty}>
          Pool data is unavailable. This does not mean the venues have no liquidity.
        </p>
      ) : (
        <div className={styles.liquidityGrid}>
          {pools.map((pool) => {
            const native = pool.asset === "ZEC.ZEC";
            return (
              <article className={styles.liquidityCard} key={pool.venue}>
                <header>
                  <div>
                    <h3>
                      <a href={pool.url} target="_blank" rel="noreferrer">
                        {pool.venue} <span aria-hidden="true">↗</span>
                      </a>
                    </h3>
                    <small>{pool.asset} · {native ? "Native ZEC" : "Bridged ZEC on NEAR"}</small>
                  </div>
                </header>
                <dl className={styles.liquidityStats}>
                  <div>
                    <dt>{native ? "ZEC depth" : "Est. ZEC depth"}</dt>
                    <dd>{zec(pool.zecDepth)} ZEC</dd>
                  </div>
                  <div>
                    <dt>{native ? "Est. pool value" : "Reported pool value"}</dt>
                    <dd>{usd(pool.tvlUsd)}</dd>
                  </div>
                  <div>
                    <dt>{native ? "Valuation price" : "Token price"}</dt>
                    <dd>{usd(pool.priceUsd)}</dd>
                  </div>
                  <div>
                    <dt>{native ? "Reported APY" : "Volume · 24h"}</dt>
                    <dd>
                      {native
                        ? pool.apyPct != null && pool.apyPct > 0
                          ? `${pool.apyPct.toFixed(2)}%`
                          : "Unavailable"
                        : pool.volume24hUsd != null && pool.volume24hUsd > 0
                          ? usd(pool.volume24hUsd)
                          : "Unavailable"}
                    </dd>
                  </div>
                </dl>
                <p>
                  {native
                    ? "Pool value estimates both sides as twice the ZEC depth at the shared ZEC price, with the venue quote as fallback. APY is variable."
                    : "GeckoTerminal reports the pool value. ZEC depth estimates half that value at the token price, assuming a balanced pair."}
                </p>
              </article>
            );
          })}
        </div>
      )}
      <div className={styles.liquidityNotes}>
        <p>
          Sources: Maya and THORChain (Midgard v2), Rhea Finance on NEAR
          (GeckoTerminal). Coverage is partial; unavailable venues are omitted.
          Pool responses are cached for five minutes and may use a saved response.
          Reload the page to request another snapshot. Unconfirmed zero APY or
          volume readings are shown as unavailable.
        </p>
        <p>
          NEAR Intents pairs share a ZEC vault and are not summed here.
          ZCG’s own Maya position and fees are on{" "}
          <Link href="/zcg/investments">Investments →</Link>.
        </p>
      </div>
    </>
  );
}
