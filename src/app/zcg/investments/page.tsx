import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui";
import {
  getMayaActivity,
  MAYA_POOL_URL,
  MAYA_VOLUME_URL,
  MAYA_MIDGARD,
  type MayaFeed,
} from "@/lib/defi/maya-activity";
import {
  getMayaPosition,
  ZCG_MAYA_MEMBER,
  ZCG_MAYA_ZEC_ADDRESS,
} from "@/lib/defi/maya-position";
import { latestSnapshot, mayaTransfers } from "@/lib/zcg/snapshots-repo";
import { currentZecUsdCents, zatToUsdCents } from "@/lib/pricing/live-price";
import { formatUsdCents } from "@/lib/zcg/format";
import { formatZec } from "@/lib/zcash/units";
import { spreadsheetSource } from "@/lib/zcg/source-links";
import { ZCG_GIDS } from "@/lib/zcg/sheets";
import { MayaEarningsChart, MayaVolumeChart } from "./charts";
import styles from "./investments.module.css";
import { pageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "ZCG Investments · OpenZcash",
  description:
    "The liquidity ZCG supports. The activity it enables. The position the treasury holds.",
  path: "/zcg/investments",
});
const ANNOUNCEMENT =
  "https://forum.zcashcommunity.com/t/zcg-maya-liquidity/51608";
const compactUsd = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });
const number = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { maximumFractionDigits: digits });
const usdCents = (n: bigint | null) =>
  n == null ? "Unavailable" : formatUsdCents(n, { compact: true });
const signed = (n: bigint) =>
  `${n < 0n ? "−" : "+"}${usdCents(n < 0n ? -n : n)}`;
const month = (m: string) =>
  new Date(m + "-01T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const time = (date: string) =>
  new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  }) + " UTC";

function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children} <span aria-hidden="true">↗</span>
    </a>
  );
}
function FeedNote({ feed }: { feed: MayaFeed<unknown> | null }) {
  return (
    <span className={styles.fine}>
      {feed
        ? `${feed.stale ? "Saved snapshot" : "Fetched"} · ${time(feed.fetchedAt)}`
        : "Source temporarily unavailable"}
    </span>
  );
}
function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note: ReactNode;
}) {
  return (
    <div className={styles.metric}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      <p>{note}</p>
    </div>
  );
}

