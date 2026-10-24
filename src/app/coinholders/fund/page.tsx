import Link from "next/link";
import { currentLockboxZec } from "@/lib/zcash/lockbox-live";
import { currentZecUsdQuote } from "@/lib/pricing/live-price";
import { THIRD_HALVING_HEIGHT } from "@/lib/zcash/lockbox";
import {
  COINHOLDER_SHEET_URL,
  DISBURSEMENT_STEPS,
  FUND_MULTISIG,
  PAYOUTS,
  PROGRAM,
  ZIP_1016_PROCESS,
} from "@/lib/coinholder/program";
import {
  NU6_1_HEIGHT,
  formatPaidZec,
  fundOutlook,
  payoutSummary,
} from "@/lib/coinholder/fund";
import { ROUNDS } from "@/lib/coinholder/rounds";
import { formatPct, formatZec, summarize } from "@/lib/coinholder/derive";
import { Stat } from "../stat";
import { Payouts, price } from "./payouts";
import styles from "../coinholders.module.css";
import { pageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: `The fund · ${PROGRAM.officialName} · OpenZcash`,
  description:
    "The Coinholder-Controlled Fund under ZIP 1016: its story, live balance, what has been paid out by round and how a grant is paid.",
  path: "/coinholders/fund",
  card: { title: "The fund" },
});

const usd = (value: number, compact = false) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    ...(compact
      ? { notation: "compact" as const, maximumFractionDigits: 2 }
      : { maximumFractionDigits: 0 }),
  });
/** Keeps a short phrase on one line when a sub-line wraps in a narrow cell. */
const nb = (s: string) => s.replace(/ /g, "\u00a0");
const day = (d: Date) =>
  d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

