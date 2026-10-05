import type { GrantHistory } from "@/lib/project-history/types";
import { historyAmount } from "@/lib/project-history/format";
import { SourceLink } from "./source-link";
import styles from "./history.module.css";

export function RequestedAmount({ grant }: { grant: GrantHistory }) {
  const review = grant.requestedAmountReview;
  const missing = grant.statusBasis === "ambiguous" ? "Needs review" : grant.statusBasis === "published_proposal" ? "Not in ledger" : "Not verified";
  return <div>
    <dt>{review?.basis === "cap" ? "Requested cap" : "Requested"} · USD</dt>
    <dd className={grant.requestedUsdCents === null ? styles.missingAmount : undefined}>{grant.requestedUsdCents === null ? missing : historyAmount(grant.requestedUsdCents)}</dd>
    {review && <details className={styles.amountBasis}><summary>Request basis</summary><p>{review.summary}</p><SourceLink source={review.source} /></details>}
    {!review && grant.requestedUsdCents === null && grant.scopeUrl && grant.statusBasis !== "ambiguous" && <a className={styles.requestScope} href={grant.scopeUrl} target="_blank" rel="noopener noreferrer">Read proposal ↗</a>}
  </div>;
}
