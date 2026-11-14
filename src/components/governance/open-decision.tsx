import {
  POLL_STATUS_LABEL,
  pollStatus,
  stepStates,
  type OpenDecision,
} from "@/lib/governance/open-decisions";
import { ViewLink } from "./governance-views";
import styles from "./views.module.css";

interface OpenDecisionViewProps {
  decision: OpenDecision;
  /** The current day (ISO, UTC): it sets which step is in progress. */
  today: string;
  /** How many earlier polls the page records. */
  earlierPolls: number;
}

/**
 * The decision open today: its calendar and where to follow it. The
 * proposals are linked, not compared.
 */
export function OpenDecisionView({
  decision,
  today,
  earlierPolls,
}: OpenDecisionViewProps) {
  const states = stepStates(decision.steps, today);
  const status = POLL_STATUS_LABEL[pollStatus(decision, today)];

  return (
    <div className={styles.grid}>
      <section
        className={`${styles.card} ${styles.now}`}
        aria-labelledby="governance-open-decision"
      >
        <div className={styles.nowHead}>
          <div>
            <p className={styles.kicker}>
              <span className={styles.live} aria-hidden="true" />
              Being decided now
            </p>
            <h2 className={styles.title} id="governance-open-decision">
              {decision.title}
            </h2>
            <p className={`${styles.sub} ${styles.subWide}`}>{decision.note}</p>
          </div>
          <p className={styles.when}>
            <strong>{decision.window}</strong>
            <span>{status}</span>
          </p>
        </div>
        <ol className={styles.calendar} aria-label="Poll calendar">
          {decision.steps.map((step, index) => (
            <li
              key={step.from}
              className={styles.calendarStep}
              data-state={states[index]}
              aria-current={states[index] === "now" ? "step" : undefined}
            >
              <time dateTime={step.from}>
                {step.when}
                {states[index] === "now" ? " · now" : ""}
              </time>
              {step.label}
            </li>
          ))}
        </ol>
      </section>

      <section
        className={`${styles.card} ${styles.band}`}
        aria-label="Where to follow it"
      >
        {decision.pointers.map((pointer) => (
          <div key={pointer.label} className={styles.cell}>
            <p className={styles.kicker}>{pointer.label}</p>
            <p className={styles.links}>
              {pointer.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {link.label} ↗
                </a>
              ))}
            </p>
          </div>
        ))}
        <div className={styles.cell}>
          <p className={styles.kicker}>Earlier polls</p>
          <p className={styles.links}>
            <ViewLink view="polls">{earlierPolls} on record →</ViewLink>
          </p>
        </div>
      </section>
    </div>
  );
}
