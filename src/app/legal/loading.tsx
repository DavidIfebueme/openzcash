import styles from "@/components/legal/legal.module.css";

export default function LoadingLegal() {
  return <div className={styles.page} aria-busy="true"><header className={styles.masthead}><h1>Privacy &amp; Policy</h1><p role="status">Loading public updates…</p></header></div>;
}
