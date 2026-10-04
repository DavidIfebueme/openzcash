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
      <div>
        <h1>Project histories</h1>
        <p>Follow the funding. Inspect the work. Form your own view.</p>
      </div>
      <div className={styles.actions}><Link className={styles.action} href="/zcg/grants">Grant ledger →</Link></div>
    </header>
    <div className={styles.freshness}><span>Repositories <b>{displayDate(index.repositorySnapshotAt)}</b></span><span>Ledger <b>{index.ledgerImportedAt ? displayDate(index.ledgerImportedAt) : "unavailable"}</b></span><a href="#reading-history">Reading guide ↓</a></div>
    <RepositoryFreshness snapshotAt={index.repositorySnapshotAt} asOf={new Date().toISOString()} />
    {(!index.coverage.proposalsAvailable || !index.coverage.paymentsAvailable) && <p className={styles.notice} role="status">Financial coverage is incomplete. Unavailable payments appear as “—”; dated grant references remain visible.</p>}
    <HistoryDirectory items={index.items} brands={brands} paymentsAvailable={index.coverage.paymentsAvailable} />
    <details id="reading-history" className={styles.reading}>
      <summary>How to read these records</summary>
      <div><div><h3>Different kinds of evidence</h3><p>Funding, publications and milestone acceptance answer different questions. Shared repositories may include non-Zcash work.</p></div>
        <div><h3>Coverage, not a score</h3><p>Missing links do not establish inactivity or non-delivery. Dates show the source snapshot, not a live feed.</p></div>
        <div><h3>Shared funding</h3><p>An award can appear across several projects. Inspect its scope before comparing amounts.</p></div></div>
    </details>
    <CommunityCredit screen="project-history" />
  </div>;
}
