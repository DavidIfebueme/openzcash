"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { CreditTopUp } from "@/components/participate/workspace/credit-topup";
import type { CreditScope } from "@/lib/participate/workspace/domain/credit-scope";
import type { AccountCreditsView, AccountCreditSummary } from "@/lib/participate/workspace/domain/participation-credits";
import { SUBMISSION_PRICE } from "@/lib/participate/workspace/domain/proposal-submission";

type CreditAccount = AccountCreditsView["accounts"][number];
const ERRORS: Record<string, string> = {
  VERIFIED_EMAIL_REQUIRED: "Sign in with your verified email to use free demo credits.",
  unauthorized: "Sign in again to view your credits.",
  ACCOUNT_UNAVAILABLE: "Your account is unavailable.",
  CREDIT_ACCOUNT_UNAVAILABLE: "A permanent account is required to use credits.",
  COMMUNITY_NOT_FOUND: "This community is no longer available to your account.",
  PARTICIPATION_OWNER_REQUIRED: "Only an account administrator can change this policy.",
  POLICY_OWNER_REQUIRED: "Only an account administrator can change this policy.",
  POLICY_PERSONAL_ACCOUNT_REQUIRED: "Demo profiles cannot change committee credit settings.",
  POLICY_CHANGED: "The policy has changed. Reload before saving.",
  PARTICIPATION_POLICY_CHANGED: "The policy has changed. Reload before saving.",
  CREDIT_FUNDING_UNAVAILABLE: "Zcash top-ups are not available yet.",
  CREDITS_SANDBOX_ONLY: "Demo Zcred are available only in the local preview.",
  PREVIEW_CREDITS_UNAVAILABLE: "Demo Zcred are unavailable here.",
  PARTICIPATION_CREDITS_UNAVAILABLE: "Credit payments are not available in this environment.",
  INVALID_PARTICIPATION_INPUT: "Use whole-number prices between 1 and 100 Zcred.",
  forbidden_origin: "Reload the page and try again."
};
const formatCount = new Intl.NumberFormat("en-US");
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });

export function CreditsIcon() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7h16a2 2 0 0 1 2 2v10H5a2 2 0 0 1-2-2V7Zm0 0V5a2 2 0 0 1 2-2h12v4" /><path d="M21 11h-5v4h5" /></svg>;
}

export function ParticipationCreditsDialog({ communityId, scope, onClose, restoreFocus }: { communityId?: string; scope?: CreditScope; onClose: () => void; restoreFocus?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected && previousFocus !== document.body) previousFocus.focus();
      else restoreFocus?.();
    };
  }, [restoreFocus]);

  return <dialog ref={dialog} className="dao-settings-dialog dao-credits-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onKeyDown={event => {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, a[href]"))
      .filter(element => element.getClientRects().length > 0);
    const first = controls[0]; const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <header className="dao-settings-heading"><h2 id={titleId}>Credits</h2><button type="button" className="dao-settings-close" aria-label="Close credits" disabled={busy} onClick={onClose}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></header>
    <ParticipationCreditsPanel communityId={communityId} scope={scope} onBusyChange={setBusy} />
  </dialog>;
}

