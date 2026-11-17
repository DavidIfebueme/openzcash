import { pageMetadata } from "@/lib/seo/page-metadata";
import { readQ4 } from "@/lib/coinholder/q4-server";
import { Q4, READY_FOR_VOTE_LABEL, q4Phase, q4Summary, q4Timestamp, q4Totals, q4Usd } from "@/lib/coinholder/q4";
import { cycleAdministration } from "@/lib/coinholder/administration";
import { CycleCard, CycleIntro, CycleScene, CycleTimeline } from "../cycle-view";
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
  const administration = cycleAdministration();
  // The vote also carries program administration filed on the forum; count and total cover both.
  const ballot = proposals === null ? null : [...proposals, ...administration];
  const totals = ballot === null ? null : q4Totals(ballot);
  const amountUnspecified = totals !== null && totals.missingAmounts > 0 && totals.missingAmounts === ballot?.length;
  return (
    <div className={`${base.page} ${styles.page}`}>
      <SourceRefresh intervalMs={proposals?.some((p) => p.topicsPending) ? 30_000 : 300_000} />
      <header className={styles.head}>
        <h1 className={base.title}>Proposals</h1>
        {phase.step === 0 ? <a href={Q4.applyUrl} target="_blank" rel="noreferrer" className={styles.primary}>Submit proposal <span aria-hidden>↗</span></a> : null}
      </header>

      <CycleCard labelledBy="current-round">
        <div className={styles.roundHead}>
          <CycleIntro id="current-round" />
          <CycleScene />
          <dl className={styles.metrics}>
            <div>
              <dt>Proposals</dt>
              <dd className={proposals === null ? styles.metricFallback : undefined}>{ballot === null ? "Unavailable" : ballot.length}</dd>
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
      {administration.length ? <section className={styles.administration} aria-labelledby="program-administration">
        <h2 id="program-administration" className={styles.sectionTitle}>Program administration <span>Not a retroactive grant</span></h2>
        <ol className={styles.list}>
          {administration.map((request) => <li key={request.id}>
            <article className={styles.proposal}>
              <div className={styles.proposalContent}>
                <div className={styles.meta}><span className={styles.proposalNumber}>Forum</span></div>
                <h3><a href={request.url} target="_blank" rel="noreferrer">{request.title}</a></h3>
                <p className={styles.applicant}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="8" r="3.5" /><path d="M5 20v-1.5a7 7 0 0 1 14 0V20" /></svg>
                  <span>{request.applicant}</span>
                </p>
                <p className={styles.adminSummary}>{request.summary}</p>
                <p className={styles.disclosure}>{request.disclosure}</p>
              </div>
              <div className={styles.request}>
                <span>Requested</span>
                <strong>{q4Usd(request.requestedUsdCents)}</strong>
                <small>USD</small>
              </div>
              <a className={styles.viewProposal} href={request.url} target="_blank" rel="noreferrer">
                Read on the forum <span aria-hidden>↗</span>
                <span className="sr-only">: {request.title}</span>
              </a>
            </article>
          </li>)}
        </ol>
      </section> : null}
      <footer className={styles.provenance}>
        <details>
          <summary>Sources &amp; method</summary>
          <div className={styles.method}>
            <p>Open applications from this round carrying FPF&apos;s exact “{READY_FOR_VOTE_LABEL}” label. Requested amounts are not awards.</p>
            {administration.length ? <p>The count and total also include program administration filed on the forum, which is not a GitHub application.</p> : null}
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
