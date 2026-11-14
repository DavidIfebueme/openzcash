import type { OpenDecision } from "@/lib/governance/open-decisions";
import { FACTS, phases } from "@/lib/governance/process";
import { ViewLink } from "./governance-views";
import { ZcashPieces } from "./zcash-pieces";
import styles from "./views.module.css";

interface HowItWorksProps {
  /** The decision open today, shown as the last fact. */
  decision: OpenDecision;
}

/** How a change becomes a Zcash rule: who has to agree, and in what order. */
export function HowItWorks({ decision }: HowItWorksProps) {
  return (
    <div className={styles.grid}>
      <section
        className={`${styles.card} ${styles.hero}`}
        aria-labelledby="governance-who-decides"
      >
        <p className={styles.kicker}>Who decides</p>
        <h2 className={styles.title} id="governance-who-decides">
          No one decides alone
        </h2>
        <p className={styles.sub}>
          A change becomes a rule only when three pieces meet.
        </p>
        <ZcashPieces />
      </section>

      <section
        className={`${styles.card} ${styles.path}`}
        aria-labelledby="governance-seven-steps"
      >
        <p className={styles.kicker}>From idea to activation</p>
        <h2 className={styles.title} id="governance-seven-steps">
          Seven steps
        </h2>
        <div className={styles.phases}>
          {phases().map((phase) => (
            <div key={phase.piece.id} className={styles.phase}>
              <p className={styles.phaseName}>{phase.piece.name}</p>
              <ol className={styles.steps} start={phase.steps[0].number}>
                {phase.steps.map((step) => (
                  <li key={step.name} className={styles.step}>
                    <span className={styles.stepNumber} aria-hidden="true">
                      {step.number}
                    </span>
                    <span className={styles.stepName}>{step.name}</span>
                    <span className={styles.stepWhere}>{step.where}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section
        className={`${styles.card} ${styles.band}`}
        aria-label="Key facts"
      >
        {FACTS.map((fact) => (
          <div key={fact.question} className={styles.cell}>
            <p className={styles.kicker}>{fact.question}</p>
            <strong className={styles.answer}>{fact.answer}</strong>
            <span className={styles.detail}>{fact.detail}</span>
          </div>
        ))}
        <div className={`${styles.cell} ${styles.cellNow}`}>
          <p className={styles.kicker}>
            <span className={styles.live} aria-hidden="true" />
            Being decided now
          </p>
          <strong className={styles.answer}>{decision.window}</strong>
          <span className={styles.detail}>{decision.title}</span>
          <ViewLink view="now">See the schedule →</ViewLink>
        </div>
      </section>
    </div>
  );
}
