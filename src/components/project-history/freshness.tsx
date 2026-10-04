import styles from "./history.module.css";
export function RepositoryFreshness({ snapshotAt, asOf }: { snapshotAt: string; asOf: string }) {
  const ageDays = (Date.parse(asOf) - Date.parse(snapshotAt)) / 86_400_000;
  return Number.isFinite(ageDays) && ageDays > 7 ? <p className={styles.notice} role="status">Repository data was checked {Math.floor(ageDays)} days ago. Newer releases may exist; follow the original sources for current versions.</p> : null;
}
