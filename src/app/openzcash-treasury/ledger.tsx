"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { treasuryCopy } from "@/lib/openzcash-treasury/content";
import { treasuryFeedSchema, type TreasuryFeed } from "@/lib/openzcash-treasury/ledger";
import { zatoshisToZecString } from "@/lib/zcash/units";
import { TreasuryTransactions } from "./transactions";
import { IncomingIcon, OutgoingIcon } from "./treasury-icons";
import { TreasuryVault } from "./treasury-vault";
import styles from "./treasury.module.css";

export function TreasuryLedger({ initialFeed }: { initialFeed: TreasuryFeed }) {
  const [feed, setFeed] = useState(initialFeed);
  const t = treasuryCopy;
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch("/api/openzcash-treasury", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]) });
        if (!response.ok) throw new Error("Treasury unavailable");
        const next = treasuryFeedSchema.parse(await response.json());
        if (active) setFeed((previous) => next.snapshot || !previous.snapshot ? next : { status: "error", snapshot: previous.snapshot });
      } catch {
        if (active) setFeed((previous) => ({ status: "error", snapshot: previous.snapshot }));
      } finally {
        if (active) timer = setTimeout(refresh, 15_000);
      }
    }
    void refresh();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, []);

  const snapshot = feed.snapshot;
  const status = { unavailable: t.syncPending, syncing: t.syncing, synced: t.synced, stale: t.stale, error: t.syncError }[feed.status];
  const number = (value: string | undefined) => value === undefined ? <><span aria-hidden="true">—</span><span className="sr-only">{t.unavailable}</span></> : zatoshisToZecString(BigInt(value));
  // The stylesheet fits the headline balance to one line from this count (.balanceHero).
  const balanceChars = snapshot ? zatoshisToZecString(BigInt(snapshot.balanceZatoshis)).length : 1;
  return <section className={styles.ledger} aria-labelledby="treasury-overview">
    <div className={styles.ledgerHead}>
      <h2 id="treasury-overview">{t.overview}</h2>
      <span className={styles.status} data-status={feed.status} role="status">{status}</span>
    </div>
    <div className={styles.balanceHero}>
      <dl className={styles.balance}><dt>{t.balance}</dt><dd style={{ "--balance-chars": balanceChars } as CSSProperties}>{number(snapshot?.balanceZatoshis)}<span className={styles.currency}>ZEC</span></dd></dl>
      <TreasuryVault />
    </div>
    <dl className={styles.flows}>
      {[{ label: t.received, amount: snapshot?.receivedZatoshis }, { label: t.spent, amount: snapshot?.spentZatoshis }].map(({ label, amount }, i) => <div key={label}>
        <dt><span className={styles.directionIcon} data-direction={i === 0 ? "incoming" : "outgoing"}>{i === 0 ? <IncomingIcon /> : <OutgoingIcon />}</span>{label}</dt>
        <dd>{number(amount)}<span>ZEC</span></dd>
      </div>)}
    </dl>
    {snapshot && <div className={styles.syncDetails}>
      <span>{t.block} {snapshot.syncedHeight.toLocaleString("en-US")}</span>
      <time dateTime={snapshot.syncedAt}>{new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(snapshot.syncedAt))} UTC</time>
    </div>}
    <TreasuryTransactions transactions={snapshot?.transactions ?? null} />
    {snapshot && <details className={styles.syncSource}>
      <summary>{t.syncSource}</summary>
      <p>{t.flowNote}</p>
      <p>{t.scanFrom} {snapshot.scanStartHeight.toLocaleString("en-US")} · {snapshot.source}</p>
      <a href="/api/openzcash-treasury" target="_blank" rel="noopener noreferrer">{t.openData} ↗</a>
    </details>}
  </section>;
}
