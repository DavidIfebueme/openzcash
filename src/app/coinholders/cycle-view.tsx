import Link from "next/link";
import type { ReactNode } from "react";
import { ACTIVE_CYCLE, cycleDateRange, cycleDeadline, cycleHref, cycleNote, cyclePhase, cycleWindows } from "@/lib/coinholder/cycles";
import base from "./coinholders.module.css";
import styles from "./cycle-view.module.css";

function ZcashMark() {
  return <span className={styles.zcashMark} role="img" aria-label="Zcash" />;
}

export function CycleCard({ labelledBy, children }: { labelledBy: string; children: ReactNode }) {
  return <section className={styles.card} aria-labelledby={labelledBy}>{children}</section>;
}

function CycleStatus({ label }: { label: string }) {
  return <span className={styles.phase}><span aria-hidden />{label}</span>;
}

export function CycleBrand({ id }: { id: string }) {
  return <div className={styles.brand}>
    <div className={styles.brandLogo}><ZcashMark /></div>
    <div className={styles.brandText}>
      <div className={styles.brandTitle}><h2 id={id}>{ACTIVE_CYCLE.label}</h2><CycleStatus label={cyclePhase().label} /></div>
    </div>
  </div>;
}

/** The round's mascot, a zebra at a ballot box: it carries a ballot while submissions are open, casts it during the vote and stands by the box in between. Decorative: the sentence beside it says where the round stands. */
export function CycleScene({ now }: { now?: number }) {
  const { step } = cyclePhase(ACTIVE_CYCLE, now);
  const pose = step === 0 ? "carry" : step === 2 ? "cast" : "stand";
  return <span className={styles.scene} data-pose={pose} aria-hidden />;
}

/** Round name and status, with the sentence on where the round stands. */
export function CycleIntro({ id, note }: { id: string; note?: string }) {
  return <div className={styles.intro}>
    <CycleBrand id={id} />
    <p>{note ?? cycleNote()}</p>
  </div>;
}

export function CycleTab({ view, current }: { view: "results" | "activity" | "verify"; current: string }) {
  return <Link href={cycleHref(view)} scroll={false} className={base.tab} aria-current={current === ACTIVE_CYCLE.id ? "page" : undefined}>
    {ACTIVE_CYCLE.label}<span className={styles.tabDot} aria-hidden /><span className="sr-only"> · In progress</span>
  </Link>;
}

export function CycleTimeline({ outcome = false, now }: { outcome?: boolean; now?: number }) {
  const phase = cyclePhase(ACTIVE_CYCLE, now);
  const windows = cycleWindows();
  const stages = windows.map((w) => ({ ...w, dates: cycleDateRange(w.start, w.end) }));
  if (outcome) stages.push({ label: "Results", start: "", end: "", dates: "Awaiting publication" });
  // Between windows nothing is open, so the stepper points at the one that opens next. Results are never inferred.
  const next = phase.step === -1 && phase.passed < windows.length ? phase.passed : -1;
  return <>
    <ol className={styles.timeline} data-outcome={outcome || undefined} aria-label={`${ACTIVE_CYCLE.label} schedule`}>
      {stages.map((stage, i) => <li key={stage.label} data-passed={i < phase.passed || undefined} data-active={phase.step === i || undefined} data-next={next === i || undefined} aria-current={phase.step === i ? "step" : undefined}>
        <span className={styles.track} aria-hidden><span className={styles.step}>{i < phase.passed ? <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.4l2.3 2.3 4.7-5.2" /></svg> : String(i + 1).padStart(2, "0")}</span></span>
        <div className={styles.stageText}><span className={styles.stageLabel}><span className={styles.stageName}>{stage.label}{i < phase.passed ? <span className="sr-only"> · closed</span> : next === i ? <span className="sr-only"> · next</span> : null}</span>{phase.step === i ? <span className={styles.now}>Now</span> : next === i ? <span className={styles.now} aria-hidden>Next</span> : null}</span><strong>{stage.dates}</strong></div>
      </li>)}
    </ol>
    <div className={styles.calendarNote}>
      <span>Deadlines at {cycleDeadline()}</span>
      <a href={ACTIVE_CYCLE.source} target="_blank" rel="noreferrer">FPF calendar <span aria-hidden>↗</span></a>
    </div>
  </>;
}

function ZcashSeal() {
  return <div className={styles.seal}>
    <span className={styles.sealOrbit} aria-hidden />
    <div className={styles.sealCoin}><ZcashMark /></div>
    <span className={styles.sealClock} aria-hidden><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
  </div>;
}

const PENDING_COPY = {
  results: { title: "The decision is still ahead", after: "Awaiting the published result", text: "Coinholders will decide which proposals receive funding." },
  activity: { title: "Voting activity comes next", after: "Awaiting voting data", text: "Voting activity will appear here when a verified data source is available for this round." },
  verify: { title: "Verification follows the vote", after: "Awaiting the published tally", text: "The published tally and voting data will be available to check here." },
} as const;

export function PendingCycle({ view, now }: { view: keyof typeof PENDING_COPY; now?: number }) {
  const phase = cyclePhase(ACTIVE_CYCLE, now);
  const copy = PENDING_COPY[view];
  const voteStarted = !phase.beforeVoting;
  return <CycleCard labelledBy="pending-title">
    <div className={styles.pendingHero}>
      <div className={styles.pendingCopy}>
        <div className={styles.identity}><span>{ACTIVE_CYCLE.label}</span><CycleStatus label={phase.label} /></div>
        <h2 id="pending-title">{voteStarted ? copy.after : copy.title}</h2>
        <p>{voteStarted && view === "results" ? "Results will appear here once officially published." : copy.text}</p>
        <Link href={ACTIVE_CYCLE.href} className={styles.action}>Explore proposals <span aria-hidden>→</span></Link>
      </div>
      <div className={styles.illustration}><ZcashSeal /></div>
    </div>
    <CycleTimeline outcome now={now} />
  </CycleCard>;
}

export function CurrentCycle({ fund = false }: { fund?: boolean }) {
  return <CycleCard labelledBy="active-cycle-title">
    <div className={styles.compactHead}>
      <CycleIntro id="active-cycle-title" note={fund ? "Funding awaits the vote. Current requests are not approved commitments." : undefined} />
      <CycleScene />
      <div className={styles.links}><Link href={ACTIVE_CYCLE.href}>View proposals <span aria-hidden>→</span></Link><Link href={cycleHref("results")}>Follow the round <span aria-hidden>→</span></Link></div>
    </div>
    <CycleTimeline />
  </CycleCard>;
}
