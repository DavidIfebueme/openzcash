import styles from "./community-credit.module.css";

/** Credit the contribution to the interface, never the projects or evidence it displays. */
export const SCREEN_CREDITS = {
  "openzcash-treasury": { name: "OpenZcash", role: "Built by", production: "Community project" },
  "coinholder-verification": { name: "vaspholdings", role: "Page design by", production: "Built by OpenZcash" },
  "project-history": { name: "socrates1024", role: "Community contribution by", production: "Designed and built by OpenZcash" },
  "wallet-finder": { name: "@Foreveranka", role: "Requirements informed by", production: "Designed and built by OpenZcash", source: "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/495" },
} as const;

type Screen = keyof typeof SCREEN_CREDITS;

export function CommunityCredit({ screen, compact = false }: { screen: Screen; compact?: boolean }) {
  const credit = SCREEN_CREDITS[screen];
  if (compact) return <a className={styles.byline} href="#community-credit">{credit.role} <strong>{credit.name}</strong></a>;
  return <footer id="community-credit" className={styles.credit} aria-label="Community contribution">
    <span>{credit.role}{" "}{"source" in credit ? <a href={credit.source} target="_blank" rel="noopener noreferrer"><strong>{credit.name}</strong></a> : <strong>{credit.name}</strong>}</span>
    <span className={styles.divider} aria-hidden="true">·</span>
    <span>{credit.production}</span>
  </footer>;
}
