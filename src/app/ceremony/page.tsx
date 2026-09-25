import Image from "next/image";
import Link from "next/link";
import { PARTS } from "@/lib/ceremony/parts";
import { DURATION_S, VIEWS, clock } from "@/lib/ceremony/recordings";
import { TENTH_ANNIVERSARY, daysUntil } from "@/lib/ceremony/story";
import { PartHeader } from "./part-chrome";
import styles from "./ceremony.module.css";

export const revalidate = 3600;
export const metadata = {
  title: "Zcash Ceremony · OpenZcash",
  description:
    "How Zcash was born: the six witnesses of the October 2016 parameter ceremony, the Denver station footage, the record they left and ten years since.",
};

export default function CeremonyOverviewPage() {
  const watch = PARTS.find((p) => p.slug === "watch")!;
  const wide = VIEWS.find((v) => v.id === "camera-3")!;
  const days = daysUntil(TENTH_ANNIVERSARY, new Date());

  return (
    <div className={styles.page}>
      <PartHeader
        eyebrow="Zcash Ceremony · October 22–23, 2016"
        title="Six witnesses, six secrets, all destroyed."
      >
        Before the genesis block, six people in separate places each generated
        one shard of Zcash&apos;s parameters and destroyed their secret. If even
        one of them was honest, nobody could counterfeit coins. Their story,
        their footage and the record they left, in five parts.
      </PartHeader>

      <Link href={watch.href} className={`${styles.card} ${styles.feature}`}>
        <span className={styles.featureMedia}>
          <Image
            src={wide.poster}
            alt="The Denver station during the ceremony, from the wide camera"
            fill
            sizes="(max-width: 900px) 100vw, 420px"
            priority
          />
          <span className={styles.playMark} aria-hidden="true">
            <span>
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              >
                <path d="M8 5.5v13l10.5-6.5z" />
              </svg>
            </span>
          </span>
        </span>
        <span className={styles.featureText}>
          <span className={styles.eyebrow}>Part {watch.numeral}</span>
          <span className={styles.featureTitle}>{watch.title}</span>
          <span className={styles.muted}>
            The Denver station as three cameras and three microphones recorded
            it, {clock(DURATION_S)} in seven parts. Switch cameras without
            losing the moment, or just listen.
          </span>
          <span className={styles.link}>Play from the start →</span>
        </span>
      </Link>

      <nav
        aria-label="The five parts"
        className={`${styles.card} ${styles.rows}`}
      >
        {PARTS.map((p) => (
          <Link key={p.slug} href={p.href} className={styles.partRow}>
            <span className={styles.numeral}>{p.numeral}</span>
            <span className={styles.partText}>
              <span className={styles.partTitle}>{p.title}</span>
              <span className={styles.muted}>{p.summary}</span>
            </span>
            <span className={styles.meta}>{p.meta}</span>
          </Link>
        ))}
      </nav>

      <div className={styles.countdown}>
        <span className={styles.countdownTitle}>
          {days > 0
            ? "Zcash turns ten on October 28, 2026"
            : "Zcash turned ten on October 28, 2026"}
        </span>
        {days > 0 ? (
          <span className={styles.countdownDays}>
            {days} {days === 1 ? "day" : "days"}
          </span>
        ) : null}
      </div>
    </div>
  );
}
