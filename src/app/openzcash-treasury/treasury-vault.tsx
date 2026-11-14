import styles from "./treasury.module.css";

/** Original vault illustration; the coin uses the project's official Zcash mark. */
export function TreasuryVault() {
  return <svg className={styles.vault} viewBox="0 0 180 180" fill="none" aria-hidden="true">
    <ellipse cx="93" cy="160" rx="69" ry="9" fill="currentColor" opacity=".05" />
    <path d="m33 52 26-21h87l-25 21" fill="var(--accent-soft)" stroke="var(--accent-muted)" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="m140 54 16-15v98l-16 16" fill="var(--surface2)" stroke="var(--vault-line)" strokeWidth="1.5" strokeLinejoin="round" />
    <rect x="29" y="49" width="112" height="106" rx="12" fill="var(--surface2)" stroke="var(--vault-line)" strokeWidth="1.5" />
    <rect x="38" y="58" width="94" height="88" rx="7" fill="var(--surface)" stroke="var(--vault-line)" strokeWidth="1.5" />
    <path d="M33 77h9m-9 47h9" stroke="var(--accent-ink)" strokeWidth="5" strokeLinecap="round" />
    <circle cx="86" cy="101" r="32" stroke="var(--vault-line)" strokeWidth="1.5" strokeDasharray="2 5" />
    <svg x="60" y="75" width="52" height="52" viewBox="270 270 540 540">
      <path fill="var(--gold)" fillRule="evenodd" d="m270,540c0-148.9,121.1-270,270-270s270,121.1,270,270-121.1,270-270,270-270-121.1-270-270Zm366.31-125.3v41.09l-114.28,155h114.28v54.5h-73.67v45.16h-45.28v-45.16h-73.67v-41.09l114.16-155h-114.16v-54.5h73.67v-45.28h45.28v45.28h73.67Z" />
    </svg>
    <path d="M121 94v14" stroke="var(--accent-ink)" strokeWidth="3" strokeLinecap="round" />
    <path d="M46 157v5m78-5v5" stroke="var(--vault-line)" strokeWidth="7" strokeLinecap="round" />
    <circle cx="148" cy="25" r="11" fill="var(--accent-soft)" stroke="var(--accent-muted)" />
    <path d="m143 25 3 3 6-6" stroke="var(--accent-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20 33v10m-5-5h10M162 74v6m-3-3h6" stroke="var(--accent-muted)" strokeWidth="1.5" strokeLinecap="round" />
  </svg>;
}
