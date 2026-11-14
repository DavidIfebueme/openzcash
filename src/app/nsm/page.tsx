import Link from "next/link";
import { Fragment } from "react";
import { NsmLiveFeed } from "@/components/nsm-live-feed";
import { Badge, Card, PageHeader } from "@/components/ui";
import {
  HEIGHTS,
  PRE_NU7_THIRD_HALVING,
  ZAT_PER_ZEC,
  targetSecondsBetween,
} from "@/lib/funding/consensus";
import { NSM } from "@/lib/funding/nsm";
import { getNsmSnapshot } from "@/lib/network/nsm";
import { currentZecUsdCents } from "@/lib/pricing/live-price";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { blockRewardsAt } from "@/lib/zcash/lockbox";

const REISSUANCE_BLOCK = NSM.reissuanceHeight.toLocaleString("en-US");

export const metadata = pageMetadata({
  title: "NSM · sustainability balance · OpenZcash",
  description: `The ZEC that Zcash consensus holds out of circulation since NU7: 60% of every block's transaction fees, reissued through block subsidies from block ${REISSUANCE_BLOCK}.`,
  path: "/nsm",
  card: { title: "NSM" },
});
export const dynamic = "force-dynamic";

const zip = (n: number) => `https://zips.z.cash/zip-${String(n).padStart(4, "0")}`;
const block = (h: number) => h.toLocaleString("en-US");
/** Per-block amounts as consensus pays them: eight decimals, no rounding. */
const zec = (value: number) =>
  value.toLocaleString("en-US", { maximumFractionDigits: 8 });
