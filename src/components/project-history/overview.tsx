import { displayDate } from "@/lib/ecosystem/catalog";
import { projectInsights } from "@/lib/project-history/insights";
import type { ProjectHistory } from "@/lib/project-history/types";
import { SourceLink } from "./source-link";
import styles from "./history.module.css";

export function HistoryOverview({ history, select }: { history: ProjectHistory; select: (section: string, kind?: string) => void }) {
  const facts = projectInsights(history);
  const latest = [
    { label: "Latest public work", event: facts.latestWork, empty: "No dated work linked yet." },
    { label: "Latest payment", event: facts.latestPayment, empty: history.coverage.paymentsAvailable ? "No dated payment linked." : "Payment source unavailable." },
    { label: "Latest decision", event: facts.latestDecision, empty: history.coverage.proposalsAvailable ? "No dated decision linked." : "Proposal source unavailable." },
  ];
  return <>
    <div className={styles.sectionIntro}><div><p className={styles.eyebrow}>All linked history / at a glance</p><h2>Evidence at a glance</h2></div><p>Each card opens the records behind it.</p></div>
    <div className={styles.dimensions}>
      <button onClick={() => select("funding")} className={styles.dimension}>
        <span className={styles.dimensionLabel}>01 / Funding <span aria-hidden>→</span></span>
        <strong>{facts.paidEntries ?? "—"} <small>{facts.paidEntries === 1 ? "paid entry" : "paid entries"}</small></strong>
        <p>{facts.grants} associated grant {facts.grants === 1 ? "record" : "records"}. Requests, decisions and payments stay separate.</p>
      </button>
      <button onClick={() => select("timeline", history.project.communityId ? "report" : "release")} className={styles.dimension}>
        <span className={styles.dimensionLabel}>02 / Public work <span aria-hidden>→</span></span>
        {history.project.communityId ? <><strong>{facts.reportSources} <small>linked report {facts.reportSources === 1 ? "source" : "sources"}</small></strong><p>Reports document community work. Individual claims still need review.</p></> : <><strong>{facts.publishedArtifacts} <small>linked {facts.publishedArtifacts === 1 ? "release" : "releases"}</small></strong><p>Publication is evidenced. It does not establish funded scope completion.</p></>}
      </button>
      <button onClick={() => select("funding")} className={styles.dimension}>
        <span className={styles.dimensionLabel}>03 / Milestone acceptance <span aria-hidden>→</span></span>
        <strong>{facts.acceptedEntries ? `${facts.acceptedEntries} linked` : "Not linked"}</strong>
        <p>{facts.acceptedEntries ? "Ledger entries with source-backed acceptance. Inspect the scope of each review." : "No acceptance evidence is linked to a ledger entry. Delivery remains unassessed."}</p>
      </button>
      <button onClick={() => select("evidence")} className={styles.dimension}>
        <span className={styles.dimensionLabel}>04 / Integration & use <span aria-hidden>→</span></span>
        <strong>{facts.usageObservations ? `${facts.usageObservations} observations` : "Not assessed"}</strong>
        <p>{facts.integrations ? `${facts.integrations} documented integrations. ` : "No integration evidence linked. "}{facts.usageObservations ? "Usage is scoped to the measured period and population." : "Missing usage data does not mean low adoption."}</p>
      </button>
    </div>
    <div className={styles.overviewBody}><section className={styles.latest} aria-labelledby="latest-records"><h2 id="latest-records">Latest linked activity</h2>
      {latest.map(({ label, event, empty }) => <article className={styles.latestRow} key={label}>
        <div className={styles.latestMeta}><span>{label}</span><time dateTime={event?.date ?? undefined}>{event?.date ? displayDate(event.date) : "—"}</time></div>
        <div>{event ? <><h3>{event.title}</h3><p>{event.detail}</p><SourceLink source={event.source} /></> : <p>{empty}</p>}</div>
      </article>)}
    </section>
    {facts.checks.length > 0 && <section className={styles.checks} aria-labelledby="next-checks"><h2 id="next-checks">What to verify next</h2><p>Research gaps in this record, not judgments about the project.</p>
      {facts.checks.map((check, index) => <button key={check.title} onClick={() => select(check.section)} className={styles.check}><span className={styles.checkNumber}>{String(index + 1).padStart(2, "0")}</span><span><strong>{check.title}</strong><span>{check.detail}</span></span><span aria-hidden>→</span></button>)}
    </section>}</div>
  </>;
}
