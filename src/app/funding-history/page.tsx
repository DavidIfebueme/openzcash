import Link from "next/link";
import { PageHeader, Stat, Mono } from "@/components/ui";
import { SectionHeading, SourceNote } from "@/components/workspace";
import { formatUsdCents } from "@/lib/zcg/format";
import { formatZec, formatZecCompact } from "@/lib/zcash/units";
import { currentZecUsdQuote } from "@/lib/pricing/live-price";
import { cachedChainTip } from "@/lib/zcash/lockbox-live";
import {
  HEIGHTS,
  LOCKBOX_DISBURSEMENT,
  STREAM_IDS,
  ZAT_PER_ZEC,
  allocationBetween,
  lockboxBalanceAt,
  type StreamId,
} from "@/lib/funding/consensus";
import {
  HISTORY_META,
  dailySeries,
  dateOfHeight,
  issuedThrough,
  streamTotals,
  yearlyTotals,
} from "@/lib/funding/history";
import { CHECKED_BLOCKS, ERAS, STREAMS } from "@/lib/funding/streams";
import { addressBalance, nodeLockboxPool } from "@/lib/funding/node-check";
import { COINHOLDER_FUND } from "@/lib/funding/destinations";
import { DestinationsSection } from "./destinations-section";
import styles from "./funding-history.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Zcash's Since block zero · OpenZcash",
  description:
    "Every ZEC the Zcash protocol has allocated outside mining since the genesis block, computed block by block from the consensus rules and valued at the close of the day it was paid.",
};

const zat = (n: number) => BigInt(Math.round(n));
const usd = (dollars: number, compact = true) =>
  formatUsdCents(Math.round(dollars * 100), { compact });
const pct = (part: number, whole: number) =>
  whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "·";
const blockLink = (h: number) => `https://cipherscan.app/block/${h}`;
const monthYear = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) : "·";

