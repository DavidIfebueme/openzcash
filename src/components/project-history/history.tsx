"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ProjectHistory, Amount, HistoryEvent } from "@/lib/project-history/types";
import { historyAmount } from "@/lib/project-history/format";
import { displayDate } from "@/lib/ecosystem/catalog";
import { RepositoryFreshness } from "./freshness";
import { HistoryOverview } from "./overview";
import { SourceLink } from "./source-link";
import styles from "./history.module.css";

const evidenceLabels: Record<HistoryEvent["evidence"], string> = {
  source_record: "Source record", published_artifact: "Published artifact", team_reported: "Team reported", reviewed_delivery: "Reviewed delivery",
  documented_integration: "Documented integration", usage_observation: "Usage observation",
};
function AmountValue({ amount, unit = "USD" }: { amount: Amount; unit?: "USD" | "ZEC" }) {
  return <>{historyAmount(amount.known, unit)}{amount.missing > 0 && <small className={styles.muted}> · {amount.missing} missing</small>}</>;
}

export function ProjectHistoryView({ history }: { history: ProjectHistory }) {
  const params = useSearchParams();
  const ids = ["overview", "funding", "timeline", "evidence"];
  const tab = ids.includes(params.get("section") ?? "") ? params.get("section")! : "overview";
  const kind = params.get("kind") ?? "", month = /^20\d{2}-(?:0[1-9]|1[0-2])$/.test(params.get("month") ?? "") ? params.get("month")! : "";
  const [limit, setLimit] = useState(15);
  function update(values: Record<string, string>, push = false) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key); }
    window.history[push ? "pushState" : "replaceState"](null, "", `?${next.toString()}`);
    setLimit(15);
  }
  const setTab = (value: string) => update({ section: value }, true);
  const events = history.timeline.filter(event => (!kind || event.kind === kind) && (!month || event.date?.slice(0, 7) === month));
  const kinds = [...new Set(history.timeline.map(event => event.kind))];
  return <>
    <div className={styles.freshness}><span>Repository snapshot <b>{displayDate(history.repositorySnapshotAt)}</b></span><span>Latest ledger import <b>{history.ledgerImportedAt ? displayDate(history.ledgerImportedAt) : "unavailable"}</b></span><span>Reviewed additions <b>{history.reviews.filter(review => review.linked && !review.supersededBy).length}</b></span></div>
    <RepositoryFreshness snapshotAt={history.repositorySnapshotAt} asOf={history.assembledAt} />
    {(!history.coverage.paymentsAvailable || !history.coverage.proposalsAvailable) && <p role="status" className={styles.notice}>A financial source is unavailable. This view retains dated catalog context; missing values are not zero.</p>}
    <div className={styles.layout}><div className={styles.record}>
      <div className={styles.tabs} role="tablist" aria-label="Project history sections">
        {[["overview", "Overview"], ["funding", "Funding"], ["timeline", "Timeline"], ["evidence", "Evidence"]].map(([id, title], index) => <button key={id} type="button" role="tab" className={styles.tab} id={`tab-${id}`} aria-controls={`panel-${id}`} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={event => {
          const next = event.key === "ArrowRight" ? (index + 1) % 4 : event.key === "ArrowLeft" ? (index + 3) % 4 : event.key === "Home" ? 0 : event.key === "End" ? 3 : null;
          if (next !== null) { event.preventDefault(); setTab(ids[next]); document.getElementById(`tab-${ids[next]}`)?.focus(); }
        }}>{title}</button>)}
      </div>
      <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "overview" && <HistoryOverview history={history} select={(section, type) => update({ section, ...(type ? { kind: type, month: "" } : {}) }, true)} />}
        {tab === "timeline" && <>
          <div className={`${styles.filters} ${styles.timelineFilters}`}>
            <label>Record type<select value={kind} onChange={event => update({ kind: event.target.value })}><option value="">All records</option>{kinds.map(value => <option value={value} key={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
            <label>Event month · UTC<input type="month" min="2016-01" max="2099-12" value={month} onChange={event => update({ month: event.target.value })} /></label>
            {(month || kind) && <button className={styles.more} onClick={() => update({ month: "", kind: "" })}>Reset filters</button>}
          </div>
          <p className={styles.muted} aria-live="polite">{events.length} linked record{events.length === 1 ? "" : "s"}{month ? ` · undated records excluded` : " · undated references appear last"}</p>
          <ol className={styles.timeline}>{events.slice(0, limit).map(event => <li key={event.id} className={styles.event}>
            <time dateTime={event.date ?? undefined}>{event.date ? displayDate(event.date) : "Date not linked"}</time>
            <div className={styles.eventBody}><span className={`${styles.badge} ${event.evidence === "published_artifact" || event.evidence === "reviewed_delivery" ? styles.artifact : ""}`}>{event.sourceState === "unlisted" ? "Previously observed · no longer listed" : evidenceLabels[event.evidence]}</span>
              <h3>{event.title}</h3><p>{event.detail}</p><SourceLink source={event.source} />
            </div>
          </li>)}</ol>
          {!events.length && <p className={styles.empty}>No linked records for this selection. This does not establish that no work occurred.</p>}
          {events.length > limit && <button className={styles.more} onClick={() => setLimit(limit + 15)}>Show more records</button>}
        </>}
        {tab === "funding" && <>
          <p className={styles.muted}>Amounts describe each associated grant. Requested amounts, approval status and paid entries are separate; the source has no distinct approved-amount field.</p>
          {history.grants.map(grant => <article className={styles.grant} key={grant.id} id={grant.id}>
            <div className={styles.grantTop}><span className={styles.eyebrow}>{grant.program === "zcg" ? "ZCG" : "Coinholder Grants"}</span><span className={styles.badge}>{grant.statusBasis === "dated_catalog" ? "Catalog: " : ""}{grant.status.replaceAll("_", " ")}</span></div>
            <h3>{grant.title}</h3>
            {grant.sharedWith.length > 0 && <p className={styles.shared}>Shared award context with {grant.sharedWith.map((project, index) => <span key={project.id}>{index > 0 && ", "}<Link href={`/ecosystem/history/${project.id}`}>{project.name}</Link></span>)}. These amounts are not an allocation to this component.</p>}
            <dl className={styles.amounts}>
              <div><dt>Requested · USD</dt><dd>{historyAmount(grant.requestedUsdCents)}</dd></div>
              <div><dt>Recorded grant budget · USD</dt><dd><AmountValue amount={grant.budgetUsdCents} /></dd></div>
              <div><dt>Budget value of paid entries · USD</dt><dd><AmountValue amount={grant.paidBudgetUsdCents} /></dd></div>
              <div><dt>Recorded paid ZEC</dt><dd><AmountValue amount={grant.recordedZecZat} unit="ZEC" /></dd></div>
            </dl>
            <p>USD figures are historical ledger budgets. ZEC is the recorded disbursement, not a current USD valuation or independent on-chain verification.</p>
            <p><SourceLink source={grant.source} />{grant.scopeUrl && <> · <a className={styles.source} href={grant.scopeUrl} target="_blank" rel="noopener noreferrer">Proposal scope ↗</a></>}{grant.milestones.length > 0 && <> · <Link className={styles.source} href={`/zcg/grant?g=${encodeURIComponent(grant.title)}`}>Payment detail →</Link></>}</p>
            <details><summary>{grant.milestones.length} linked ledger {grant.milestones.length === 1 ? "entry" : "entries"}</summary>
              {grant.milestones.map(milestone => <div className={styles.milestone} key={milestone.id}>
                <h4>{milestone.title}</h4><p>{milestone.deliverable ?? "Deliverable text is not linked; consult the proposal scope."}</p>
                <p>{milestone.paymentRecorded ? `Payment recorded${milestone.paidDate ? ` · ${displayDate(milestone.paidDate)}` : " · date unavailable"}` : "Not marked paid in the ledger"}</p>
                {milestone.deliveryEvidence.length ? milestone.deliveryEvidence.map(event => <p key={event.id}><span className={styles.badge}>Reviewed delivery</span> {event.detail} <SourceLink source={event.source} /></p>) : <p>Acceptance evidence is not linked yet.</p>}
                <SourceLink source={milestone.source} />
              </div>)}
              {!grant.milestones.length && <p>No exact ledger match is linked. Missing records are not a zero total.</p>}
            </details>
          </article>)}
          {!history.grants.length && <p className={styles.empty}>No project-specific grant record is linked in this catalog.</p>}
        </>}
        {tab === "evidence" && <>
          <div className={styles.sectionIntro}><div><p className={styles.eyebrow}>Coverage & review trail</p><h2>Know what supports the record.</h2></div></div>
          <p className={styles.muted}>Missing evidence is a research gap. It does not establish non-delivery, low adoption or a missed deadline.</p>
          <ul>{history.gaps.map(gap => <li className={styles.gap} key={gap}>{gap}</li>)}</ul>
          <h3 className={styles.subheading}>Reviewed sources & corrections</h3>
          {history.reviews.length ? [...history.reviews].reverse().map(review => <article className={styles.review} key={review.id}>
            <span className={styles.badge}>{review.supersededBy ? "Superseded" : review.linked ? evidenceLabels[review.kind] : "Link needs review"}</span><h3>{review.title}</h3>
            <p>{review.summary}</p><p className={styles.muted}>Event {displayDate(review.date)} · Reviewed {displayDate(review.reviewedAt)}</p>
            <SourceLink source={{ label: "Original source", url: review.sourceUrl, observedAt: review.reviewedAt }} />
            {review.measurement && <p>{review.measurement.metric}: {review.measurement.value} {review.measurement.unit} · {review.measurement.periodStart}–{review.measurement.periodEnd}<br />{review.measurement.population}. {review.measurement.methodology}</p>}
            <details><summary>Review basis{review.supersededBy ? " & correction" : ""}</summary><p>{review.reviewNote}</p>{review.supersededBy && <p>Replaced by {history.reviews.find(item => item.id === review.supersededBy)?.title ?? review.supersededBy}. Retained for traceability; excluded from current insights.</p>}</details>
          </article>) : <p className={styles.empty}>No additional source reviews have been admitted for this project yet. The timeline still contains its linked ledger and repository records.</p>}
        </>}
      </section>
    </div></div>
    <section id="history-sources" className={styles.sourcePanel} aria-labelledby="sources-title">
      <div className={styles.sourceHead}><div><h2 id="sources-title">Verify the sources</h2><p>The records behind this history, with their collection dates.</p></div><a className={styles.action} href={`/api/project-history/${history.project.id}`} target="_blank" rel="noopener noreferrer">Open source data ↗</a></div>
      <div className={styles.aside}>
      <section><h2>Source coverage</h2><dl>
        <dt>Project identity reviewed</dt><dd>{displayDate(history.registryCheckedAt)}</dd>
        <dt>Repository snapshot · not live</dt><dd>{displayDate(history.repositorySnapshotAt)}</dd>
        <dt>Latest mirror row import</dt><dd>{history.ledgerImportedAt ? displayDate(history.ledgerImportedAt) : "Unavailable"}</dd>
        <dt>Proposal / payment readers</dt><dd>{history.coverage.proposalsAvailable ? "Available" : "Unavailable"} / {history.coverage.paymentsAvailable ? "Available" : "Unavailable"}</dd>
      </dl></section>
      <section><h2>Reading the evidence</h2><p>Source records document funding and decisions. Published artifacts establish releases, not grant completion. Team reports describe claimed work. Reviewed delivery requires evidence tied to a specific milestone.</p><p>Payment alone never marks work delivered.</p></section>
      {history.reportLinks.length > 0 && <section><h2>Community reports</h2><ul>{history.reportLinks.map(report => <li key={report.url}><a className={styles.source} href={report.url} target="_blank" rel="noopener noreferrer">{report.title} ↗</a></li>)}</ul><p>These are report sources to inspect, not verified completion claims.</p></section>}
      <section><h2>One public record</h2><p>The same linked history is available to Zarvis and monthly reporting. Reviewed corrections stay visible in the Evidence tab.</p></section>
      </div>
    </section>
  </>;
}
