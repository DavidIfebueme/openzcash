import { ROLES, TERMS } from "@/lib/governance/process";
import styles from "./views.module.css";

/** Each role in a decision: what it does and what it cannot do alone. */
export function WhoDoesWhat() {
  return (
    <div className={styles.grid}>
      <section
        className={`${styles.card} ${styles.roles}`}
        aria-label="Who does what"
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Who</th>
              <th scope="col">Does</th>
              <th scope="col">Cannot do alone</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role) => (
              <tr key={role.who} data-final={role.finalSay || undefined}>
                <th scope="row">{role.who}</th>
                <td>{role.does}</td>
                <td>{role.cannotAlone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

/** The few terms the governance record keeps using. */
export function GovernanceTerms() {
  return (
    <>
      <h2 className={styles.heading}>Terms</h2>
      <div className={styles.grid}>
        <dl className={`${styles.card} ${styles.terms}`}>
          {TERMS.map((entry) => (
            <div key={entry.term} className={styles.term}>
              <dt>{entry.term}</dt>
              <dd>{entry.meaning}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  );
}
