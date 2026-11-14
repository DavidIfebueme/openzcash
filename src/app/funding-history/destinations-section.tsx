import Link from "next/link";
import type { ReactNode } from "react";
import { Mono } from "@/components/ui";
import { SectionHeading } from "@/components/workspace";
import { formatZec } from "@/lib/zcash/units";
import {
  HEIGHTS,
  LOCKBOX_DISBURSEMENT,
  ZAT_PER_ZEC,
  type StreamId,
} from "@/lib/funding/consensus";
import {
  COINHOLDER_FUND,
  DEV_FUND_2020_SOURCES,
  FOUNDERS_SOURCES,
  FOUNDERS_SPLIT_2016,
  KEYHOLDER_DRAFT,
  MAX_SUPPLY_ZEC,
  NU7_FUNDING_RULES,
  OPEN_QUESTIONS,
} from "@/lib/funding/destinations";
import {
  ERAS,
  type EraId,
  type Link as SourceLink,
} from "@/lib/funding/streams";
import styles from "./destinations.module.css";

/**
 * "Where each slice went": one panel per era. The left column names the era
 * and its total; the right column splits it by recipient, follows a slice
 * further where the chain shows it (the lockbox), and ends with short facts,
 * open questions and sources.
 */

type Tint = 1 | 2 | 3 | 4;

type Part = {
  label: string;
  zat: number | null;
  depth: 1 | 2;
  live?: boolean;
  note?: ReactNode;
};

type Slice = {
  label: string;
  share: string;
  zat: number;
  tint: Tint;
  note?: ReactNode;
  parts?: Part[];
};

type Fact = { label: string; text: ReactNode };

type Era = {
  id: EraId;
  totalZat: number;
  caption: string;
  slices: Slice[];
  facts: Fact[];
  sources: SourceLink[];
};

const TINT = { 1: styles.t1, 2: styles.t2, 3: styles.t3, 4: styles.t4 };

const zec = (zat: number) => formatZec(BigInt(Math.round(zat)));
const monthYear = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const sentence = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
const andList = (items: string[]) =>
  items.join(", ").replace(/, ([^,]*)$/, " and $1");

function foundersEra(totalZat: number): Era {
  return {
    id: "founders",
    totalZat,
    caption: "Planned split, September 2016 · shares of the 21M supply",
    slices: FOUNDERS_SPLIT_2016.map((r, i) => ({
      label: r.recipient,
      share: `${r.pctOfSupply.toFixed(2)}%`,
      zat: (r.pctOfSupply / 100) * MAX_SUPPLY_ZEC * ZAT_PER_ZEC,
      tint: (i + 1) as Tint,
      note: [sentence(r.schedule), r.detail].filter(Boolean).join(" "),
    })),
    facts: [
      {
        label: "Changes",
        text: "From June 2019 the holders agreed to dilute the split in favour of ECC. Individual payouts are private by design.",
      },
      { label: "Still open", text: OPEN_QUESTIONS.founders },
    ],
    sources: FOUNDERS_SOURCES,
  };
}

function devFundEra(z: Record<StreamId, number>): Era {
  return {
    id: "devfund2020",
    totalZat: z.devFundEcc + z.devFundZf + z.devFundMajorGrants,
    caption: "Consensus split, ZIP 214 · shares of the block subsidy",
    slices: [
      {
        label: "Bootstrap (ECC)",
        share: "7%",
        zat: z.devFundEcc,
        tint: 1,
        note: "ECC's operating budget, in quarterly transparency reports that ended with Q4 2024.",
      },
      {
        label: "Zcash Foundation",
        share: "5%",
        zat: z.devFundZf,
        tint: 2,
        note: "Operations and grants, in quarterly reports, audits and Form 990s.",
      },
      {
        label: "Major Grants",
        share: "8%",
        zat: z.devFundMajorGrants,
        tint: 3,
        note: (
          <>
            Held by the Foundation and granted by ZOMG, renamed Zcash Community
            Grants in February 2022. Custody moved to the Financial Privacy
            Foundation at NU6. Every grant is in the{" "}
            <Link href="/zcg/totals">ZCG ledger →</Link>
          </>
        ),
      },
    ],
    facts: [{ label: "Still open", text: OPEN_QUESTIONS.devfund2020 }],
    sources: DEV_FUND_2020_SOURCES,
  };
}

