import { pageMetadata } from "@/lib/seo/page-metadata";
import { readQ4 } from "@/lib/coinholder/q4-server";
import { Q4, READY_FOR_VOTE_LABEL, q4Phase, q4Summary, q4Timestamp, q4Totals, q4Usd } from "@/lib/coinholder/q4";
import { CycleBrand, CycleCard, CycleTimeline } from "../cycle-view";
import { SourceRefresh } from "@/components/source-refresh";
import { Proposals } from "./proposals";
import { SourceStatus } from "./source-status";
import { RefreshProposals } from "./refresh-proposals";
import base from "../coinholders.module.css";
import styles from "./proposals.module.css";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({ title: "Proposals · Coinholder Grants · OpenZcash", description: "Coinholder grant proposals, requested funding and the current round's schedule.", path: Q4.href, card: { title: "Proposals", kicker: "Explore funding requests for the next vote.", stat: Q4.label } });

export default async function ProposalsPage() {
  const snapshot = await readQ4();
  const phase = q4Phase();
  const proposals = snapshot.proposals?.map(q4Summary) ?? null;
  const totals = proposals === null ? null : q4Totals(proposals);
  const amountUnspecified = totals !== null && totals.missingAmounts > 0 && totals.missingAmounts === proposals?.length;
  return (
    <div className={`${base.page} ${styles.page}`}>
      <SourceRefresh intervalMs={proposals?.some((p) => p.topicsPending) ? 30_000 : 300_000} />
      <header className={styles.head}>
        <h1 className={base.title}>Proposals</h1>
        {phase.step === 0 ? <a href={Q4.applyUrl} target="_blank" rel="noreferrer" className={styles.primary}>Submit proposal <span aria-hidden>↗</span></a> : null}
      </header>

      <CycleCard labelledBy="current-round">
        <div className={styles.roundHead}>
          <CycleBrand id="current-round" />
          <dl className={styles.metrics}>
            <div>
              <dt>Proposals</dt>
              <dd className={proposals === null ? styles.metricFallback : undefined}>{proposals === null ? "Unavailable" : proposals.length}</dd>
            </div>
            <div>
              <dt>{totals?.missingAmounts ? "Known requests" : "Total requested"}</dt>
              <dd className={totals === null || amountUnspecified ? styles.metricFallback : undefined}>
                {totals === null ? "Unavailable" : amountUnspecified ? "Not specified" : <>{q4Usd(totals.requestedUsdCents)}<small> USD</small></>}
              </dd>
            </div>
          </dl>
        </div>
        {totals?.missingAmounts ? <p className={styles.amountNote}>{totals.missingAmounts} proposal(s) have no specified USD amount.</p> : null}
        <CycleTimeline />
      </CycleCard>

      <section aria-label="Proposal list">
        <SourceStatus snapshot={snapshot} />
        {proposals !== null ? <Proposals proposals={proposals} /> : null}
      </section>
      <footer className={styles.provenance}>
        <details>
          <summary>Sources &amp; method</summary>
          <div className={styles.method}>
            <p>Open applications from this round carrying FPF&apos;s exact “{READY_FOR_VOTE_LABEL}” label. Requested amounts are not awards.</p>
            <p>Checks every 5 minutes. Withdrawn, decided and earlier-round applications are excluded.</p>
            <p>AI-generated tags describe the work, not funding decisions. Full applications are reanalyzed when their content changes; original categories remain in the source.</p>
            <a href={Q4.issuesUrl} target="_blank" rel="noreferrer">GitHub submissions <span aria-hidden>↗</span></a>
          </div>
        </details>
        <div className={styles.sourceCheck}>
          {snapshot.fetchedAt ? <time dateTime={snapshot.fetchedAt}>Checked {q4Timestamp(snapshot.fetchedAt)}</time> : null}
          <RefreshProposals />
        </div>
      </footer>
    </div>
  );
}
