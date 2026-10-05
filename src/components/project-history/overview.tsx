import { displayDate } from "@/lib/ecosystem/catalog";
import { projectInsights } from "@/lib/project-history/insights";
import { historyAmount } from "@/lib/project-history/format";
import type { ProjectHistory } from "@/lib/project-history/types";
import { SourceLink } from "./source-link";
import { RequestedAmount } from "./requested-amount";
import styles from "./history.module.css";

export function HistoryOverview({ history, select }: { history: ProjectHistory; select: (section: string, kind?: string) => void }) {
  const facts = projectInsights(history);
  const work = facts.latestWork;
  const preferredSources = history.sources.filter(item => ["website", "repository", "report"].includes(item.kind));
  const primarySources = (preferredSources.length ? preferredSources : history.sources).slice(0, 3);
  const releaseTitle = work?.kind === "release" ? work.title.match(/^([\w.-]+\/[\w.-]+) · (.+)$/) : null;
  const workLabel = work?.releaseChannel === "prerelease" ? "Prerelease" : work?.kind === "report" ? "Team report" : work?.kind === "delivery" ? "Accepted milestone" : work?.kind === "integration" ? "Integration" : work?.kind === "usage" ? "Usage observation" : "Release";
  const grantDate = (id: string) => history.timeline.find(event => event.grantId === id && event.date)?.date ?? "";
  const grants = [...history.grants].sort((a, b) => grantDate(b.id).localeCompare(grantDate(a.id))).slice(0, 2);
  const coverage = [
    { label: "Funding", value: facts.grants ? `${facts.grants} grant ${facts.grants === 1 ? "record" : "records"}` : history.coverage.proposalsAvailable ? "Not linked" : "Source unavailable", note: facts.paidEntries === null ? "Payments unavailable" : facts.grants ? `${facts.paidEntries} paid ${facts.paidEntries === 1 ? "entry" : "entries"} linked` : "No project-specific grant linked", section: "funding" },
    { label: "Milestone acceptance", value: facts.acceptedEntries ? `${facts.acceptedEntries} ${facts.acceptedEntries === 1 ? "entry" : "entries"} supported` : "Not linked", note: facts.acceptanceGaps ? `${facts.acceptanceGaps} paid ${facts.acceptanceGaps === 1 ? "entry needs" : "entries need"} acceptance evidence` : "Review the funded scope and acceptance", section: "funding" },
    { label: "Measured use", value: facts.usageObservations ? `${facts.usageObservations} ${facts.usageObservations === 1 ? "observation" : "observations"}` : "Not assessed", note: facts.integrations ? `${facts.integrations} documented ${facts.integrations === 1 ? "integration" : "integrations"}` : "No integration evidence linked", section: "evidence" },
  ];
  return <div className={styles.brief}>
    <div className={styles.briefGrid}>
      <section className={styles.featuredWork} aria-labelledby="latest-work-title">
        <div className={styles.briefHeading}><h2 id="latest-work-title">Latest published work</h2><button onClick={() => select("timeline")}>Activity <span aria-hidden>↗</span></button></div>
        {work ? <>
          <div className={styles.workMeta}><span className={styles.badge}>{workLabel}</span><time dateTime={work.date!}>{displayDate(work.date!)}</time></div>
          <h3 className={releaseTitle ? styles.versionTitle : undefined}>{releaseTitle ? releaseTitle[2] : work.title}</h3>{releaseTitle && <p className={styles.repositoryName}>{releaseTitle[1]}</p>}
          {!(work.kind === "release" && work.id.startsWith("release-")) && <p className={styles.workSummary}>{work.detail}</p>}
          <div className={styles.workSource}><SourceLink source={work.source} /></div>
          {work.kind === "release" && work.id.startsWith("release-") && <p className={styles.evidenceNote}>A publication is not a grant acceptance.</p>}
        </> : <div className={styles.noWork}><h3>{facts.reportSources ? "Reports available to review" : history.sources.length ? "Project sources available" : "No dated publication linked"}</h3><p>{facts.reportSources ? `${facts.reportSources} report ${facts.reportSources === 1 ? "source" : "sources"} · publication dates not linked.` : history.sources.length ? "Original references are linked below. A dated publication has not been verified for this record yet." : "This record has no dated work source yet."}</p>{facts.reportSources > 0 && <button className={styles.textAction} onClick={() => select("timeline", "report")}>Open reports →</button>}</div>}
        {primarySources.length > 0 && <div className={styles.primarySources}><span>Explore sources</span>{primarySources.map(item => <SourceLink key={item.url} source={item} />)}<a className={styles.textAction} href="#history-sources">All sources ({history.sources.length}) ↓</a></div>}
      </section>
      <section className={styles.coverageBrief} aria-labelledby="review-coverage-title"><h2 id="review-coverage-title">Evidence for review</h2>
        {coverage.map(item => <button className={styles.coverageRow} key={item.label} onClick={() => select(item.section)}><span className={styles.coverageLabel}>{item.label}</span><span className={styles.coverageValue}><strong>{item.value}</strong><small>{item.note}</small></span><span aria-hidden>↗</span></button>)}
        <p className={styles.evidenceNote}>Missing links describe our coverage, not the project’s performance.</p>
      </section>
    </div>
    {grants.length > 0 && <section className={styles.fundingBrief} aria-labelledby="funding-brief-title">
      <div className={styles.briefHeading}><h2 id="funding-brief-title">Grants to review</h2><button onClick={() => select("funding")}>Open funding <span aria-hidden>→</span></button></div>
      {grants.map(grant => <article className={styles.scopeRow} key={grant.id}>
        <div><div className={styles.scopeMeta}><span>{grant.program === "zcg" ? "ZCG" : "Coinholder Grants"}</span><span className={styles.badge}>{grant.statusBasis === "ambiguous" ? "Identity needs review" : `${grant.statusBasis === "dated_catalog" ? "Catalog: " : ""}${grant.status.replaceAll("_", " ")}`}</span></div><h3>{grant.title}</h3>{grant.sharedWith.length > 0 && <p className={styles.sharedScope}>Shared award · not a project-specific allocation</p>}{grant.statusBasis === "ambiguous" && <p className={styles.sharedScope}>Amounts withheld until the award is identified.</p>}<SourceLink source={grant.source} /></div>
        <dl><RequestedAmount grant={grant} /><div><dt>Paid entries · USD budget</dt><dd>{historyAmount(grant.paidBudgetUsdCents.known)}</dd>{grant.paidBudgetUsdCents.missing > 0 && <small>{grant.paidBudgetUsdCents.missing} missing {grant.paidBudgetUsdCents.missing === 1 ? "value" : "values"}</small>}</div></dl>
      </article>)}
      <p className={styles.evidenceNote}>Amounts belong to each grant; shared awards can overlap.</p>
    </section>}
    {facts.checks.length > 0 && <section className={styles.assessmentChecks} aria-labelledby="assessment-checks-title"><div className={styles.briefHeading}><h2 id="assessment-checks-title">Before forming a view</h2><span>{facts.checks.length} open {facts.checks.length === 1 ? "question" : "questions"}</span></div>
      {facts.checks.map((check, index) => <details className={styles.assessmentQuestion} key={check.title}><summary><span>{String(index + 1).padStart(2, "0")}</span>{check.title}</summary><p>{check.detail}</p><button className={styles.textAction} onClick={() => select(check.section)}>Inspect evidence →</button></details>)}
    </section>}
  </div>;
}