function nu6Era(
  z: Record<StreamId, number>,
  throughHeight: number,
  multisigZat: number | null,
  lockboxNowZat: number | null,
): Era {
  const paidOut =
    multisigZat !== null ? LOCKBOX_DISBURSEMENT.zat - multisigZat : null;
  return {
    id: "nu6",
    totalZat: z.zcg + z.lockbox,
    caption: `Consensus split, ZIPs 1015 and 1016 · shares of the block subsidy · through block ${throughHeight.toLocaleString("en-US")}`,
    slices: [
      {
        label: "Zcash Community Grants",
        share: "8%",
        zat: z.zcg,
        tint: 1,
        note: (
          <>
            Paid to the Financial Privacy Foundation for Zcash Community Grants.
            Every grant is in the <Link href="/zcg/totals">ZCG ledger →</Link>
          </>
        ),
      },
      {
        label: "Lockbox",
        share: "12%",
        zat: z.lockbox,
        tint: 2,
        parts: [
          {
            label: "Disbursed at NU6.1",
            zat: LOCKBOX_DISBURSEMENT.zat,
            depth: 1,
            note: (
              <>
                Ten outputs of{" "}
                {zec(LOCKBOX_DISBURSEMENT.zat / LOCKBOX_DISBURSEMENT.outputs)}{" "}
                in block {HEIGHTS.nu61.toLocaleString("en-US")} to the
                coinholder fund <Mono value={COINHOLDER_FUND.address} />, a
                2-of-3 multisig.
              </>
            ),
          },
          { label: "Paid out to grants", zat: paidOut, depth: 2, live: true },
          {
            label: "Still in the fund",
            zat: multisigZat,
            depth: 2,
            live: true,
          },
          {
            label: "Accruing since NU6.1",
            zat: lockboxNowZat,
            depth: 1,
            live: true,
            note: "Inside the protocol, earmarked for the same fund. No withdrawal mechanism is deployed yet.",
          },
        ],
      },
    ],
    facts: [
      {
        label: "Keys",
        text: `ZIP 271 gives the fund's three keys to the ${andList(COINHOLDER_FUND.keyHolders)}. The Bootstrap board renounced ECC's role in February 2026; a draft ZIP would pass it to ZODL.`,
      },
      {
        label: "Grants",
        text: "Coinholders vote on each grant and the key-holders sign the payouts. The Foundation and Shielded Labs vetoed the Q4 2025 grant to Bootstrap (ECC).",
      },
      {
        label: "NU7",
        text: "Since November 2026 blocks are 25 seconds apart. The 8% and 12% streams continue, a third per block, to the third halving at block 6,132,390.",
      },
      { label: "Still open", text: OPEN_QUESTIONS.nu6 },
    ],
    sources: [
      ...COINHOLDER_FUND.sources,
      KEYHOLDER_DRAFT,
      NU7_FUNDING_RULES,
    ],
  };
}

function SourceAnchor({ link }: { link: SourceLink }) {
  return link.href.startsWith("/") ? (
    <Link href={link.href}>{link.label} →</Link>
  ) : (
    <a href={link.href} target="_blank" rel="noreferrer">
      {link.label} ↗
    </a>
  );
}

function SplitBar({ slices }: { slices: Slice[] }) {
  const sum = slices.reduce((s, x) => s + x.zat, 0);
  const share = (zat: number) => (sum > 0 ? zat / sum : 0);
  return (
    <div
      className={styles.split}
      role="img"
      aria-label={slices
        .map((s) => `${s.label} ${(share(s.zat) * 100).toFixed(1)}%`)
        .join(", ")}
    >
      {slices.map((s) => (
        <span
          key={s.label}
          className={TINT[s.tint]}
          style={{ flex: `${share(s.zat)} 1 0` }}
        />
      ))}
    </div>
  );
}

function PartRow({ part }: { part: Part }) {
  return (
    <li className={styles.part} data-depth={part.depth}>
      <span className={styles.name}>
        {part.label}
        {part.live && part.zat !== null ? (
          <span className={styles.live}>live</span>
        ) : null}
      </span>
      <span className={styles.amount}>
        {part.zat !== null ? zec(part.zat) : "unavailable"}
      </span>
      {part.note ? <span className={styles.note}>{part.note}</span> : null}
    </li>
  );
}

function SliceRow({ slice }: { slice: Slice }) {
  return (
    <li className={styles.slice}>
      <span className={`${styles.swatch} ${TINT[slice.tint]}`} aria-hidden />
      <span className={styles.name}>{slice.label}</span>
      <span className={styles.share}>{slice.share}</span>
      <span className={styles.amount}>{zec(slice.zat)}</span>
      {slice.note ? <span className={styles.note}>{slice.note}</span> : null}
      {slice.parts ? (
        <ul className={styles.parts}>
          {slice.parts.map((p) => (
            <PartRow key={p.label} part={p} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function EraPanel({ era }: { era: Era }) {
  const info = ERAS[era.id];
  const titleId = `slice-${era.id}`;
  return (
    <article className={styles.era} aria-labelledby={titleId}>
      <header className={styles.head}>
        <span className={styles.period}>
          {monthYear(info.from)} to {info.to ? monthYear(info.to) : "today"}
        </span>
        <h3 id={titleId} className={styles.title}>
          {info.label}
        </h3>
        <span className={styles.total}>{zec(era.totalZat)}</span>
        <span className={styles.rule}>{info.summary}</span>
      </header>
      <div className={styles.body}>
        <p className={styles.caption}>{era.caption}</p>
        <SplitBar slices={era.slices} />
        <ul className={styles.slices}>
          {era.slices.map((s) => (
            <SliceRow key={s.label} slice={s} />
          ))}
        </ul>
        <dl className={styles.facts}>
          {era.facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.text}</dd>
            </div>
          ))}
          <div>
            <dt>Sources</dt>
            <dd className={styles.sources}>
              {era.sources.map((l) => (
                <SourceAnchor key={l.href} link={l} />
              ))}
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

export function DestinationsSection({
  streamZat,
  throughHeight,
  multisigZat,
  lockboxNowZat,
}: {
  /** ZEC allocated to each stream up to `throughHeight`, in zatoshis. */
  streamZat: Record<StreamId, number>;
  /** Last block counted in `streamZat`. */
  throughHeight: number;
  /** Live balance of the coinholder fund multisig, or null when unavailable. */
  multisigZat: number | null;
  /** Live in-protocol lockbox balance, or null when unavailable. */
  lockboxNowZat: number | null;
}) {
  const eras = [
    foundersEra(streamZat.foundersReward),
    devFundEra(streamZat),
    nu6Era(streamZat, throughHeight, multisigZat, lockboxNowZat),
  ];
  return (
    <div className={styles.section}>
      <SectionHeading
        title="Where each slice went"
        description="What happened after the coinbase, as far as primary sources state it. Open questions stay open."
      />
      <div className={styles.eras}>
        {eras.map((era) => (
          <EraPanel key={era.id} era={era} />
        ))}
      </div>
    </div>
  );
}
