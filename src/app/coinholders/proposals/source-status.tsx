import { Q4, q4Timestamp, type Q4Snapshot } from "@/lib/coinholder/q4";
import styles from "./proposals.module.css";

export function SourceStatus({ snapshot }: { snapshot: Q4Snapshot }) {
  if (snapshot.status === "current") return null;
  return <div className={styles.notice} role="status">
    <strong>{snapshot.status === "stale" ? "GitHub could not be refreshed." : "Proposals are temporarily unavailable."}</strong>{" "}
    {snapshot.status === "stale" && snapshot.fetchedAt ? `Showing the last successful check from ${q4Timestamp(snapshot.fetchedAt)}. ` : "We could not check the official list. "}
    <a href={Q4.issuesUrl} target="_blank" rel="noreferrer">Check the source on GitHub ↗</a>
  </div>;
}
