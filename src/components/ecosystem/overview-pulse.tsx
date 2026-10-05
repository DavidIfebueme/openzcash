"use client";

import { useState } from "react";
import Link from "next/link";
import type { buildEcosystemOverview } from "@/lib/ecosystem/overview";
import { displayDate } from "@/lib/ecosystem/catalog";
import styles from "./overview.module.css";

type Overview = ReturnType<typeof buildEcosystemOverview>;
export function OverviewPulse({ windows }: { windows: Overview["windows"] }) {
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const window = windows[period];
  const zero = window.measuredRepositories - window.activeRepositories;
  const share = (value: number) => `${window.totalRepositories ? value / window.totalRepositories * 100 : 0}%`;
  return <section className={styles.pulse} aria-labelledby="code-activity-title">
    <div className={styles.panelHeading}><h2 id="code-activity-title">Code activity</h2><div className={styles.periods} role="group" aria-label="Activity window">
      {([7, 30, 90] as const).map(days => <button key={days} type="button" aria-pressed={period === days} onClick={() => setPeriod(days)}>{days}d</button>)}
    </div></div>
    <div className={styles.pulseReading} aria-live="polite"><strong>{window.activeRepositories}</strong><div><b>repositories with commits</b><span>of {window.totalRepositories} non-fork repositories · past {period} days</span></div></div>
    <div className={styles.activityBar} aria-hidden="true">
      <span className={styles.activeBar} style={{ width: share(window.activeRepositories) }} />
      <span className={styles.quietBar} style={{ width: share(zero) }} />
      <span className={styles.unknownBar} style={{ width: share(window.unmeasuredRepositories) }} />
    </div>
    <ul className={styles.legend}>
      <li><i className={styles.activeDot}/><b>{window.activeRepositories}</b> with commits</li>
      <li><i className={styles.quietDot}/><b>{zero}</b> no commits observed</li>
      {window.unmeasuredRepositories > 0 && <li><i className={styles.unknownDot}/><b>{window.unmeasuredRepositories}</b> unavailable</li>}
    </ul>
    <div className={styles.pulseFooter}><span>{displayDate(window.since)} – {displayDate(window.end)}</span><Link href="/development">Inspect repositories <span aria-hidden="true">↗</span></Link></div>
  </section>;
}