export function ParticipationCreditsPanel({ communityId, scope, initialSummary, compact = false, onBusyChange }: { communityId?: string; scope?: CreditScope; initialSummary?: AccountCreditSummary | null; compact?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const router = useRouter();
  const [credits, setCredits] = useState<AccountCreditsView | null>(null);
  const [selectedId, setSelectedId] = useState(communityId ?? "");
  const [loading, setLoading] = useState(!initialSummary || initialSummary.balance === 0);
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);
  const [historyRequested, setHistoryRequested] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const committeeId = scope?.kind === "COMMITTEE" ? scope.id : undefined;
  const shouldLoad = !initialSummary || initialSummary.balance === 0 || historyRequested || reloadVersion > 0;
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);

  useEffect(() => {
    if (!shouldLoad) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(committeeId ? `/api/account/credits?communityId=${encodeURIComponent(committeeId)}` : "/api/account/credits", { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result?.credits) throw new Error(ERRORS[result?.error] ?? "Your credits could not be loaded.");
        if (!controller.signal.aborted) { setCredits(result.credits); setLoadFailed(false); setError(""); }
      } catch (cause) {
        if (!controller.signal.aborted) { setLoadFailed(true); setError(cause instanceof Error ? cause.message : "Your credits could not be loaded."); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [reloadVersion, committeeId, shouldLoad]);

  const accounts = credits?.accounts.filter(item => committeeId ? item.communityId === committeeId && item.kind === "COMMITTEE" : item.kind !== "COMMITTEE") ?? [];
  const account = accounts.find(item => item.communityId === selectedId) ?? accounts[0];
  const preview = !credits && !loadFailed && reloadVersion === 0 && initialSummary && (committeeId ? initialSummary.communityId === committeeId : initialSummary.kind !== "COMMITTEE") ? initialSummary : null;
  const toggleHistory = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    if (!historyOpen && !historyRequested && preview) { setHistoryRequested(true); setLoading(true); }
    setHistoryOpen(value => !value);
  };
  const isCommittee = account?.kind === "COMMITTEE";
  const sandbox = account?.sandbox ?? credits?.sandbox ?? false;
  const reload = useCallback(() => { setLoading(true); setReloadVersion(value => value + 1); }, []);
  useEffect(() => {
    window.addEventListener("dao:participation-updated", reload);
    return () => window.removeEventListener("dao:participation-updated", reload);
  }, [reload]);
  const changed = useCallback(() => { window.dispatchEvent(new CustomEvent("dao:credits-updated")); router.refresh(); }, [router]);
  const purchaseUpdated = useCallback(() => { changed(); reload(); }, [changed, reload]);

  async function claimPreview() {
    if (busy || loading || loadFailed || !account?.canClaimPreview) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/account/credits/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ communityId: account.communityId }) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.credits) { setError(ERRORS[result?.error] ?? "Demo Zcred could not be added. Please try again."); return; }
      // The claim is server-idempotent; a lost response can be retried safely.
      reload(); setNotice(result.replayed ? "Your demo Zcred have already been added." : "25 demo Zcred added."); changed();
    } catch { setError("The connection was interrupted. You can retry; demo Zcred are added only once."); }
    finally { setBusy(false); }
  }

  return <section className={`dao-credits-content${compact ? " dao-credits-inline" : ""}`} aria-label="Credits" aria-busy={loading || busy}>
      {loading && !preview ? <p role="status">Loading your credits…</p> : null}
      {preview ? <>
        <section className="dao-credit-balance" aria-label="Credit balance">
          <div className="dao-credit-balance-label"><span>{compact ? `${preview.communityName} credits` : "Available"}</span></div>
          <div className="dao-credit-total"><div className="dao-credit-amount"><strong>{formatCount.format(preview.balance)}</strong><span className="dao-credit-unit">Zcred</span></div>{compact ? <small>Available balance</small> : null}</div>
        </section>
        {compact ? <p className="dao-credit-intro">{preview.sandbox ? "Free demo credits" : "Use your credits"} for {preview.kind === "COMMITTEE" ? "proposals, comments and likes." : "comments and likes."}</p> : null}
        <div className="dao-credit-costs">{compact && preview.kind === "COMMITTEE" ? <span>Proposal<strong>{SUBMISSION_PRICE.credits} Zcred</strong></span> : null}<span>Comment<strong>{preview.mode === "FREE" ? "Free" : `${preview.commentCost} Zcred`}</strong></span><span>Like<strong>{preview.mode === "FREE" ? "Free" : `${preview.reactionCost} Zcred`}</strong></span></div>
        {preview.paymentReview ? <p className="dao-form-error" role="alert">A payment needs review. Credit spending is paused.</p> : null}
        <details className="dao-credit-section dao-credit-history" open={historyOpen}><summary onClick={toggleHistory}>{compact ? "Credit activity" : "History"}</summary>{historyRequested && historyOpen ? <p role="status">Loading credit activity…</p> : null}</details>
        {loading && !historyRequested ? <p role="status">Checking available credits…</p> : null}
      </> : null}
      {credits && account ? <>
        {isCommittee ? !compact ? <div className="dao-credits-scope"><strong>{account.communityName}</strong><span>Committee</span></div> : null : accounts.length > 1 ? <label className="dao-credits-community"><span className="dao-sr-only">Community</span><select value={account.communityId} disabled={busy || loading || loadFailed} onChange={event => { setSelectedId(event.target.value); setError(""); setNotice(""); }}>{accounts.map(item => <option key={item.communityId} value={item.communityId}>{item.communityName}</option>)}</select></label> : !compact ? <p className="dao-credits-community-name">{account.communityName}</p> : null}
        <section className="dao-credit-balance" aria-label="Credit balance">
          <div className="dao-credit-balance-label"><span>{compact ? `${account.communityName} credits` : "Available"}</span>{sandbox && !compact ? <span className="dao-credit-demo-label">Demo</span> : null}</div>
          <div className="dao-credit-total"><div className="dao-credit-amount"><strong>{loading ? "…" : loadFailed ? "Unavailable" : formatCount.format(account.balance)}</strong><span className="dao-credit-unit">Zcred</span></div>{compact ? <small>Available balance</small> : null}</div>
        </section>
        {compact ? <p className="dao-credit-intro">{sandbox ? "Free demo credits" : "Use your credits"} for {isCommittee ? "proposals, comments and likes." : "comments and likes."}</p> : null}
        <div className="dao-credit-costs">{compact && isCommittee ? <span>Proposal<strong>{SUBMISSION_PRICE.credits} Zcred</strong></span> : null}<span>Comment<strong>{account.mode === "FREE" ? "Free" : `${account.commentCost} Zcred`}</strong></span><span>Like<strong>{account.mode === "FREE" ? "Free" : `${account.reactionCost} Zcred`}</strong></span></div>
        {account.paymentReview ? <p className="dao-form-error" role="alert">A payment needs review. Credit spending is paused.</p> : null}
        {sandbox && account.canClaimPreview ? <div className="dao-credit-demo-allowance"><button className="dao-button dao-button--primary" type="button" disabled={busy || loading || loadFailed} onClick={claimPreview}>{busy ? "Adding…" : "Get 25 free Zcred"}</button><span>One-time allowance · No ZEC required</span></div> : null}
        {!sandbox ? <CreditTopUp key={account.communityId} communityId={account.communityId} scopeKind={account.kind} onCreditsChanged={purchaseUpdated} /> : !compact ? <p className="dao-credits-free-note">Demo Zcred are free. No payment required.</p> : null}
        <details className="dao-credit-section dao-credit-history" key={`history-${account.communityId}`} open={historyOpen}><summary onClick={toggleHistory}>{compact ? "Credit activity" : "History"}</summary>{credits.history.some(item => item.communityId === account.communityId) ? <ul>{credits.history.filter(item => item.communityId === account.communityId).map(item => <li key={item.id}><div><strong>{item.kind === "PREVIEW_GRANT" ? "Demo allowance" : item.kind === "ADMIN_DEMO_GRANT" ? "Demo credit top-up" : item.kind === "COMMENT" ? "Comment" : item.kind === "PURCHASE" ? "Zcash top-up" : item.kind === "PROPOSAL_SUBMISSION" ? "Proposal publication" : "Like"}</strong><time dateTime={item.createdAt}>{dateFormat.format(new Date(item.createdAt))} UTC</time></div><span className={item.delta > 0 ? "dao-credit-positive" : ""}>{item.delta > 0 ? "+" : "−"}{formatCount.format(Math.abs(item.delta))}</span></li>)}</ul> : <p>No activity yet.</p>}</details>
        {account.canManage ? <details className="dao-credit-section dao-credit-policy" key={`policy-${account.communityId}`}><summary>Settings</summary><CreditPolicyForm key={`${account.communityId}:${account.policyVersion}`} account={account} sandbox={sandbox} disabled={loading || loadFailed} onBusy={setBusy} onSaved={() => { setNotice("Settings saved."); changed(); reload(); }} /></details> : null}
        <details className="dao-credit-section dao-credit-help"><summary>{compact ? "About these credits" : "How it works"}</summary>
          <p>{sandbox ? "These demo credits are free and only work in this pilot. " : ""}Your balance is private and applies only to {account.communityName}. Credits do not affect {isCommittee ? "committee decisions" : "voting power"}.</p>
          <p>Removing or restoring a like is free after its first charge.</p>
          {!sandbox ? <p>Top-ups arrive after payment confirmation. Your invoice identifies the recipient.</p> : null}
        </details>
      </> : !preview && !error && !loading ? <p>No credit accounts yet.</p> : null}
      {error ? <div><p className="dao-form-error" role="alert">{error}</p>{loadFailed ? <button type="button" className="dao-button" disabled={loading} onClick={reload}>Try again</button> : null}</div> : null}
      {notice ? <p className="dao-notice" role="status">{notice}</p> : null}
    </section>;
}

