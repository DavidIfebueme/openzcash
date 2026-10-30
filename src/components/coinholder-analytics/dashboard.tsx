"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CoinholderActivityChart } from "./coinholder-activity";
import type { CoinholderDashboard, CoinholderRefresh } from "@/lib/coinholder/analytics/model";

const counts = new Intl.NumberFormat("en-US");
const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const timestamp = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: "UTC" });

function External({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}<span aria-hidden="true"> ↗</span></a>;
}

/** Refreshes carry current source checks without downloading the historical series again. */
export function mergeCoinholderRefresh(previous: CoinholderDashboard, next: CoinholderDashboard | CoinholderRefresh): CoinholderDashboard {
  return {
    ...next,
    activity: "activityOmitted" in next ? previous.activity : next.activity,
    revealHistory: "activityOmitted" in next ? previous.revealHistory : next.revealHistory,
  };
}

export function CoinholderDashboardView({ initial, embedded = false, navigation }: { initial: CoinholderDashboard; embedded?: boolean; navigation?: ReactNode }) {
  const [data, setData] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBallot, setSelectedBallot] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    if (inFlight.current || document.visibilityState === "hidden") return;
    const controller = new AbortController();
    inFlight.current = controller;
    setRefreshing(true);
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch("/api/coinholders/activity?history=omit", { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Source refresh unavailable");
      const next = await response.json() as CoinholderDashboard | CoinholderRefresh;
      if (next.round?.id !== initial.round.id || !Array.isArray(next.proposals) || !next.source?.checkedAt) throw new Error("Invalid round response");
      if (mounted.current) {
        setData(previous => mergeCoinholderRefresh(previous, next));
        setNow(Date.now());
        setError(null);
      }
    } catch {
      if (mounted.current) setError("Couldn’t refresh the sources. Showing the last available data.");
    } finally {
      window.clearTimeout(timeout);
      inFlight.current = null;
      if (mounted.current) setRefreshing(false);
    }
  }, [initial.round.id]);

  useEffect(() => {
    mounted.current = true;
    const updateClock = () => setNow(Date.now());
    const clock = window.setInterval(updateClock, 15_000);
    const poll = window.setInterval(() => { void refresh(); }, 60_000);
    const resume = () => {
      if (document.visibilityState === "visible") { updateClock(); void refresh(); }
    };
    document.addEventListener("visibilitychange", resume);
    return () => {
      mounted.current = false;
      inFlight.current?.abort();
      window.clearInterval(clock);
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [refresh]);

  const ageSeconds = now === null ? null : Math.max(0, Math.floor((now - Date.parse(data.source.checkedAt)) / 1_000));
  const sourceLabel = data.source.state === "snapshot" || error ? "Saved snapshot" : "Sources matched";

  return <div className="coinholder-analytics"><div className="coin-workspace">
    <header className="coin-header" data-embedded={embedded || undefined}>
      {embedded ? navigation : <div><h1>Coinholder activity</h1><p>Q3 2026 <span aria-hidden="true">/</span> Retroactive grants</p></div>}
      <div className="coin-source-control">
        <span className="coin-badge coin-badge--final">Finalized</span>
        <button type="button" className="coin-refresh" disabled={refreshing} onClick={() => void refresh()} aria-label="Refresh Coinholder sources" title="Refresh sources">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 12-1l2 2M4 16l2 2a7 7 0 0 0 12-1" /></svg>
        </button>
        <small title={`Last source check: ${timestamp.format(new Date(data.source.checkedAt))} UTC`}>
          <span role="status">{refreshing ? "Checking sources…" : sourceLabel}</span>
          {!refreshing && ageSeconds !== null ? <span> · {ageSeconds < 60 ? `${ageSeconds}s` : `${Math.floor(ageSeconds / 60)}m`} ago</span> : null}
        </small>
      </div>
    </header>
    {error || data.source.warning ? <p className="coin-warning" role="status">{error ?? data.source.warning} <span>Snapshot: {timestamp.format(new Date(data.source.snapshotFetchedAt))} UTC.</span></p> : null}
    <div className="coin-analysis-grid">
      <CoinholderActivityChart activity={data.activity} revealHistory={data.revealHistory} proposals={data.proposals} selectedBallot={selectedBallot} onSelectBallot={setSelectedBallot} />
    </div>
    <footer className="coin-provenance">
      <p><span className="coin-source-dot" aria-hidden="true" />Q3 2026 · Final results</p>
      <div>
        <Link href="/coinholders/results?round=q3-2026">Results</Link>
        <Link href="/coinholders">Program overview</Link>
        <External href={data.source.url}>Chain summary</External>
        <details>
          <summary>Source details</summary>
          <dl>
            <div><dt>Voting closed</dt><dd>{date.format(new Date(data.round.voteEndAt))} · {data.round.voteEndAt.slice(11, 16)} UTC</dd></div>
            <div><dt>Snapshot block</dt><dd>{counts.format(data.round.snapshotHeight)} · Zcash mainnet</dd></div>
            <div><dt>Counting rules</dt><dd><External href={data.rules.clarificationUrl}>Quorum and approval</External></dd></div>
            <div><dt>Last source check</dt><dd>{timestamp.format(new Date(data.source.checkedAt))} UTC</dd></div>
            <div><dt>Activity indexed</dt><dd>{data.activity ? `${timestamp.format(new Date(data.activity.fetchedAt))} UTC` : "Unavailable"}</dd></div>
            <div><dt>Reveals indexed</dt><dd>{data.revealHistory ? `${timestamp.format(new Date(data.revealHistory.fetchedAt))} UTC` : "Unavailable"}</dd></div>
            {data.revealHistory ? <div><dt>Reveal archive</dt><dd><External href={data.revealHistory.sourceUrl}>Archived final counters</External><br /><code>{data.revealHistory.sha256}</code></dd></div> : null}
            <div><dt>Round</dt><dd><code>{data.round.chainRoundId}</code></dd></div>
            <div><dt>Tally SHA-256</dt><dd><code>{data.source.sha256}</code></dd></div>
          </dl>
          <p>Casts are vote commitments accepted on the voting chain, not unique wallets or ZEC amounts. Revealed shares count published ballot portions by option, not their ZEC weight. The daily series uses archived state counters; ZEC weights appear only in the final tally. Source checks compare published totals; they do not independently verify the cryptographic tally.</p>
        </details>
      </div>
    </footer>
  </div></div>;
}
