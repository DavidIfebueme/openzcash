"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startAuthentication, type PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { passkeyErrorMessage, passkeyFetch, requirePasskeyBrowser } from "@/lib/participate/workspace/auth/passkey-client";
import { decisionChallenge, decisionHash, type DecisionChoice, type DecisionEnvelope, type DecisionRound, type tallyDecisions } from "@/lib/participate/workspace/decisions/format";
import { WorkspaceSignInButton } from "@/components/participate/workspace/workspace-auth";
import { AccountAvatar } from "@/components/participate/workspace/workspace-account";
import { CommitteeDecisionRule, CommitteeCountingHelp } from "@/components/participate/workspace/committee-decision-rule";

type State = {
  scopeKind?: "COMMITTEE" | "DAO";
  abandonment?: { reason: string; occurredAt: string } | null;
  sourceWithdrawal?: { url: string; checkedAt: string } | null;
  round: DecisionRound | null; roundHash?: string; canManage: boolean; canCreate: boolean;
  canSign?: boolean; signingError?: string | null; myChoice?: DecisionChoice | null;
  tally?: ReturnType<typeof tallyDecisions>; roster: { label: string; ready: boolean }[];
  ballots?: { voterId: string; choice: DecisionChoice; recordedAt: string; rationale?: string | null; avatar?: string | null }[];
  defaults?: { quorum: number; approvalPercent: number; durationHours: number | null } | null;
};
const labels = { APPROVE: "Approve", REJECT: "Reject", ABSTAIN: "Abstain" };
const outcomes: Record<string, string> = { OPEN: "Open", APPROVED: "Approved", REJECTED: "Rejected", QUORUM_NOT_MET: "Quorum not met" };
const messages: Record<string, string> = {
  DECISION_ROSTER_NOT_READY: "Every reviewer needs a verified email and an active passkey before opening.",
  DECISION_ALREADY_EXISTS: "A round already exists for this revision. Refresh to view it.",
  DECISION_REVISION_CHANGED: "A newer revision is available. Open its record before starting a review.",
  DECISION_INVALID_QUORUM: "Quorum cannot exceed the number of reviewers.",
  DECISION_INVALID_POLICY: "Committee reviews require 3 approvals from 5 members. Refresh to use the current rules.",
  DECISION_FIVE_MEMBERS_REQUIRED: "Set up exactly five voting members before opening a committee review.",
  DECISION_INVALID_INPUT: "Check the round settings and try again.",
  DECISION_REFRESH_REQUIRED: "The record changed. Refresh before trying again.",
  DECISION_ALREADY_SIGNED: "Your decision is already signed.",
  PROPOSAL_ABANDONED: "The author abandoned this proposal. Existing signatures stay available; further review is closed.",
  PROPOSAL_SOURCE_WITHDRAWN: "This application was withdrawn on GitHub. Further review is closed; preserved files and signatures remain available.",
  DECISION_CLOSED: "This round has closed.",
  DECISION_NOT_ELIGIBLE: "Only the reviewers fixed at opening can sign.",
  DECISION_KEY_UNAVAILABLE: "None of your passkeys from this round is active. A new key cannot replace a frozen key.",
  DECISION_VERIFIED_ACCOUNT_REQUIRED: "A verified email account is required. Demo profiles cannot sign.",
  DECISION_UNAVAILABLE: "Signed reviews are temporarily unavailable. Please try again.",
  COMMITTEE_NOT_ENABLED: "Committee decisions are awaiting authorization.",
  DECISION_MANAGER_REQUIRED: "Only this workspace’s managers can open a review.",
  DECISION_RATIONALE_REQUIRED: "Write a public reason of 10–4,000 characters before signing."
};
const formatTime = (value: string) => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC";
const explain = (error: unknown) => error instanceof Error && messages[error.message] ? messages[error.message] : passkeyErrorMessage(error);