export default async function FundingHistoryPage() {
  const [tip, quote, node, fund] = await Promise.all([
    cachedChainTip().catch(() => 0),
    currentZecUsdQuote().catch(() => null),
    nodeLockboxPool().catch(() => null),
    addressBalance(COINHOLDER_FUND.address).catch(() => null),
  ]);

  const points = dailySeries();
  const totals = streamTotals(points);
  const years = yearlyTotals(points);
  const issued = issuedThrough(points);
  const nonMinerZat = STREAM_IDS.reduce((s, id) => s + issued[id], 0);
  const usdAtReceipt = totals.reduce((s, t) => s + t.usdAtReceipt, 0);
  const priceUsd = quote ? quote.cents / 100 : null;
  const through = HISTORY_META.through;

  // Blocks mined after the last complete day in the series, straight from the rules.
  const live =
    tip > through.height ? allocationBetween(through.height + 1, tip) : null;
  const lockboxNow = tip > 0 ? lockboxBalanceAt(tip) : null;
  const toDate = Object.fromEntries(
    STREAM_IDS.map((id) => [
      id,
      totals.find((t) => t.id === id)!.zat + (live?.[id] ?? 0),
    ]),
  ) as Record<StreamId, number>;
  const dayOf = (h: number) => dateOfHeight(h, points) ?? "·";
  const maxYearZat = Math.max(
    ...years.map((y) => STREAM_IDS.reduce((s, id) => s + y.zat[id], 0)),
  );

  return (
    <>
      <PageHeader
        title="Zcash's Since block zero"
        subtitle="Every ZEC the protocol has paid outside mining since the genesis block, computed block by block from the consensus rules and valued at the ZEC/USD close of the day it was paid. Heights by day from Blockchair; daily closes from Bitfinex."
      />

      <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Allocated outside mining"
          value={formatZecCompact(zat(nonMinerZat))}
          sub={`${pct(nonMinerZat, issued.subsidy)} of all ZEC issued`}
        />
        <Stat
          label="USD at receipt"
          value={usd(usdAtReceipt)}
          sub="each day valued at its close"
        />
        <Stat
          label="Same ZEC at today's price"
          value={priceUsd ? usd((nonMinerZat / ZAT_PER_ZEC) * priceUsd) : "·"}
          sub={
            priceUsd
              ? `at ${usd(priceUsd, false)} per ZEC`
              : "live price unavailable"
          }
        />
        <Stat
          label="In-protocol lockbox"
          value={lockboxNow !== null ? formatZecCompact(zat(lockboxNow)) : "·"}
          sub={
            tip > 0
              ? `value pool at block ${tip.toLocaleString("en-US")}`
              : "chain tip unavailable"
          }
        />
      </section>

      <SectionHeading
        title="By recipient"
        description="Who each consensus rule paid, for how long, and what that ZEC was worth on the days it arrived."
      />
      <div className={styles.wrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Recipient</th>
              <th className={styles.hideSm}>Period</th>
              <th className={styles.num}>Share</th>
              <th className={styles.num}>ZEC</th>
              <th className={styles.num}>USD at receipt</th>
              <th className={`${styles.num} ${styles.hideSm}`}>Avg. price</th>
              <th className={styles.hideSm}>Follow the money</th>
            </tr>
          </thead>
          <tbody>
            {STREAMS.map((s) => {
              const t = totals.find((x) => x.id === s.id)!;
              const priced = (t.zat - t.zatWithoutPrice) / ZAT_PER_ZEC;
              return (
                <tr key={s.id}>
                  <td>
                    <strong>{s.label}</strong>
                    <span className={styles.small}>
                      {ERAS[s.era].label === s.label ? s.recipient : ERAS[s.era].label}
                    </span>
                  </td>
                  <td className={`${styles.muted} ${styles.hideSm}`}>
                    {monthYear(t.firstDate)} to{" "}
                    {s.toHeight === null ? "today" : monthYear(t.lastDate)}
                  </td>
                  <td className={styles.num}>{s.share}</td>
                  <td className={styles.num}>
                    {formatZec(zat(t.zat), { symbol: false })}
                  </td>
                  <td className={styles.num}>{usd(t.usdAtReceipt)}</td>
                  <td className={`${styles.num} ${styles.hideSm}`}>
                    {priced > 0 ? usd(t.usdAtReceipt / priced, false) : "·"}
                  </td>
                  <td className={styles.hideSm}>
                    <span className={styles.links}>
                      {s.destinations.map((d) => (
                        <Link key={d.href} href={d.href}>
                          {d.label} →
                        </Link>
                      ))}
                      {s.rules.map((r) => (
                        <a
                          key={r.href}
                          href={r.href}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {r.label.split(" · ")[0]} ↗
                        </a>
                      ))}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {live ? (
        <p className={styles.live}>
          Since {through.date} (block {through.height.toLocaleString("en-US")}),{" "}
          {(tip - through.height).toLocaleString("en-US")} more blocks have paid{" "}
          {formatZec(zat(live.zcg))} to ZCG and added{" "}
          {formatZec(zat(live.lockbox))} to the lockbox. The daily series closes
          at the last complete UTC day.
        </p>
      ) : null}

      <div className={styles.section}>
        <SectionHeading
          title="Year by year"
          description="ZEC allocated outside mining each calendar year. The halvings and Blossom show as steps; the price at receipt does the rest."
        />
        <div className={styles.wrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Year</th>
                <th className={`${styles.num} ${styles.hideSm}`}>
                  Founders&apos; Reward
                </th>
                <th className={`${styles.num} ${styles.hideSm}`}>
                  Dev Fund 2020
                </th>
                <th className={`${styles.num} ${styles.hideSm}`}>ZCG</th>
                <th className={`${styles.num} ${styles.hideSm}`}>Lockbox</th>
                <th className={styles.num}>Total ZEC</th>
                <th aria-hidden />
                <th className={styles.num}>USD at receipt</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => {
                const devFund =
                  y.zat.devFundEcc + y.zat.devFundZf + y.zat.devFundMajorGrants;
                const total = STREAM_IDS.reduce((s, id) => s + y.zat[id], 0);
                const totalUsd = STREAM_IDS.reduce((s, id) => s + y.usd[id], 0);
                const cell = (v: number) =>
                  v ? formatZecCompact(zat(v), { symbol: false }) : "·";
                return (
                  <tr key={y.year}>
                    <td>
                      <strong>{y.year}</strong>
                    </td>
                    <td className={`${styles.num} ${styles.hideSm}`}>
                      {cell(y.zat.foundersReward)}
                    </td>
                    <td className={`${styles.num} ${styles.hideSm}`}>
                      {cell(devFund)}
                    </td>
                    <td className={`${styles.num} ${styles.hideSm}`}>
                      {cell(y.zat.zcg)}
                    </td>
                    <td className={`${styles.num} ${styles.hideSm}`}>
                      {cell(y.zat.lockbox)}
                    </td>
                    <td className={styles.num}>{cell(total)}</td>
                    <td>
                      <div
                        className={styles.bar}
                        role="img"
                        aria-label={`${pct(total, maxYearZat)} of the largest year`}
                      >
                        <span
                          style={{ width: `${(total / maxYearZat) * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className={styles.num}>{usd(totalUsd)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <DestinationsSection
        streamZat={toDate}
        throughHeight={live ? tip : through.height}
        multisigZat={fund?.zat ?? null}
        lockboxNowZat={lockboxNow}
      />

      <div className={styles.section}>
        <SectionHeading
          title="Milestones"
          description="The heights where the rules changed. Each links to its block on CipherScan."
        />
        <ol className={styles.events}>
          {[
            {
              h: 0,
              text: "Genesis. The Founders' Reward starts at 20% of each block, on a slow-start ramp.",
            },
            {
              h: 20_000,
              text: "The slow start ends: 12.5 ZEC per block, 2.5 ZEC of it Founders' Reward.",
            },
            {
              h: HEIGHTS.blossom,
              text: "Blossom: 75-second blocks. The per-block subsidy halves; daily issuance does not.",
            },
            {
              h: HEIGHTS.canopy,
              text: "First halving. The Founders' Reward ends and the Dev Fund starts: 7% ECC, 5% ZF, 8% Major Grants.",
            },
            {
              h: HEIGHTS.nu6,
              text: "NU6, second halving. 8% to Zcash Community Grants, 12% accrues in the in-protocol lockbox.",
            },
            {
              h: HEIGHTS.nu61,
              text: `NU6.1. Everything the lockbox held, ${formatZec(zat(LOCKBOX_DISBURSEMENT.zat))}, leaves in ten coinbase outputs; the lockbox starts again from zero.`,
              extra: <Mono value={LOCKBOX_DISBURSEMENT.address} />,
            },
          ].map((e) => (
            <li key={e.h}>
              <time>{dayOf(e.h)}</time>
              <span>
                {e.text} {e.extra}
              </span>
              <a href={blockLink(e.h)} target="_blank" rel="noreferrer">
                Block {e.h.toLocaleString("en-US")} ↗
              </a>
            </li>
          ))}
          <li>
            <time>est. 2028</time>
            <span className={styles.muted}>
              Third halving at block{" "}
              {HEIGHTS.thirdHalving.toLocaleString("en-US")}: every stream in
              the ZIPs in force today ends there, unless a new upgrade changes
              it.
            </span>
            <span />
          </li>
        </ol>
      </div>

      <div className={styles.section}>
        <SectionHeading
          title="How this is checked"
          description="The rules are code; these real blocks and balances pin them down. The same checks run in the test suite."
        />
        <ol className={styles.events}>
          {CHECKED_BLOCKS.map((c) => (
            <li key={c.height}>
              <time>{dayOf(c.height)}</time>
              <span>
                {c.what}. The coinbase matches the rules.
              </span>
              <a href={blockLink(c.height)} target="_blank" rel="noreferrer">
                Block {c.height.toLocaleString("en-US")} ↗
              </a>
            </li>
          ))}
          {node ? (
            <li>
              <time>live</time>
              <span>
                The node reports {formatZec(zat(node.zat))} in the lockbox at
                block {node.height.toLocaleString("en-US")}; the rules give{" "}
                {formatZec(zat(lockboxBalanceAt(node.height)))}.{" "}
                {lockboxBalanceAt(node.height) === node.zat
                  ? "They match to the zatoshi."
                  : "They differ; this needs review."}
              </span>
              <a href={node.source} target="_blank" rel="noreferrer">
                Value pools ↗
              </a>
            </li>
          ) : null}
        </ol>
      </div>

      <SourceNote href="/api/funding/history" label="Data as JSON or CSV">
        Consensus rules from the Zcash protocol specification and ZIPs 207, 214,
        1015 and 2001. A day runs from its first block to the block before the
        next day&apos;s first block. USD at receipt uses the Bitfinex ZEC/USD
        daily close; the genesis day has no close, so its{" "}
        {formatZec(zat(totals[0].zatWithoutPrice))} carry no dollar value.
        Series through {through.date}, generated{" "}
        {HISTORY_META.generatedAt.slice(0, 10)}.
      </SourceNote>
    </>
  );
}
