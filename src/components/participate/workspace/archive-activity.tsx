"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { verifyActivityBundle } from "@/lib/participate/workspace/archive/activity";
import type { ActivityProofState } from "@/lib/participate/workspace/archive/activity-proof";

type ActivityItem = { id: string; sequence: number; label: string; origin: "LIVE" | "IMPORTED"; recordedAt: string; occurredAt: string;
  eventHash: string; state: ActivityProofState; stateLabel: string; actor: string; reason?: string;
  chain?: { network: string; txid: string; blockHeight: number; blockTime: string; confirmations: number; requiredConfirmations: number; checkedAt: string } | null };
type Page = { items: ActivityItem[]; nextBefore: number | null };
const date = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC";

export function ArchiveActivity({ endpoint, initiallyOpen = false, visible = true }: { endpoint: string; initiallyOpen?: boolean; visible?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen), [page, setPage] = useState<Page | null>(null);
  const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  const generation = useRef(0);
  const load = useCallback(async (before?: number) => {
    const current = ++generation.current;
    setBusy(true); setFailed(false);
    try {
      const response = await fetch(`${endpoint}/activity${before ? `?before=${before}` : ""}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Unavailable");
      const next = await response.json() as Page;
      if (current === generation.current) setPage(previous => ({ items: before ? [...previous?.items ?? [], ...next.items] : next.items, nextBefore: next.nextBefore }));
    } catch { if (current === generation.current) setFailed(true); }
    finally { if (current === generation.current) setBusy(false); }
  }, [endpoint]);
  useEffect(() => {
    if (!open || !visible) return;
    const guard = generation;
    const refresh = () => { void load(); };
    const initial = window.setTimeout(refresh, 0);
    window.addEventListener("dao:participation-updated", refresh);
    return () => { window.clearTimeout(initial); guard.current++; window.removeEventListener("dao:participation-updated", refresh); };
  }, [open, visible, load]);
  return <details className="proposal-activity" open={open} onToggle={event => {
    if (event.target !== event.currentTarget) return;
    const next = event.currentTarget.open;
    setOpen(next);
  }}>
    <summary>Activity & verification</summary>
    {open ? <div className="proposal-activity-content">
      <p className="proposal-activity-hint">Tags, discussion and completed reviews. Each event shows its own verification status.</p>
      <div className="proposal-activity-tools"><a href="/verify/activity-verify.mjs" download>Download verifier ↓</a><button type="button" className="dao-text-button" onClick={() => void load()} disabled={busy}>Refresh</button></div>
      {failed ? <p role="alert">Activity could not be loaded. <button type="button" className="dao-text-button" onClick={() => void load()}>Try again</button></p> : null}
      {busy ? <p role="status">Loading activity…</p> : null}
      {!busy && !failed && !page?.items.length ? <p>No recorded activity yet.</p> : null}
      <ol className="proposal-activity-list">{page?.items.map(item => <ActivityRow key={item.id} item={item} endpoint={endpoint} />)}</ol>
      {page?.nextBefore ? <button type="button" className="dao-text-button" disabled={busy} onClick={() => void load(page.nextBefore!)}>Earlier activity ↓</button> : null}
    </div> : null}
  </details>;
}

function ActivityRow({ item, endpoint }: { item: ActivityItem; endpoint: string }) {
  const [result, setResult] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  async function verify(file?: File) {
    if (!file) return;
    setResult(null); setChecking(true);
    try {
      if (file.size > 8_100_000) throw new Error("Too large");
      const { event } = await verifyActivityBundle(JSON.parse(await file.text()), item.eventHash);
      if (event.id !== item.id) throw new Error("Mismatch");
      setResult("Event and receipt contents match. Use the downloaded verifier for signatures and a fresh blockchain check.");
    } catch { setResult("This file does not match the recorded event."); }
    finally { setChecking(false); }
  }
  return <li>
    <div className="proposal-activity-row"><div><strong>{item.label}</strong><span>{date(item.occurredAt)}{item.origin === "IMPORTED" ? " · Imported history" : ""}</span></div>
      <span className={`proposal-activity-state${item.state === "VERIFIED" ? " is-verified" : ""}`}>{item.stateLabel}</span>
      <a href={`${endpoint}/activity/${item.id}?download=1`}>Receipt ↓</a>
    </div>
    {item.reason ? <p className="proposal-activity-reason">{item.reason}</p> : null}
    <details className="proposal-activity-verify"><summary>Verify</summary><div>
      <p>{item.actor} · Event {item.sequence}{item.origin === "IMPORTED" ? ` · Imported ${date(item.recordedAt)}` : ""}</p>
      {item.chain ? <dl className="proposal-activity-chain">
        <div><dt>Zcash {item.chain.network}</dt><dd>Block {item.chain.blockHeight.toLocaleString("en-US")} · {date(item.chain.blockTime)}</dd></div>
        <div><dt>Transaction</dt><dd><code>{item.chain.txid}</code></dd></div>
        <div><dt>Last check</dt><dd>{date(item.chain.checkedAt)} · {item.chain.confirmations} {item.chain.confirmations === 1 ? "confirmation" : "confirmations"} ({item.chain.requiredConfirmations} required)</dd></div>
      </dl> : null}
      <p>Compare a saved receipt with this fingerprint. Files stay off-chain; confirmed Zcash batches preserve their commitments.</p>
      <code>{item.eventHash}</code>
      <label className="dao-text-button">{checking ? "Checking…" : "Check receipt file"}<input type="file" accept=".json,application/json" disabled={checking} onChange={event => { void verify(event.target.files?.[0]); event.target.value = ""; }} /></label>
      {result ? <p role="status">{result}</p> : null}
      <p>Independent check with Node.js 22+:</p><pre><code>{`node activity-verify.mjs activity-${item.id}.json --hash ${item.eventHash}`}</code></pre>
      <p>For a receipt with chain evidence, add <code>--chain</code> using your own reader and node. Keep RPC credentials private.</p>
    </div></details>
  </li>;
}
