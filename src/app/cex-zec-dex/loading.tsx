import styles from "./markets.module.css";

export default function Loading() {
  return (
    <div
      className={styles.page}
      aria-busy="true"
      aria-label="Loading Zcash markets"
    >
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Zcash market observatory</p>
          <h1>
            CEX &lt; <em>ZEC</em> &gt; DEX
          </h1>
          <p role="status">Checking trading activity and on-chain supply…</p>
        </div>
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