function CreditPolicyForm({ account, sandbox, disabled, onBusy, onSaved }: { account: CreditAccount; sandbox: boolean; disabled: boolean; onBusy: (value: boolean) => void; onSaved: () => void }) {
  const id = useId();
  const [mode, setMode] = useState(account.mode);
  const [commentCost, setCommentCost] = useState(account.commentCost);
  const [reactionCost, setReactionCost] = useState(account.reactionCost);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dirty = mode !== account.mode || commentCost !== account.commentCost || reactionCost !== account.reactionCost;
  async function save(event: FormEvent) {
    event.preventDefault(); if (saving || disabled || !dirty) return;
    setSaving(true); onBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/communities/${encodeURIComponent(account.communityId)}/participation`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, commentCost, reactionCost, expectedVersion: account.policyVersion }) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.policy) { setError(ERRORS[result?.error] ?? "The policy could not be saved. Reload to check the latest settings."); return; }
      onSaved();
    } catch { setError("The connection was interrupted. Reopen credits to check the saved policy."); }
    finally { setSaving(false); onBusy(false); }
  }
  return <form className="dao-credit-policy-form" onSubmit={save}><label htmlFor={`${id}-mode`}>Discussion access</label><select id={`${id}-mode`} disabled={saving || disabled} value={mode} onChange={event => setMode(event.target.value as CreditAccount["mode"])}><option value="FREE">Free participation</option>{sandbox || account.fundingConfigured || mode === "CREDITS" ? <option value="CREDITS">Use credits{sandbox ? " · Demo" : ""}</option> : null}</select>
    {mode === "CREDITS" ? <><div className="dao-credit-price-fields"><label htmlFor={`${id}-comment`}>Zcred per comment<input id={`${id}-comment`} type="number" inputMode="numeric" min={1} max={100} step={1} value={commentCost} disabled={saving || disabled} onChange={event => setCommentCost(Number(event.target.value))} required /></label><label htmlFor={`${id}-reaction`}>Zcred per like<input id={`${id}-reaction`} type="number" inputMode="numeric" min={1} max={100} step={1} value={reactionCost} disabled={saving || disabled} onChange={event => setReactionCost(Number(event.target.value))} required /></label></div>{account.kind !== "COMMITTEE" ? <p>Invited ballot participants are sponsored.</p> : null}</> : null}
    <button className="dao-button" type="submit" disabled={saving || disabled || !dirty}>{saving ? "Saving…" : "Save policy"}</button>{error ? <p className="dao-form-error" role="alert">{error}</p> : null}
  </form>;
}
