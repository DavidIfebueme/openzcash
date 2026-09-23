import styles from "./markets.module.css";

export default function Loading() {
  return (
    <div
      className={styles.page}
      aria-busy="true"
      aria-label="Loading ZEC Observatory"
    >
      <header className={styles.header}>
        <h1>
          <em>ZEC</em> Observatory
        </h1>
      </header>
      <div className={styles.loadingPanel} aria-hidden="true">
        <div className={styles.loadingTitle} />
        <div className={styles.loadingBar} />
        <div className={styles.loadingBar} />
      </div>
      <div className={styles.featureGrid} aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className={styles.loadingCard} />
        ))}
      </div>
    </div>
  );
}
