import type { ProjectHistory } from "@/lib/project-history/types";
import { SourceLink } from "./source-link";
import styles from "./history.module.css";

const labels = { website: "Website", repository: "Code & activity", reference: "Reference", funding: "Funding", report: "Report", publication: "Publication" };
export function SourceDirectory({ history }: { history: ProjectHistory }) {
  const sources = history.sources;
  const rows = (items: typeof sources) => <ul className={styles.sourceList}>{items.map(item => <li key={item.url}><span>{labels[item.kind]}</span><SourceLink source={item} /></li>)}</ul>;
  return <div className={styles.sourceDirectory}>
    <div className={styles.sourceDirectoryHeading}><h2>Project sources</h2><span>{sources.length} linked {sources.length === 1 ? "source" : "sources"}</span></div>
    <p>Original references for this record. A source link alone does not verify delivery or acceptance.</p>
    {rows(sources.slice(0, 8))}
    {sources.length > 8 && <details className={styles.sourceMore}><summary>Show {sources.length - 8} more sources</summary>{rows(sources.slice(8))}</details>}
    {!sources.length && <p>No project-specific sources have been linked yet.</p>}
  </div>;
}