export function SignedDecision({ endpoint, revision, initiallyOpen = false, visible = true, onChanged }: { endpoint: string; revision: number; sessionKey?: string; initiallyOpen?: boolean; visible?: boolean; onChanged?: () => void | Promise<void> }) {
  const [open, setOpen] = useState(initiallyOpen), [data, setData] = useState<State | null>(null);
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [choice, setChoice] = useState<DecisionChoice | "">(""), [notice, setNotice] = useState("");
  const [embedded, setEmbedded] = useState(false);
  const [receiptHash, setReceiptHash] = useState("");
  const [rationale, setRationale] = useState("");
  const inFlight = useRef(false), generation = useRef(0);
  const url = `${endpoint}/decisions`;
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    try { const next = await passkeyFetch<State>(`${url}?revision=${revision}`, undefined, "GET"); if (current === generation.current) { setData(next); setError(""); } }
    catch (cause) { if (current === generation.current) { setData(null); setError(explain(cause)); } }
    finally { if (current === generation.current) setLoading(false); }
  }, [url, revision]);
  // Keep choices and rationale while switching cards, but refresh permissions on return.
  useEffect(() => {
    if (!open || !visible) return;
    const guard = generation;
    const initial = window.setTimeout(() => {
      setEmbedded(window.self !== window.top); setLoading(true); setError(""); void refresh();
    }, 0);
    return () => { window.clearTimeout(initial); guard.current++; };
  }, [open, visible, refresh]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const form = new FormData(event.currentTarget);
      await passkeyFetch(url, { revision, ...(data?.scopeKind === "COMMITTEE" ? { policy: "ZCG_MAJORITY" } : { quorum: Number(form.get("quorum")), approvalPercent: Number(form.get("approval")), durationHours: Number(form.get("hours")) }) });
      setNotice("Round opened. Participants, keys and rules are fixed."); await refresh(); await onChanged?.();
    } catch (cause) { setError(explain(cause)); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function sign() {
    if (!data?.round || !choice || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try {
      requirePasskeyBrowser();
      const roundUrl = `${url}/${data.round.id}`;
      const reason = data.round.schema !== "PARTICIPATE_DECISION_ROUND_V1" ? rationale.trim() : undefined;
      const ceremony = await passkeyFetch<{ options: PublicKeyCredentialRequestOptionsJSON; ceremonyId: string; envelope: DecisionEnvelope; roundHash: string }>(roundUrl, { action: "prepare", choice, ...(reason !== undefined ? { rationale: reason } : {}) });
      if (ceremony.envelope.choice !== choice || ("rationale" in ceremony.envelope ? ceremony.envelope.rationale : undefined) !== reason || ceremony.roundHash !== data.roundHash || ceremony.envelope.roundHash !== await decisionHash(data.round) || ceremony.options.challenge !== await decisionChallenge(ceremony.envelope)) throw new Error("DECISION_REFRESH_REQUIRED");
      const credential = await startAuthentication({ optionsJSON: ceremony.options });
      await passkeyFetch(roundUrl, { action: "sign", ceremonyId: ceremony.ceremonyId, credential });
      setChoice(""); setRationale(""); setReceiptHash(""); setNotice("Decision signed. Your public receipt is ready."); await refresh(); await onChanged?.();
    } catch (cause) { setError(explain(cause)); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function download() {
    if (!data?.round || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const receipt = await passkeyFetch<unknown>(`${url}/${data.round.id}`, undefined, "GET");
      const hash = await decisionHash(receipt);
      const blob = URL.createObjectURL(new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = blob; link.download = `decision-${data.round.id}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(blob), 1000); setReceiptHash(hash);
    } catch (cause) { setError(explain(cause)); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const round = data?.round, tally = data?.tally;
  const committee = data?.scopeKind === "COMMITTEE";
  const untimed = round?.schema === "PARTICIPATE_DECISION_ROUND_V4";
  const fixedMajority = round?.schema === "PARTICIPATE_DECISION_ROUND_V3" || untimed;
  const reasonRequired = round?.schema === "PARTICIPATE_DECISION_ROUND_V2" || fixedMajority;
  return <details className="signed-decision" open={open} onToggle={event => { if (event.target === event.currentTarget) setOpen(event.currentTarget.open); }}>
    <summary>Signed review <span>Pilot</span></summary>
    {open ? <div className="signed-decision-body">
      {loading ? <p role="status">Loading signed review…</p> : null}
      {error ? <p className="dao-form-error" role="alert">{error} <button type="button" className="dao-text-button" disabled={busy} onClick={() => void refresh()}>Refresh</button></p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {data?.abandonment ? <p className="signed-decision-note">The author abandoned this proposal. Further review is closed; existing signatures are preserved.</p> : null}
      {data?.sourceWithdrawal ? <p className="signed-decision-note">Withdrawn on GitHub. Further review is closed; preserved files and signatures remain available. <a href={data.sourceWithdrawal.url} target="_blank" rel="noreferrer">View source ↗</a></p> : null}
      {data && !round && !data.abandonment && !data.sourceWithdrawal ? <>
        {committee ? <CommitteeDecisionRule /> : <p>No review is open for revision {revision}.</p>}
        {data.canManage ? <form onSubmit={create}>
          <div className="signed-decision-roster"><strong>{committee ? `${data.roster.length} of 5 seats assigned` : `${data.roster.length} ${data.roster.length === 1 ? "reviewer" : "reviewers"}`}</strong><span>{data.roster.filter(p => p.ready).length} ready</span></div>
          {committee ? <ul className="signed-member-list signed-member-list--setup" aria-label="Review members">{data.roster.map((p, i) => <li key={i}><AccountAvatar name={p.label} /><span><strong>{p.label}</strong><small>{p.ready ? "Ready to vote" : "Needs verified email + passkey"}</small></span><b className="signed-member-status">{p.ready ? "Ready" : "Not ready"}</b></li>)}{Array.from({ length: Math.max(0, 5 - data.roster.length) }, (_, i) => <li key={`empty-${i}`} className="signed-member-unassigned"><span className="signed-member-seat" aria-hidden="true">{data.roster.length + i + 1}</span><span>Unassigned seat</span></li>)}</ul> : <details><summary>Reviewer readiness</summary><ul>{data.roster.map((p, i) => <li key={i}>{p.label} · {p.ready ? "Ready" : "Verified email and passkey required"}</li>)}</ul><p>Owners, coordinators and reviewers vote. Moderators do not. The roster locks at opening.</p></details>}
          {!committee ? <div className="signed-decision-fields">
            <label>Quorum<input name="quorum" type="number" min="1" max={data.roster.length || 1} defaultValue={data.defaults?.quorum ?? Math.max(1, Math.ceil(data.roster.length * 0.4))} required disabled={busy} /><small>Signed reviewers</small></label>
            <label>Approval<input name="approval" type="number" min="1" max="100" defaultValue={data.defaults?.approvalPercent ?? 67} required disabled={busy} /><small>% of approve + reject</small></label>
            <label>Duration<input name="hours" type="number" min="1" max="720" defaultValue={data.defaults?.durationHours ?? 24} required disabled={busy} /><small>Hours</small></label>
          </div> : null}
          {committee ? <CommitteeCountingHelp /> : <details className="signed-decision-rules"><summary>Counting rules</summary><p>Abstentions count for quorum. Approval uses approve + reject only. One final choice per reviewer; rules lock when opened. Pilot reviews do not change published ZCG outcomes.</p></details>}
          {!data.canCreate ? <p className="signed-decision-note">{committee ? "All five seats need a verified account and passkey before opening. Configure them in Members." : "Verified accounts and passkeys are required to open a review."}</p> : null}
          <button type="submit" className="dao-button" disabled={busy || !data.canCreate}>{busy ? "Opening…" : "Open signed review"}</button>
        </form> : <p className="signed-decision-note">No signed review for this revision yet. Workspace managers can open one.</p>}
      </> : round && tally ? <>
        <header className="signed-decision-heading"><div><strong>{round.proposal.title}</strong><p>Revision {round.proposal.revision} · Independent pilot</p></div><span className="signed-decision-status">{data?.abandonment || data?.sourceWithdrawal ? "Review stopped" : outcomes[tally.outcome]}</span></header>
        {fixedMajority ? <div className="signed-majority-progress"><div><strong>{tally.approve} <span>/ 3 approvals</span></strong><span>{tally.thresholdMet ? "Approval threshold reached" : `${3 - tally.approve} more needed`}</span></div><div className="signed-member-meter" role="img" aria-label={`${tally.approve} approve, ${tally.reject} reject, ${tally.abstain} abstain, ${tally.eligible - tally.signed} pending`}>{round.members.map(member => <span key={member.id} data-choice={data?.ballots?.find(ballot => ballot.voterId === member.id)?.choice ?? "PENDING"} />)}</div><p>{tally.signed} of 5 responded · {tally.reject} reject · {tally.abstain} abstain</p></div> : <div className="signed-decision-counts"><span><strong>{tally.approve}</strong> Approve</span><span><strong>{tally.reject}</strong> Reject</span><span><strong>{tally.abstain}</strong> Abstain</span><span><strong>{tally.signed}/{tally.eligible}</strong> Signed</span></div>}
        <p>{fixedMajority ? "3 of 5 approvals required" : `Quorum ${round.rules.quorum} · Approval ≥${round.rules.approvalPercent}% of approve + reject`} · {round.closesAt === null ? "No deadline" : <>{data?.abandonment ? "Original deadline" : tally.outcome === "OPEN" ? "Closes" : "Closed"} {formatTime(round.closesAt)}</>}</p>
        {untimed && !data?.abandonment && !data?.sourceWithdrawal && tally.signed < tally.eligible ? <p className="signed-decision-note">Waiting for {tally.eligible - tally.signed} {tally.eligible - tally.signed === 1 ? "member" : "members"}. The result is published after all 5 votes.</p> : null}
        <ul className="signed-member-list" aria-label="Member decisions">{round.members.map(member => { const ballot = data?.ballots?.find(b => b.voterId === member.id); return <li key={member.id}><AccountAvatar name={member.label} src={ballot?.avatar} /><div className="signed-member-content"><div><strong>{member.label}</strong><b className="signed-member-status" data-choice={ballot?.choice}>{ballot ? labels[ballot.choice] : "Pending"}</b></div>{ballot ? <details><summary>Read reason</summary><p>{ballot.rationale ?? "Legacy signature without a linked reason."}</p><small>{formatTime(ballot.recordedAt)} · Signed</small></details> : null}</div></li>; })}</ul>
        {data?.canSign ? embedded ? <p className="signed-decision-note">Signing is not available in this embedded pilot.</p> : <div className="signed-decision-confirm">
          <fieldset disabled={busy}><legend>1. Your decision</legend>{(Object.keys(labels) as DecisionChoice[]).map(value => <label key={value}><input type="radio" name={`decision-${round.id}`} value={value} checked={choice === value} onChange={() => setChoice(value)} />{labels[value]}</label>)}</fieldset>
          {reasonRequired ? <label className="signed-decision-rationale">Public reason<textarea value={rationale} onChange={event => setRationale(event.target.value)} minLength={10} maxLength={4000} rows={4} disabled={busy} placeholder="Explain your decision, including any concerns or conflict of interest." /><small>{rationale.trim().length.toLocaleString("en")} / 4,000 characters · minimum 10</small></label> : null}
          <p>Your choice{reasonRequired ? ", reason" : ""} and verification key become public. Your email stays private. This cannot be changed.</p>
          <button type="button" className="dao-button dao-button--primary" disabled={!choice || busy || (reasonRequired && rationale.trim().length < 10)} onClick={() => void sign()}>{busy ? "Confirm on your device…" : "Sign with passkey"}</button>
        </div> : data?.myChoice ? <p className="signed-decision-note">You signed: <strong>{labels[data.myChoice]}</strong>.</p> : data?.signingError === "DECISION_SIGN_IN_REQUIRED" && tally.outcome === "OPEN" ? <WorkspaceSignInButton label="Sign in to review" className="dao-button" /> : data?.signingError && tally.outcome === "OPEN" ? <p className="signed-decision-note">{messages[data.signingError] ?? "Signing is unavailable in this session."}</p> : null}
        <div className="signed-decision-tools"><button type="button" className="dao-text-button" disabled={busy} onClick={() => void download()}>Download receipt ↓</button><button type="button" className="dao-text-button" disabled={busy || loading} onClick={() => void refresh()}>Refresh</button></div>
        {fixedMajority ? <CommitteeCountingHelp timed={!untimed} /> : null}
        <details className="signed-decision-proof"><summary>Signatures & verification</summary>
          <p>Checks proposal files, signatures and the declared quorum. The roster, receipt time and complete vote inventory still depend on the operator. This receipt has no Zcash anchor yet.</p>
          <p>Round fingerprint</p><code>{data?.roundHash}</code>
          <a className="dao-text-button" href="/verify/decision-verify.mjs" download>Download verifier ↓</a>
          <p>Run locally with Node.js 22+:</p><pre>{`node decision-verify.mjs decision-${round.id}.json --round-hash ${data?.roundHash}${receiptHash ? ` --hash ${receiptHash}` : ""}`}</pre>
          {receiptHash ? <><p>Downloaded receipt fingerprint</p><code>{receiptHash}</code></> : null}
        </details>
      </> : null}
    </div> : null}
  </details>;
}
