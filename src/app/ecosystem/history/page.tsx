import Link from "next/link";
import { CommunityCredit } from "@/components/community-credit";
import { RepositoryFreshness } from "@/components/project-history/freshness";
import { HistoryDirectory } from "@/components/project-history/directory";
import { historyBrand } from "@/components/project-history/branding";
import { readHistoryIndex, projectHistoryDirectory } from "@/lib/project-history/data";
import { displayDate } from "@/lib/ecosystem/catalog";
import styles from "@/components/project-history/history.module.css";

export const metadata = { title: "Project histories · OpenZcash", description: "Follow funding, milestones, published work and evidence gaps across Zcash projects and communities." };
export const dynamic = "force-dynamic";
export default async function HistoryPage() {
  const index = await readHistoryIndex();
  const brands = Object.fromEntries(projectHistoryDirectory().map(item => [item.id, historyBrand(item)]));
  return <div className={`${styles.page} ${styles.directoryPage}`}>
    <header className={styles.hero}>
      <div><div className={styles.eyebrow}>Ecosystem / evidence over time</div>
        <h1>Project histories</h1>
        <p>Explore the teams, tools and communities building Zcash. Follow their funding and published work.</p>
      </div>
      <div className={styles.actions}><Link className={styles.action} href="/zcg/grants">Grant ledger →</Link></div>
    </header>
    <div className={styles.freshness}><span>Repository snapshot <b>{displayDate(index.repositorySnapshotAt)}</b></span><span>Latest ledger import <b>{index.ledgerImportedAt ? displayDate(index.ledgerImportedAt) : "unavailable"}</b></span><a href="#reading-history">How to read this →</a></div>
    <RepositoryFreshness snapshotAt={index.repositorySnapshotAt} asOf={new Date().toISOString()} />
    {(!index.coverage.proposalsAvailable || !index.coverage.paymentsAvailable) && <p className={styles.notice} role="status">Financial coverage is incomplete. Unavailable payments appear as “—”; dated grant references remain visible.</p>}
    <HistoryDirectory items={index.items} brands={brands} paymentsAvailable={index.coverage.paymentsAvailable} />
    <section id="reading-history" className={styles.reading} aria-labelledby="reading-title">
      <h2 id="reading-title">How to read this</h2>
      <div><div><h3>Linked records, distinct claims</h3><p>A grant, a payment and a release answer different questions. Open a history to inspect the records and their sources.</p></div>
        <div><h3>Coverage is not a score</h3><p>Missing evidence does not establish inactivity, non-delivery or low adoption. Counts describe what is linked here.</p></div>
        <div><h3>Shared grants can overlap</h3><p>An award can support several projects. Funding is shown in each grant’s context and is not summed across this directory.</p></div></div>
    </section>
    <CommunityCredit screen="project-history" />
  </div>;
}
