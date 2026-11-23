"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Q4, q4Usd, type Q4ProposalSummary } from "@/lib/coinholder/q4";
import { displayProposalTopics } from "@/lib/coinholder/proposal-topics";
import styles from "./proposals.module.css";

function RequestedAmount({ cents }: { cents: number | null }) {
  const text = cents === null ? "Not specified" : q4Usd(cents);
  // Nine characters fit at the display size; longer amounts keep their full precision.
  const style = cents === null ? undefined : { fontSize: 25 * Math.min(1, 9 / text.length) };
  return <strong className={cents === null ? styles.requestFallback : undefined} style={style}>{text}</strong>;
}

export function Proposals({ proposals }: { proposals: Q4ProposalSummary[] }) {
  const params = useSearchParams();
  const entries = proposals.map((p) => ({ ...p, topics: displayProposalTopics(p) }));
  const categories = [...new Set(entries.flatMap((p) => p.topics.map((t) => t.label)))].sort();
  const query = params.get("q") ?? "";
  const category = categories.includes(params.get("topic") ?? "") ? params.get("topic")! : "";
  const sort = ["highest", "lowest", "title"].includes(params.get("sort") ?? "") ? params.get("sort")! : "newest";
  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value && !(key === "sort" && value === "newest")) next.set(key, value);
      else next.delete(key);
    }
    const search = next.toString();
    window.history.replaceState(null, "", `${Q4.href}${search ? `?${search}` : ""}${window.location.hash}`);
  }
  const needle = query.trim().toLowerCase();
  const shown = entries.filter((p) => (!category || p.topics.some((t) => t.label === category)) &&
    `${p.number} ${p.title} ${p.organization ?? ""} ${p.applicant} ${p.summary ?? ""} ${p.topics.map((t) => t.label).join(" ")} ${p.category ?? ""}`.toLowerCase().includes(needle))
    .sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "highest" || sort === "lowest") {
        if (a.requestedUsdCents === null) return b.requestedUsdCents === null ? 0 : 1;
        if (b.requestedUsdCents === null) return -1;
        return (a.requestedUsdCents - b.requestedUsdCents) * (sort === "highest" ? -1 : 1);
      }
      return b.createdAt.localeCompare(a.createdAt) || b.number - a.number;
    });
  function clear() { update({ q: "", topic: "" }); }

  if (!proposals.length) return <div className={styles.empty}><h2>No proposals yet</h2><p>Official submissions will appear here.</p></div>;
  return <>
    <div className={styles.filters}>
      <label className={styles.search}><span className="sr-only">Search proposals</span><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg><input type="search" placeholder="Search proposals" value={query} onChange={(e) => update({ q: e.target.value })} /></label>
      <label><span className="sr-only">Topic</span><select value={category} onChange={(e) => update({ topic: e.target.value })}><option value="">All topics</option>{categories.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label><span className="sr-only">Sort</span><select value={sort} onChange={(e) => update({ sort: e.target.value })}><option value="newest">Newest first</option><option value="highest">Highest request</option><option value="lowest">Lowest request</option><option value="title">Project A–Z</option></select></label>
    </div>
    <div className={styles.resultCount} role="status">{query || category ? <><span>{shown.length} of {proposals.length} proposals</span><button type="button" onClick={clear}>Clear filters</button></> : null}</div>
    <ol className={styles.list} aria-label="Official proposals">
      {shown.map((p) => <li key={p.number}>
        <article className={styles.proposal}>
          <div className={styles.proposalContent}>
            <div className={styles.meta}>
              <span className={styles.proposalNumber}>#{p.number}</span>
              {p.reviewDecisionUrl ? <span className={styles.category}>Provisionally listed by FPF</span> : null}
              {p.topics.map((topic) => <span key={topic.id} className={styles.category} data-category={topic.label} data-tone={topic.tone} title={topic.note}>{topic.label}</span>)}
            </div>
            <h2><Link href={`${Q4.href}/${p.number}`}>{p.title}</Link></h2>
            <p className={styles.applicant}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="8" r="3.5" /><path d="M5 20v-1.5a7 7 0 0 1 14 0V20" /></svg>
              <span>{p.organization ?? (p.applicant ? `@${p.applicant}` : "Applicant not specified")}</span>
            </p>
            {p.summary ? <p className={styles.summary}>{p.summary}</p> : null}
          </div>
          <div className={styles.request}>
            <span>Requested</span>
            <RequestedAmount cents={p.requestedUsdCents} />
            {p.requestedUsdCents !== null ? <small>USD</small> : null}
          </div>
          <Link className={styles.viewProposal} href={`${Q4.href}/${p.number}`}>
            View proposal <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14m-5-5 5 5-5 5" /></svg>
            <span className="sr-only">: {p.title}</span>
          </Link>
        </article>
      </li>)}
    </ol>
    {!shown.length ? <div className={styles.empty}><h2>No matching proposals</h2><p>Try another name or topic.</p></div> : null}
  </>;
}