export default async function FundPage() {
  const [lock, quote] = await Promise.all([
    currentLockboxZec(),
    currentZecUsdQuote(),
  ]);
  // Without a snapshot there is no balance or height to show: those cells say so instead of showing zeros.
  const live = lock !== null;
  const balanceZec = lock ? Number(lock.zat) / 1e8 : 0;
  const height = lock?.height ?? NU6_1_HEIGHT;
  const priceUsd = quote
    ? quote.cents / 100
    : lock?.snap?.zecusdPriceCents
      ? Number(lock.snap.zecusdPriceCents) / 100
      : null;
  const payouts = payoutSummary(PAYOUTS, ROUNDS);
  const pending = payouts.pending;
  const q3Payout = payouts.rows.find((r) => r.roundId === "q3-2026");
  const pendingGrants = pending
    ? (summarize(ROUNDS.find((r) => r.id === pending.roundId)!).counts.funded ??
      null)
    : null;
  const o = fundOutlook({
    balanceZec,
    height,
    priceUsd,
    approvedUsd: (pending?.usdCents ?? 0) / 100,
    now: new Date(),
  });
  const covered = live ? o.approvedShareOfBalance : null;
  const leftAfter = live ? o.balanceAfterApprovedZec : null;

  const story = [
    {
      when: "Nov 2024",
      what: "NU6",
      text: "The lockbox starts: 12% of every block reward is set aside under ZIP 1015, with no way to spend it yet.",
    },
    {
      when: "Sep 2025",
      what: "Ratification",
      text: "Coinholders approve a grants program for finished work, with partial funding when the fund runs short.",
    },
    {
      when: "Nov 2025",
      what: "NU6.1",
      text: `ZIP 1016 turns the lockbox into the Coinholder-Controlled Fund: about ${formatZec(o.seedZec)} ZEC move to the key-holders' multisig, and the 12% keeps flowing in.`,
    },
    {
      when: "Nov 2025",
      what: "First vote",
      text: "Coinholders approve five grants; the key-holders later veto one.",
    },
    {
      when: "Feb 2026",
      what: "First payouts",
      text: "The key-holders pay the approved grants in ZEC from the multisig.",
    },
    {
      when: "Jun 2026",
      what: "Pause",
      text: "The Q2 vote is postponed after an Orchard vulnerability; its proposals move to Q3.",
    },
    {
      when: "Sep 2026",
      what: "Q3 approvals",
      text: "Coinholders approve 17 grants, $8.39 million of finished work: the largest round so far.",
    },
    ...(q3Payout
      ? [
          {
            when: "Oct 2026",
            what: "Q3 payouts",
            text: `The key-holders pay ${q3Payout.grants !== null ? `all ${q3Payout.grants} grants` : "the grants"} in one day: ${formatPaidZec(q3Payout.zec)} ZEC at ${price(q3Payout.zecUsd)} per ZEC, through the shielded pool.`,
          },
        ]
      : []),
    {
      when: live
        ? `≈ ${o.halvingEta.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}`
        : `Block ${THIRD_HALVING_HEIGHT.toLocaleString("en-US")}`,
      what: "Third halving",
      text: "The 12% stream ends. Whatever is left stays in the fund for later votes, or at rest.",
    },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>The fund</h1>
        <p className={styles.lede}>
          The Coinholder-Controlled Fund of ZIP 1016: what coinholders grant
          from, held by the key-holders and spent only on grants coinholders
          approve.
        </p>
      </header>

      <div className={styles.stats}>
        <Stat
          label="Balance"
          value={live ? formatZec(balanceZec) : "·"}
          unit={live ? "ZEC" : undefined}
          sub={live ? `block ${height.toLocaleString("en-US")}` : "unavailable"}
        />
        <Stat
          label="Value"
          value={live && o.balanceUsd !== null ? usd(o.balanceUsd, true) : "·"}
          sub={
            !live || priceUsd === null
              ? "unavailable"
              : quote
                ? `${usd(quote.cents / 100)} per ZEC · ${quote.source}`
                : "at the sheet's price"
          }
        />
        <Stat
          label="Inflow per 30 days"
          value={formatZec(o.perMonthZec)}
          unit="ZEC"
          sub={`${o.perBlockZec} ZEC every block`}
        />
        <Stat
          label="Still to come"
          value={live ? formatZec(o.streamLeftZec) : "·"}
          unit={live ? "ZEC" : undefined}
          sub={
            live
              ? `until the third halving · ${nb(`${formatPct(o.streamDoneShare)} received`)}`
              : "unavailable"
          }
        />
      </div>

      {pending ? (
        <section className={styles.panel} aria-labelledby="commitments">
          <div className={styles.panelHead}>
            <h2 id="commitments" className={styles.panelTitle}>
              Approved in {pending.round}, awaiting payment
            </h2>
          </div>
          <div className={`${styles.stats} ${styles.flush}`}>
            <Stat
              label="In USD"
              value={usd(pending.usdCents / 100)}
              sub={
                pendingGrants !== null
                  ? `${pendingGrants} ${pendingGrants === 1 ? "grant" : "grants"}`
                  : undefined
              }
            />
            <Stat
              label="In ZEC today"
              value={
                o.approvedZec !== null ? `≈ ${formatZec(o.approvedZec)}` : "·"
              }
              unit={o.approvedZec !== null ? "ZEC" : undefined}
              sub={o.approvedZec !== null ? undefined : "price unavailable"}
            />
            <Stat
              label="Share of the balance"
              value={covered !== null ? formatPct(covered) : "·"}
              sub={
                covered !== null ? "at today's price" : "balance unavailable"
              }
            />
            <Stat
              label="Left after paying them"
              value={
                leftAfter !== null ? formatZec(Math.max(0, leftAfter)) : "·"
              }
              unit={leftAfter !== null ? "ZEC" : undefined}
              sub={
                leftAfter !== null ? "before new inflow" : "balance unavailable"
              }
            />
          </div>
          <div className={styles.panelBody}>
            {covered !== null ? (
              <>
                <div
                  className={styles.coverTrack}
                  role="img"
                  aria-label={`Approved grants take ${formatPct(Math.min(covered, 1))} of the balance`}
                >
                  <span
                    className={styles.coverFill}
                    style={{ width: `${Math.min(covered, 1) * 100}%` }}
                  />
                </div>
                <p className={styles.coverLegend}>
                  <span>
                    <span
                      className={`${styles.swatch} ${styles.o_funded}`}
                      aria-hidden
                    />
                    Approved grants
                  </span>
                  <span>
                    <span
                      className={`${styles.swatch} ${styles.coverRest}`}
                      aria-hidden
                    />
                    Rest of the balance
                  </span>
                </p>
              </>
            ) : null}
            <p className={styles.panelNote}>
              Grants are set in USD and paid in ZEC on the day, so their ZEC
              cost moves with the price.
            </p>
          </div>
        </section>
      ) : null}

      <Payouts
        summary={payouts}
        sheetUrl={COINHOLDER_SHEET_URL}
        multisigUrl={FUND_MULTISIG.explorer}
      />

      <h2 className={styles.sectionTitle}>The story of the fund</h2>
      <ol className={styles.story}>
        {story.map((s) => (
          <li key={s.what}>
            <span className={styles.storyWhen}>{s.when}</span>
            <div>
              <h3>{s.what}</h3>
              <p>{s.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <h2 className={styles.sectionTitle}>Where the money comes from</h2>
      <ol className={styles.flow}>
        <li>
          <span className={styles.flowStep}>Seed</span>
          <strong>The ZIP 1015 lockbox</strong>
          <span>
            12% of every block from NU6 to NU6.1, moved in at block{" "}
            {NU6_1_HEIGHT.toLocaleString("en-US")}.
          </span>
        </li>
        <li>
          <span className={styles.flowStep}>Stream</span>
          <strong>12% of each block</strong>
          <span>
            {o.perBlockZec} ZEC until block{" "}
            {THIRD_HALVING_HEIGHT.toLocaleString("en-US")}.
          </span>
        </li>
        <li>
          <span className={styles.flowStep}>Custody</span>
          <strong>2-of-3 multisig</strong>
          <span>
            Held by the key-holders, bound to ZIP 1016. It may be left at rest.
          </span>
        </li>
        <li>
          <span className={styles.flowStep}>Out</span>
          <strong>Approved grants</strong>
          <span>
            Paid in ZEC by the key-holders; FPF runs applications and reporting.
          </span>
        </li>
      </ol>

      <h2 className={styles.sectionTitle}>How money leaves the fund</h2>
      <ol className={styles.steps}>
        {DISBURSEMENT_STEPS.map((s, i) => (
          <li key={s.title}>
            <span className={styles.stepNum} aria-hidden>
              {i + 1}
            </span>
            <div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className={styles.sources}>
        <a href={ZIP_1016_PROCESS} target="_blank" rel="noreferrer">
          ZIP 1016 ↗
        </a>
        <a href="https://zips.z.cash/zip-0271" target="_blank" rel="noreferrer">
          ZIP 271 ↗
        </a>
        <a href={COINHOLDER_SHEET_URL} target="_blank" rel="noreferrer">
          Coinholder sheet ↗
        </a>
        <a href={FUND_MULTISIG.explorer} target="_blank" rel="noreferrer">
          Multisig ↗
        </a>
        <span>
          Balance: the Coinholder sheet
          {lock?.snap?.capturedAt
            ? ` of ${day(new Date(lock.snap.capturedAt))}`
            : ""}{" "}
          plus 0.1875 ZEC a block since.
        </span>
        <Link href="/lockbox">Live lockbox feed →</Link>
      </p>
    </div>
  );
}
