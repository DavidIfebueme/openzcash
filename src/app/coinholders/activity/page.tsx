import Link from "next/link";
import { ACTIVE_CYCLE, cycleHref, roundParam } from "@/lib/coinholder/cycles";
import { CycleTab, PendingCycle } from "../cycle-view";
import { RoundTabsNav } from "../round-tabs";
import styles from "../coinholders.module.css";
import { PROGRAM } from "@/lib/coinholder/program";
import { readCoinholderDashboard } from "@/lib/coinholder/analytics/server";
import { CoinholderDashboardView } from "@/components/coinholder-analytics/dashboard";
import { pageMetadata } from "@/lib/seo/page-metadata";
import "../analytics.css";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: `Voting activity · ${PROGRAM.officialName} · OpenZcash`,
  description: "Follow the current Coinholder round and explore recorded casts, revealed shares and final ZEC weights from previous rounds.",
  path: "/coinholders/activity",
  card: { title: "Coinholder Grants" },
});

// Activity archives only exist for Q3; other historical rounds remain in Results and Verify.
const ARCHIVED_ROUND = { id: "q3-2026", label: "Q3 2026" };

export default async function CoinholderActivityPage({ searchParams }: {
  searchParams: Promise<{ round?: string | string[] }>;
}) {
  const id = roundParam((await searchParams).round);
  const archived = id === ARCHIVED_ROUND.id;
  const current = archived ? ARCHIVED_ROUND.id : ACTIVE_CYCLE.id;
  const navigation = <RoundTabsNav current={current}>
      <CycleTab view="activity" current={current} />
      <Link href={cycleHref("activity", ARCHIVED_ROUND.id)} scroll={false} className={styles.tab} aria-current={archived ? "page" : undefined}>{ARCHIVED_ROUND.label}</Link>
    </RoundTabsNav>;
  return <div className={styles.page}>
    <header className={styles.head}><h1 className={styles.title}>Voting activity</h1></header>
    {archived
      ? <CoinholderDashboardView initial={await readCoinholderDashboard()} embedded navigation={navigation} />
      : <>{navigation}<PendingCycle view="activity" /></>}
  </div>;
}