const perDay = (value: number) =>
  `≈ ${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
/** A few ZEC a day: two decimals. */
const small = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const monthYear = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const LINK =
  "text-amber-700 underline decoration-amber-500/40 underline-offset-2 hover:text-amber-800";

function ZipLink({ n }: { n: number }) {
  return (
    <a href={zip(n)} target="_blank" rel="noreferrer" className={LINK}>
      ZIP {n} ↗
    </a>
  );
}

/** One line of the before/after table; `child` rows are parts of the row above. */
type SplitRow = {
  what: string;
  before: string;
  since: string;
  day: string;
  child?: boolean;
  /** The row this page is about. */
  nsm?: boolean;
};

/** One fact of the schedule: what it was, what it is, and a note. */
type ScheduleRow = { what: string; value: string; notes?: string[] };

/** A figure cell: right-aligned, smaller on a phone so four columns fit. */
const NUM = "py-2 pl-2 text-right align-top text-xs tnum sm:pl-3 sm:text-sm";
const LABEL = "py-2 pr-2 align-top text-xs sm:pr-3 sm:text-sm";

/** Keeps a figure on one line; the theme lets table cells wrap anywhere. */
function Figure({ children }: { children: string }) {
  return <span className="whitespace-nowrap">{children}</span>;
}

export default async function NsmPage() {
  const [snapshot, priceCents] = await Promise.all([
    getNsmSnapshot().catch(() => null),
    currentZecUsdCents().catch(() => null),
  ]);

  const before = blockRewardsAt(HEIGHTS.nu7 - 1);
  const since = blockRewardsAt(HEIGHTS.nu7);
  const day = (zecPerBlock: number) => perDay(zecPerBlock * since.blocksPerDay);
  // Observed, not scheduled: the average since NU7. Unknown when the feed is down.
  const nsmPerDayZec = snapshot ? snapshot.averagePerDayZat / ZAT_PER_ZEC : null;
  const feeDay = (share: number) =>
    nsmPerDayZec === null ? "·" : `≈ ${small((nsmPerDayZec * share) / 60)}`;
  // Dated from the node's latest block; without it the heights stand alone.
  const eta = (height: number) =>
    snapshot
      ? `≈ ${monthYear(
          new Date(
            Date.parse(snapshot.observedAt) +
              targetSecondsBetween(snapshot.height, height) * 1_000,
          ),
        )}`
      : null;

  const split: SplitRow[] = [
    {
      what: "Block subsidy",
      before: zec(before.subsidyZec),
      since: zec(since.subsidyZec),
      day: day(since.subsidyZec),
    },
    {
      what: "ZCG · 8%",
      before: zec(before.zcgZec),
      since: zec(since.zcgZec),
      day: day(since.zcgZec),
      child: true,
    },
    {
      what: "Lockbox · 12%",
      before: zec(before.lockboxZec),
      since: zec(since.lockboxZec),
      day: day(since.lockboxZec),
      child: true,
    },
    {
      what: "Miner · 80%",
      before: zec(before.minerZec),
      since: zec(since.minerZec),
      day: day(since.minerZec),
      child: true,
    },
    { what: "Transaction fees", before: "varies", since: "varies", day: feeDay(100) },
    { what: "Miner", before: "100%", since: "40%", day: feeDay(40), child: true },
    {
      what: "NSM",
      before: "0%",
      since: "60%",
      day: feeDay(60),
      child: true,
      nsm: true,
    },
  ];

  const schedule: ScheduleRow[] = [
    {
      what: "Block time",
      value: `${before.targetSpacingSeconds} s → ${since.targetSpacingSeconds} s`,
    },
    {
      what: "Blocks a day",
      value: `${block(before.blocksPerDay)} → ${block(since.blocksPerDay)}`,
    },
    {
      what: "ZCG and Lockbox end",
      value: `block ${block(HEIGHTS.thirdHalving)}`,
      notes: [eta(HEIGHTS.thirdHalving), `was ${block(PRE_NU7_THIRD_HALVING)}`].filter(
        (note): note is string => note !== null,
      ),
    },
    {
      what: "NSM reissuance",
      value: `block ${REISSUANCE_BLOCK}`,
      notes: [eta(NSM.reissuanceHeight), "to miners"].filter(
        (note): note is string => note !== null,
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="NSM · sustainability balance"
        subtitle="The Network Sustainability Mechanism takes ZEC out of circulation and returns it later through block subsidies. Since NU7, 60% of every block's transaction fees goes in. The balance is kept by consensus and followed here block by block."
      />

      <NsmLiveFeed
        initial={snapshot}
        zecUsd={priceCents !== null ? priceCents / 100 : null}
      />

      <h2 className="mb-3 mt-8 text-sm font-semibold text-stone-700">
        How it works
      </h2>
      <div className="mb-3 grid gap-4 sm:grid-cols-3">
        <Card className="h-full">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-stone-900">
              In · 60% of the fees
            </p>
            <Badge tone="emerald">Since NU7</Badge>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-stone-600">
            Each block removes 6/10 of its transaction fees from circulation,
            rounded down. The miner keeps the rest. Active from block{" "}
            {block(NSM.activationHeight)}, mined November 6, 2026.
          </p>
          <p className="mt-3 text-xs">
            <ZipLink n={235} />
          </p>
        </Card>
        <Card className="h-full">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-stone-900">
              Held · by consensus
            </p>
            <Badge tone="zinc">Consensus state</Badge>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-stone-600">
            Nodes track the amount as part of consensus and leave it out of
            issued supply. It started at{" "}
            {zec(NSM.initialBalanceZat / ZAT_PER_ZEC)} ZEC, the subsidy and fees
            that coinbase transactions left unclaimed before NU6.
          </p>
          <p className="mt-3 text-xs">
            <ZipLink n={237} />
          </p>
        </Card>
        <Card className="h-full">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-stone-900">
              Out · through the subsidy
            </p>
            <Badge tone="zinc">Block {REISSUANCE_BLOCK}</Badge>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-stone-600">
            From that block on, every block adds 1375 / 10¹⁰ of the balance to
            its scheduled subsidy, rounded up: about half the balance each
            halving period.
            {snapshot
              ? ` At today's balance that would be ${zec(snapshot.reissuance.perBlockAtBalanceZat / ZAT_PER_ZEC)} ZEC a block.`
              : ""}
          </p>
          <p className="mt-3 text-xs">
            <ZipLink n={237} /> · <ZipLink n={259} />
          </p>
        </Card>
      </div>
      <p className="mb-8 text-xs leading-relaxed text-stone-600">
        Not deployed: <ZipLink n={233} />, a transaction field for voluntary
        removals, is a draft and was left out of NU7. <ZipLink n={234} />,
        issuance smoothing, was replaced by ZIP 237, which keeps the halvings.
      </p>

      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold text-stone-700">
          Each block, before and after NU7
        </h2>
        <p className="text-xs text-stone-600">
          Same shares, a third per block, three times as often
        </p>
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="py-1.5 pr-2 font-medium sm:pr-3">
                  ZEC per block
                </th>
                <th className={`${NUM} font-medium`}>Before NU7</th>
                <th className={`${NUM} font-medium`}>Since NU7</th>
                <th className={`${NUM} font-medium`}>
                  <Figure>Per day</Figure>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {split.map((row) => (
                <tr key={`${row.what}-${row.since}`}>
                  <td
                    className={
                      row.child
                        ? `${LABEL} pl-3 sm:pl-4 ${row.nsm ? "font-medium text-amber-700" : "text-stone-600"}`
                        : `${LABEL} font-medium text-stone-900`
                    }
                  >
                    {row.what}
                  </td>
                  <td className={`${NUM} text-stone-600`}>
                    <Figure>{row.before}</Figure>
                  </td>
                  <td
                    className={`${NUM} ${row.nsm ? "font-medium text-amber-700" : "text-stone-900"}`}
                  >
                    <Figure>{row.since}</Figure>
                  </td>
                  <td className={`${NUM} text-stone-600`}>
                    <Figure>{row.day}</Figure>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <p className="text-[11px] font-medium uppercase tracking-wider text-stone-600">
            Schedule
          </p>
          <dl className="mt-1 divide-y divide-stone-100">
            {schedule.map((row) => (
              <div
                key={row.what}
                className="flex items-baseline justify-between gap-4 py-2.5"
              >
                <dt className="text-sm text-stone-600">{row.what}</dt>
                <dd className="text-right">
                  <span className="block text-sm font-medium text-stone-900 tnum">
                    {row.value}
                  </span>
                  {row.notes ? (
                    <span className="block text-xs text-stone-600 tnum">
                      {row.notes.map((note, index) => (
                        <Fragment key={note}>
                          {index > 0 ? " · " : null}
                          <span className="whitespace-nowrap">{note}</span>
                        </Fragment>
                      ))}
                    </span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <p className="text-xs leading-relaxed text-stone-600">
        Source:{" "}
        {snapshot ? (
          <a
            href={snapshot.source.url}
            target="_blank"
            rel="noreferrer"
            className={LINK}
          >
            {snapshot.source.name} ↗
          </a>
        ) : (
          "public node feed"
        )}{" "}
        · <ZipLink n={218} /> ·{" "}
        <a href={zip(214)} target="_blank" rel="noreferrer" className={LINK}>
          ZIP 214 ↗
        </a>{" "}
        ·{" "}
        <Link href="/lockbox" className={LINK}>
          Lockbox
        </Link>{" "}
        ·{" "}
        <Link href="/funding-history" className={LINK}>
          Funding history
        </Link>{" "}
        · No viewing keys
      </p>
    </>
  );
}
