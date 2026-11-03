import Link from "next/link";
import { nodeValuePools } from "@/lib/funding/node-check";
import { formatZecCompact } from "@/lib/zcash/units";
import {
  CORRECTIONS,
  GENESIS,
  TENTH_ANNIVERSARY,
  TIMELINE,
  genesisAge,
} from "@/lib/ceremony/story";
import { Pager, PartHeader, partEyebrow } from "../part-chrome";
import styles from "../ceremony.module.css";
import { pageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Ten years · Zcash Ceremony · OpenZcash",
  description:
    "Ten years of Zcash since the genesis block of October 28, 2016: every generation of shielded pools, the end of the trusted setup, the halvings, and the claims that keep circulating.",
  path: "/ceremony/ten-years",
});

export default async function TenYearsPage() {
  const now = new Date();
  const age = genesisAge(now);
  const dateLabel = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });
  const node = await nodeValuePools().catch(() => null);
  const ironwood = node?.pools.ironwood;
  const orchard = node?.pools.orchard;

  return (
    <div className={styles.page}>
      <PartHeader
        eyebrow={partEyebrow("ten-years", "2016 to 2026")}
        title="Ten years"
      >
        From the genesis block to NU5, which ended the need for any ceremony,
        through two halvings and an emergency, to the tenth anniversary.
        Upgrades and votes follow the ZIPs and this site&apos;s own records.
      </PartHeader>

      <div className={`${styles.card} ${styles.stats}`}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Since the genesis block</span>
          <span className={styles.statValue}>
            {age.years} {age.years === 1 ? "year" : "years"} and {age.days} {age.days === 1 ? "day" : "days"}
          </span>
          <span className={styles.note}><time dateTime={GENESIS}>{dateLabel(GENESIS)}</time></span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Tenth anniversary</span>
          <time className={styles.statValue} dateTime={TENTH_ANNIVERSARY}>{dateLabel(TENTH_ANNIVERSARY)}</time>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>In Ironwood now</span>
          <span className={styles.statValue}>
            {ironwood !== undefined ? formatZecCompact(BigInt(ironwood)) : "·"}
          </span>
          <span className={styles.note}>
            {orchard !== undefined && node
              ? `${formatZecCompact(BigInt(orchard))} still in Orchard · block ${node.height.toLocaleString("en-US")}`
              : "Node unavailable"}
          </span>
        </div>
      </div>

      <div>
        {TIMELINE.map((y) => (
          <section
            key={y.year}
            className={styles.year}
            aria-labelledby={`y${y.year}`}
          >
            <div className={styles.yearNum}>{y.year}</div>
            <div>
              <h2 id={`y${y.year}`} className={styles.yearTitle}>
                {y.title}
              </h2>
              <ul className={styles.items}>
                {y.items.map((i) => (
                  <li key={i.label}>
                    <strong>{i.label}</strong>
                    {i.text}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>
      <p className={styles.note}>
        Every activation height and how it was decided is on{" "}
        <Link className={styles.link} href="/governance">
          Zcash governance
        </Link>
        ; every ZEC paid outside mining on{" "}
        <Link className={styles.link} href="/funding-history">
          Zcash&apos;s Since block zero
        </Link>
        .
      </p>

      <section className={styles.section} aria-labelledby="misstated">
        <h2 id="misstated" className={styles.h2}>
          Often misstated
        </h2>
        <div className={`${styles.card} ${styles.rows}`}>
          {CORRECTIONS.map((c) => (
            <div key={c.claim} className={styles.correction}>
              <span className={styles.claimStruck}>{c.claim}</span>
              <span className={styles.muted}>{c.fact}</span>
            </div>
          ))}
        </div>
      </section>

      <Pager slug="ten-years" />
    </div>
  );
}