export default async function InvestmentsPage() {
  const [transfers, sheet, liveCents, live, activity] = await Promise.all([
    mayaTransfers().catch(() => null),
    latestSnapshot("maya_liquidity").catch(() => null),
    currentZecUsdCents().catch(() => null),
    getMayaPosition(),
    getMayaActivity(),
  ]);
  const hasTransfers = !!transfers?.length;
  const lpZec = hasTransfers
    ? transfers.reduce((s, t) => s + (t.zecTransferredZat ?? 0n), 0n)
    : null;
  const lpUsd = hasTransfers
    ? transfers.reduce((s, t) => s + (t.amountUsdCents ?? 0n), 0n)
    : null;
  const heldCents =
    liveCents != null && lpZec != null ? zatToUsdCents(lpZec, liveCents) : null;
  const livePositionCents =
    live?.totalCents != null ? BigInt(live.totalCents) : null;
  const sheetCents = sheet?.usdCashBalanceCents ?? null;
  const positionCents = livePositionCents ?? sheetCents;
  const kpiAsOf = sheet?.status?.replace(/^kpis as of /i, "") ?? null;
  // Compare the current valuation only. A hand-dated sheet fallback is not a
  // comparable current return and must not silently replace it in the chart.
  const vsCost =
    livePositionCents != null && lpUsd != null
      ? livePositionCents - lpUsd
      : null;
  const vsHolding =
    livePositionCents != null && heldCents != null
      ? livePositionCents - heldCents
      : null;
  const mayaTab = spreadsheetSource(ZCG_GIDS.maya, null).sourceUrl;
  const total = activity.allTime?.data;
  const recent = activity.last30d?.data;
  const pool = activity.liquidity?.data;
  const months = activity.monthly?.data ?? [];
  const firstActive = months.find((m) => m.count > 0);
  const lastActive = months.findLast((m) => m.count > 0);
  const breakdown = total?.breakdown;
  const poolOutOfSync =
    activity.sync?.data.inSync === false ||
    !!(
      activity.sync?.data.indexedAt &&
      Date.parse(activity.sync.fetchedAt) -
        Date.parse(activity.sync.data.indexedAt) >
        30 * 60_000
    );
  const composition = breakdown
    ? [
        {
          label: "Native swaps",
          value: breakdown.native,
          color: "var(--accent)",
          note: "Native ZEC ↔ CACAO",
        },
        {
          label: "Trade assets",
          value: breakdown.trade,
          color: "var(--investment-trade)",
          note: "Trading balances within Maya",
        },
        {
          label: "Synthetic assets",
          value: breakdown.synth,
          color: "var(--investment-synth)",
          note: "Synth minting and redemption",
        },
      ]
    : [];
  const comparison =
    lpUsd != null && livePositionCents != null && heldCents != null
      ? [
          {
            label: "Original contribution",
            value: lpUsd,
            color: "var(--investment-synth)",
          },
          {
            label: "LP position now",
            value: livePositionCents,
            color: "var(--accent)",
          },
          {
            label: "If ZEC had been held",
            value: heldCents,
            color: "var(--investment-trade)",
          },
        ]
      : [];
  const comparisonMax = Math.max(...comparison.map((r) => Number(r.value)), 1);
  const zecPercent =
    live?.totalCents && live.zecLegCents != null
      ? (live.zecLegCents / live.totalCents) * 100
      : null;
  const withdrawals = live
    ? live.zecWithdrawn > 0 || live.cacaoWithdrawn > 0
    : null;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Investments"
        subtitle="The liquidity ZCG supports. The activity it enables. The position the treasury holds."
        actions={
          <a className={styles.textLink} href="#treasury-position">
            Explore the ZCG position <span aria-hidden="true">↓</span>
          </a>
        }
      />

      <section className={styles.hero} aria-labelledby="maya-title">
        <div className={styles.heroTop}>
          <div className={styles.protocol}>
            <span className={styles.protocolMark} aria-hidden="true">
              {/* Official Maya symbol from mayaprotocol.com, served locally. */}
              <Image src="/logos/maya.svg" alt="" width={44} height={20} unoptimized />
            </span>
            <div>
              <span className={styles.eyebrow}>Native ZEC liquidity</span>
              <h2 id="maya-title">Maya Protocol</h2>
            </div>
          </div>
          <External href={MAYA_POOL_URL}>Explore ZEC pool</External>
        </div>
        <div className={styles.heroBody}>
          <div className={styles.heroVolume}>
            <p className={styles.eyebrow}>All-time ZEC pool volume</p>
            <p className={styles.heroNumber}>
              {total ? compactUsd(total.volumeUsd) : "Unavailable"}
            </p>
            <p>
              Swapped through the entire ZEC pool
              {firstActive ? ` since ${month(firstActive.month)}` : ""}.
            </p>
            <p className={styles.fine}>
              Includes native, trade and synth swaps. This is pool activity, not
              ZCG revenue.
            </p>
          </div>
          <dl className={styles.heroMetrics}>
            <Metric
              label="Reported swaps"
              value={total ? number(total.count) : "—"}
              note="Protocol operations · all time"
            />
            <Metric
              label="ZEC in the pool"
              value={pool ? number(pool.zec, 2) : "—"}
              note={
                pool
                  ? `Paired with ${number(pool.cacao)} CACAO`
                  : "Pool depth unavailable"
              }
            />
            <Metric
              label="ZCG pool share"
              value={live ? `${(live.share * 100).toFixed(1)}%` : "—"}
              note="Share of liquidity-provider units"
            />
          </dl>
        </div>
        <div className={styles.sourceStrip}>
          <span className={styles.sourceStatus}>
            <i
              data-warning={
                poolOutOfSync ||
                activity.allTime?.stale ||
                !activity.sync ||
                activity.sync.stale
              }
            />
            {poolOutOfSync
              ? "Maya index may be behind"
              : activity.sync && !activity.sync.stale
                ? "Maya index synchronized"
                : "Sync status unavailable"}
          </span>
          <FeedNote feed={activity.allTime} />
          <External href={MAYA_VOLUME_URL}>Source data</External>
        </div>
      </section>

      <div className={styles.activityGrid}>
        <section className={styles.panel} aria-labelledby="volume-title">
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.eyebrow}>Pool activity</span>
              <h2 id="volume-title">ZEC volume over time</h2>
            </div>
          </div>
          {activity.monthly ? (
            <MayaVolumeChart
              months={months}
              asOf={activity.monthly.fetchedAt}
            />
          ) : (
            <p className={styles.empty}>
              Volume history is temporarily unavailable. Other pool data remains
              available above.
            </p>
          )}
          <FeedNote feed={activity.monthly} />
        </section>
        <aside className={styles.panel} aria-labelledby="volume-mix-title">
          <span className={styles.eyebrow}>Behind the total</span>
          <h2 id="volume-mix-title">What makes up the volume</h2>
          {composition.length > 0 && total ? (
            <>
              <div className={styles.stackedBar} aria-hidden="true">
                {composition.map((c) => (
                  <span
                    key={c.label}
                    style={{
                      width: `${total.volumeUsd > 0 ? (c.value / total.volumeUsd) * 100 : 0}%`,
                      background: c.color,
                    }}
                  />
                ))}
              </div>
              <ul className={styles.mixList}>
                {composition.map((c) => (
                  <li key={c.label}>
                    <div>
                      <i style={{ background: c.color }} />
                      <strong>{c.label}</strong>
                      <span>
                        {total.volumeUsd > 0
                          ? ((c.value / total.volumeUsd) * 100).toFixed(1)
                          : "0"}
                        %
                      </span>
                    </div>
                    <p>
                      <b>{compactUsd(c.value)}</b>
                      <small>{c.note}</small>
                    </p>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className={styles.empty}>Volume breakdown unavailable.</p>
          )}
          <div className={styles.recent}>
            <div>
              <span className={styles.eyebrow}>Last 30 days</span>
              <strong>{recent ? compactUsd(recent.volumeUsd) : "—"}</strong>
            </div>
            <p>
              {recent
                ? `${number(recent.count)} reported swaps`
                : "Recent activity unavailable"}
            </p>
            {recent?.count === 0 && (
              <p className={styles.fine}>
                Midgard reports no swaps in this window.
                {lastActive
                  ? ` The last active month in the returned history is ${month(lastActive.month)}.`
                  : ""}
              </p>
            )}
            <FeedNote feed={activity.last30d} />
          </div>
        </aside>
      </div>

      <section
        id="treasury-position"
        className={styles.treasury}
        aria-labelledby="position-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>Treasury performance</span>
            <h2 id="position-title">The ZCG position</h2>
            <p>
              ZCG and FPF seeded this position. Pool usage and the treasury’s
              financial result answer different questions.
            </p>
          </div>
          <span className={styles.chip}>ZEC / CACAO</span>
        </div>
        <dl className={styles.positionMetrics}>
          <Metric
            label="Original contribution"
            value={usdCents(lpUsd)}
            note={
              lpZec != null
                ? `${formatZec(lpZec, { symbol: false })} ZEC · ${transfers!.length} transfers`
                : "Contribution ledger unavailable"
            }
          />
          <Metric
            label={
              livePositionCents != null
                ? "Position value now"
                : "Position · sheet snapshot"
            }
            value={usdCents(positionCents)}
            note={
              vsCost != null ? (
                <span
                  className={vsCost >= 0n ? styles.positive : styles.negative}
                >
                  {signed(vsCost)} vs. contribution
                </span>
              ) : kpiAsOf ? (
                `Recorded ${kpiAsOf}`
              ) : (
                "Current valuation unavailable"
              )
            }
          />
          <Metric
            label="If ZEC had been held"
            value={usdCents(heldCents)}
            note={
              vsHolding != null ? (
                <span
                  className={
                    vsHolding >= 0n ? styles.positive : styles.negative
                  }
                >
                  LP position is {signed(vsHolding)} vs. holding
                </span>
              ) : (
                "Contributed ZEC at the current ZEC price"
              )
            }
          />
        </dl>
        <div className={styles.positionGrid}>
          <section className={styles.panel} aria-labelledby="comparison-title">
            <span className={styles.eyebrow}>A common USD scale</span>
            <h3 id="comparison-title">Providing liquidity vs. holding ZEC</h3>
            {comparison.length > 0 ? (
              <div className={styles.comparison}>
                {comparison.map((r) => (
                  <div key={r.label}>
                    <div>
                      <span>{r.label}</span>
                      <strong>{usdCents(r.value)}</strong>
                    </div>
                    <div className={styles.comparisonTrack} aria-hidden="true">
                      <span
                        style={{
                          width: `${(Number(r.value) / comparisonMax) * 100}%`,
                          background: r.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.empty}>
                A current position valuation, ZEC price and contribution record
                are needed for this comparison.
              </p>
            )}
            <p className={styles.fine}>
              Half of the initial ZEC was exchanged for CACAO to form the pair.
              The pool rebalances as the relative prices change. This comparison
              includes accrued earnings and excludes any withdrawn assets.
            </p>
            {live && (
              <p className={styles.fine}>
                {live.stale ? "Saved position snapshot" : "Position fetched"} ·{" "}
                {time(live.fetchedAt)}
              </p>
            )}
          </section>
          <section className={styles.panel} aria-labelledby="allocation-title">
            <span className={styles.eyebrow}>Inside the position</span>
            <h3 id="allocation-title">Current allocation</h3>
            {live ? (
              <>
                {zecPercent != null && (
                  <div className={styles.stackedBar} aria-hidden="true">
                    <span
                      style={{
                        width: `${zecPercent}%`,
                        background: "var(--accent)",
                      }}
                    />
                    <span
                      style={{
                        width: `${100 - zecPercent}%`,
                        background: "var(--investment-trade)",
                      }}
                    />
                  </div>
                )}
                <dl className={styles.allocation}>
                  <div>
                    <dt>
                      <i style={{ background: "var(--accent)" }} />
                      ZEC{" "}
                      {zecPercent != null && (
                        <small>{zecPercent.toFixed(1)}%</small>
                      )}
                    </dt>
                    <dd>
                      {number(live.zecNow, 2)} ZEC
                      <small>
                        {live.zecLegCents != null
                          ? compactUsd(live.zecLegCents / 100)
                          : "Price unavailable"}
                      </small>
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <i style={{ background: "var(--investment-trade)" }} />
                      CACAO{" "}
                      {zecPercent != null && (
                        <small>{(100 - zecPercent).toFixed(1)}%</small>
                      )}
                    </dt>
                    <dd>
                      {number(live.cacaoNow)} CACAO
                      <small>
                        {live.cacaoLegCents != null
                          ? compactUsd(live.cacaoLegCents / 100)
                          : "Price unavailable"}
                      </small>
                    </dd>
                  </div>
                </dl>
                <p className={styles.fine}>
                  Percentages by USD value. ZEC at{" "}
                  {live.zecUsd != null
                    ? `$${number(live.zecUsd, 2)}`
                    : "unavailable"}
                  ; CACAO at{" "}
                  {live.cacaoUsd != null
                    ? `$${live.cacaoUsd.toFixed(4)}`
                    : "unavailable"}{" "}
                  (
                  {live.cacaoPriceSource === "coingecko"
                    ? "CoinGecko"
                    : "pool-implied"}
                  ).
                </p>
                <p className={styles.withdrawal}>
                  {withdrawals
                    ? `${number(live.zecWithdrawn, 2)} ZEC + ${number(live.cacaoWithdrawn)} CACAO withdrawn`
                    : "No assets withdrawn from the LP position"}
                </p>
              </>
            ) : (
              <p className={styles.empty}>
                The live allocation is temporarily unavailable.
              </p>
            )}
          </section>
        </div>
      </section>

      <div className={styles.earningsGrid}>
        <section className={styles.panel} aria-labelledby="earnings-title">
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.eyebrow}>ZCG’s estimated share</span>
              <h2 id="earnings-title">Earnings over time</h2>
            </div>
            <span className={styles.chip}>Accrued in the pool</span>
          </div>
          {live && live.earnings.length > 0 ? (
            <MayaEarningsChart earnings={live.earnings} asOf={live.fetchedAt} />
          ) : (
            <p className={styles.empty}>
              Monthly earnings are temporarily unavailable.
            </p>
          )}
          <p className={styles.fine}>
            Earnings are already included in the position value. They are not an
            additional treasury payout. Estimates use the member’s current units
            and each month’s closing pool units; they are not an audited fee
            statement.
          </p>
        </section>
        <aside className={styles.holderNote}>
          <span className={styles.eyebrow}>For ZEC holders</span>
          <h2>Read usage and returns together.</h2>
          <p>
            Volume shows demand for trading through the pool. Liquidity shows
            how much ZEC is available to support those swaps.
          </p>
          <p>
            The treasury comparison shows the cost of providing that liquidity
            relative to simply holding the contributed ZEC.
          </p>
          <div>
            <span>Pool liquidity · Maya’s USD quote</span>
            <strong>
              {pool?.quotedTvlUsd != null
                ? compactUsd(pool.quotedTvlUsd)
                : "Unavailable"}
            </strong>
            <p className={styles.fine}>
              Both sides of the pool at Maya’s own exchange rate. This can
              differ from the external prices used for the ZCG position.
            </p>
            <FeedNote feed={activity.liquidity} />
          </div>
          <Link href="/zec-observatory#liquidity">
            Compare ZEC liquidity across venues{" "}
            <span aria-hidden="true">→</span>
          </Link>
        </aside>
      </div>

      <section
        className={styles.audit}
        aria-label="Investment records and methodology"
      >
        <details open>
          <summary>
            <span>Transfers & custody</span>
            <span className={styles.fine}>
              {hasTransfers ? `${transfers!.length} contributions · ` : ""}
              2-of-3 multisig
            </span>
          </summary>
          <div className={styles.auditBody}>
            {hasTransfers ? (
              <div className={styles.tableScroll}>
                <table>
                  <caption className={styles.srOnly}>
                    ZCG and FPF contributions recorded in the liquidity
                    spreadsheet
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Transfer</th>
                      <th scope="col">Date</th>
                      <th scope="col">USD</th>
                      <th scope="col">ZEC</th>
                      <th scope="col">ZEC/USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers!.map((t) => (
                      <tr key={t.id}>
                        <th scope="row">{t.project ?? "Maya contribution"}</th>
                        <td>{t.transferredAt ?? "—"}</td>
                        <td>{formatUsdCents(t.amountUsdCents)}</td>
                        <td>
                          {t.zecTransferredZat != null
                            ? formatZec(t.zecTransferredZat, { symbol: false })
                            : "—"}
                        </td>
                        <td>
                          {t.zecUsdPriceCents != null
                            ? formatUsdCents(t.zecUsdPriceCents)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.empty}>
                Contribution records are temporarily unavailable.
              </p>
            )}
            <div className={styles.custodyGrid}>
              <div>
                <h3>2-of-3 · Vultisig</h3>
                <p>
                  Jason (ZCG), Aaluxx (Maya Protocol) and Alex (FPF) hold the
                  keys. Any two signers can move the position. The stated fee
                  beneficiary is the ZCG treasury.
                </p>
                <External href={ANNOUNCEMENT}>ZCG announcement</External>
              </div>
              <div>
                <h3>Verify the position</h3>
                <p>
                  {live
                    ? `Added${live.firstAdded ? ` on ${live.firstAdded}` : ""}: ${number(live.zecAdded, 2)} ZEC + ${number(live.cacaoAdded)} CACAO.`
                    : "Inspect the public member and wallet records."}
                </p>
                <div className={styles.sourceLinks}>
                  <External
                    href={`https://www.mayascan.org/address/${ZCG_MAYA_MEMBER}`}
                  >
                    Maya member
                  </External>
                  <External
                    href={`https://mainnet.zcashexplorer.app/address/${ZCG_MAYA_ZEC_ADDRESS}`}
                  >
                    ZEC address
                  </External>
                  {mayaTab && (
                    <External href={mayaTab}>Liquidity spreadsheet</External>
                  )}
                </div>
              </div>
            </div>
          </div>
        </details>
        <details>
          <summary>
            <span>How these numbers are calculated</span>
            <span className={styles.fine}>Sources & methodology</span>
          </summary>
          <div className={styles.auditBody}>
            <ul className={styles.methodology}>
              <li>
                <strong>Scope.</strong> Volume and swap counts cover the entire
                ZEC.ZEC pool, including activity before ZCG joined. They do not
                measure the volume caused by ZCG’s contribution, unique traders
                or a return on the grant.
              </li>
              <li>
                <strong>Historical volume.</strong> Midgard’s USD cents are
                converted to dollars without applying today’s prices. The total
                includes native, trade-asset and synthetic-asset swaps; the
                breakdown reconciles to that total.
              </li>
              <li>
                <strong>Prices.</strong> The ZCG position values ZEC at the
                site’s oracle and CACAO at CoinGecko (or a clearly labelled
                pool-implied fallback). Maya’s internal USD quote can differ.{" "}
                {live?.midgardCents != null
                  ? `Maya's position quote: ${compactUsd(live.midgardCents / 100)}. `
                  : ""}
                {sheetCents != null
                  ? `Spreadsheet KPI${kpiAsOf ? ` as of ${kpiAsOf}` : ""}: ${usdCents(sheetCents)}.`
                  : ""}
              </li>
              <li>
                <strong>Earnings.</strong> Net pool earnings and gross fees are
                different measures. The monthly estimate assumes today’s member
                units were held throughout each included month. Deposits,
                withdrawals or changes in units can change that estimate. The
                sheet’s fee-revenue cell is not used as a zero.
              </li>
              <li>
                <strong>Freshness.</strong> Maya requests are cached for five
                minutes. Failed requests retain a dated, labelled snapshot when
                one exists; missing data is shown as unavailable. Zero means the
                source returned zero. The latest month is incomplete.
              </li>
            </ul>
            <div className={styles.sourceLinks}>
              <External href={MAYA_VOLUME_URL}>Swap data</External>
              <External href={`${MAYA_MIDGARD}/v2/doc`}>
                Maya API documentation
              </External>
              <Link href="/zcg/methodology">OpenZcash methodology →</Link>
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
