"use client";

import { useEffect, useState } from "react";
import type { DecisionState } from "./signed-decision";
import type { ProposalRecord } from "@/lib/participate/workspace/domain/proposal-record";
import type { ActivityProofState } from "@/lib/participate/workspace/archive/activity-proof";
import { zcgSourceMetadata } from "@/lib/participate/workspace/data/zcg-source-metadata";
import { proposalDraftErrors, proposalDraftFromCells, proposalSheetCells, proposalSheetCsv, proposalSheetTsv, sheetDateToIso, type ProposalSheetContext, type ProposalSheetDraft } from "@/lib/participate/proposal-sheet";

type ReviewEvent = { id: string; kind: string; review?: { roundId: string; revision: number; receiptHash: string }; state: ActivityProofState; chain?: { network: string; txid: string; checkedAt: string; confirmations: number; requiredConfirmations: number } | null };
const anchorLabels: Record<ActivityProofState, string> = { RECORDED: "Recorded · Not anchored", PREPARED: "Ready to anchor", CONFIRMING: "Confirming", VERIFIED: "Verified at last check", CHECK_REQUIRED: "Check required" };
async function read<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal });
  if (!response.ok) throw new Error("Unavailable");
  return response.json();
}

export function ReviewFinish({ endpoint, recordId, revision, roundId, visible }: { endpoint: string; recordId: string; revision: number; roundId: string | null; visible: boolean }) {
  const [snapshot, setSnapshot] = useState<{ state: DecisionState; record: ProposalRecord } | null>(null);
  const [anchor, setAnchor] = useState<ReviewEvent | null>(null), [anchorFailed, setAnchorFailed] = useState(false);
  const [failed, setFailed] = useState(false), [loading, setLoading] = useState(true), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    void (async () => {
      setLoading(true); setFailed(false); setAnchor(null); setAnchorFailed(false);
      try {
        const [state, result] = await Promise.all([read<DecisionState>(`${endpoint}/decisions?revision=${revision}`, controller.signal), read<{ record: ProposalRecord }>(`${endpoint}?revision=${revision}`, controller.signal)]);
        if (controller.signal.aborted) return;
        if (result.record.recordId !== recordId || result.record.revision !== revision || state.round && (state.round.id !== roundId || state.round.proposal.recordId !== recordId || state.round.proposal.revision !== revision)) throw new Error("Revision changed");
        setSnapshot({ state, record: result.record });
        if (state.publication === "PUBLISHED" && state.round) {
          try {
            const activity = await read<{ items: ReviewEvent[] }>(`${endpoint}/activity?round=${encodeURIComponent(state.round.id)}`, controller.signal);
            const event = activity.items.find(item => item.kind === "REVIEW_DECIDED" && item.review?.roundId === state.round!.id && item.review.revision === revision);
            if (!controller.signal.aborted) setAnchor(event ?? null);
          } catch { if (!controller.signal.aborted) setAnchorFailed(true); }
        }
      } catch { if (!controller.signal.aborted) { setFailed(true); setSnapshot(null); } }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [visible, endpoint, recordId, revision, roundId, attempt]);
  const state = snapshot?.state, tally = state?.tally;
  const complete = state?.publication === "PUBLISHED" && Boolean(state.round) && tally?.signed === 5 && tally.eligible === 5 && ["APPROVED", "REJECTED"].includes(tally.outcome);
  return <section className="review-finish" aria-label="Finish the review">
    <div className="review-finish-heading"><div><h3>Finish the review</h3><p>Publication, proof and the proposal register.</p></div><button type="button" className="dao-text-button" disabled={loading} onClick={() => setAttempt(value => value + 1)}>Refresh status</button></div>
    {loading ? <p role="status">Checking review…</p> : failed ? <p role="alert">Could not confirm this revision. Refresh to try again.</p> : !complete ? <div className="review-finish-pending"><strong>{state?.progress?.signed ?? tally?.signed ?? 0} of 5 responses recorded</strong><p>The fifth response publishes the result. Prepare the sheet row here after the review closes.</p></div> : <>
      <div className="review-finish-statuses">
        <section><span className="review-step-number">01</span><div><h4>Public result</h4><strong>{tally!.outcome === "APPROVED" ? "Approved" : "Rejected"} · 5 of 5 signed</strong><p>{tally!.approve} approve · {tally!.reject} reject · {tally!.abstain} abstain</p><a href={`/zcg/participate?record=${encodeURIComponent(recordId)}`}>View public card ↗</a><small>Independent pilot review</small></div></section>
        <section><span className="review-step-number">02</span><div><h4>Decision anchor</h4><strong>{anchorFailed ? "Status unavailable" : anchor ? anchorLabels[anchor.state] ?? "Check required" : "Receipt not linked yet"}</strong><p>{anchor?.chain ? `${anchor.chain.network} · ${anchor.chain.confirmations}/${anchor.chain.requiredConfirmations} confirmations` : "No confirmed chain proof for this review."}</p>{anchor ? <a href={`${endpoint}/activity/${encodeURIComponent(anchor.id)}?download=1`} download>Download proof ↓</a> : null}{anchor?.chain ? <small>Checked {new Date(anchor.chain.checkedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</small> : null}</div></section>
      </div>
      <ProposalSheetHandoff key={`${recordId}:${revision}:${roundId}`} record={snapshot!.record} />
    </>}
  </section>;
}

export function ProposalSheetHandoff({ record }: { record: ProposalRecord }) {
  const sourceUrl = record.sourceCapture?.proposal.proposalUrl ?? zcgSourceMetadata(record.recordId)?.url ?? `https://openzcash.org/zcg/participate?record=${encodeURIComponent(record.recordId)}`;
  const [context, setContext] = useState<ProposalSheetContext | null>(null), [draft, setDraft] = useState<ProposalSheetDraft | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  async function prepare() {
    setBusy(true); setError(""); setNotice(""); setConfirmed(false); setContext(null); setDraft(null);
    try {
      const response = await fetch(`/api/participate/sheet-handoff?proposalUrl=${encodeURIComponent(sourceUrl)}`, { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 409 ? "The sheet columns changed. Check the register before preparing a row." : "Could not check the proposal register. Try again.");
      const next = await response.json() as ProposalSheetContext;
      const source = record.sourceCapture?.proposal;
      setContext(next);
      setDraft(next.match ? proposalDraftFromCells(next.match.cells) : { submitted: sheetDateToIso((source?.submittedAt ?? record.submittedAt ?? "").slice(0, 10)), title: source?.title ?? record.title, applicant: record.application?.applicant ?? source?.applicant ?? "", platformUrl: sourceUrl, forumUrl: "", status: "", decided: record.originalDecisionDate ?? "" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not prepare the row."); }
    finally { setBusy(false); }
  }
  const errors = draft ? proposalDraftErrors(draft) : [];
  const ready = Boolean(context && draft && context.matchCount <= 1 && confirmed && !errors.length && !busy);
  const target = context?.match ? `A${context.match.row}:G${context.match.row}` : "A:G of a new row";
  const sheetHref = context ? `${context.sheetUrl}${context.match ? `&range=A${context.match.row}%3AG${context.match.row}` : ""}` : undefined;
  function change(field: keyof ProposalSheetDraft, value: string) { setDraft(previous => previous ? { ...previous, [field]: value } : null); setConfirmed(false); setNotice(""); }
  async function copy() {
    if (!ready || !draft) return;
    try { await navigator.clipboard.writeText(proposalSheetTsv(draft)); setNotice(`Row copied. Paste into ${target}. Nothing has been written to Google Sheets.`); }
    catch { setError("Clipboard unavailable. Download the CSV instead."); }
  }
  function download() {
    if (!ready || !draft || !context) return;
    const url = URL.createObjectURL(new Blob([proposalSheetCsv(draft, context.columns)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `zcg-proposal-${record.recordId.replace(/[^a-z0-9_-]/gi, "-")}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice("CSV prepared. No changes were made to Google Sheets.");
  }
  return <section className="proposal-sheet-handoff" aria-labelledby="sheet-handoff-heading">
    <header><span className="review-step-number">03</span><div><h4 id="sheet-handoff-heading">Google Sheets · Proposal</h4><p>Review the row, then copy it into the current register.</p></div>{!context ? <button type="button" className="dao-button" disabled={busy} onClick={() => void prepare()}>{busy ? "Checking the sheet…" : "Prepare proposal row"}</button> : null}</header>
    {error ? <p role="alert">{error}</p> : null}
    {context && context.matchCount > 1 ? <p role="alert">More than one row uses this proposal link. Resolve the duplicate in the register before exporting. <a href={context.sheetUrl} target="_blank" rel="noreferrer">Open Google Sheets ↗</a></p> : context && draft ? <>
      <div className="proposal-sheet-match"><strong>{context.match ? `Existing proposal · Row ${context.match.row}` : "No matching row · Review as a new proposal"}</strong><a href={sheetHref} target="_blank" rel="noreferrer">Open Google Sheets ↗</a></div>
      <div className="proposal-sheet-fields">
        <label className="proposal-sheet-wide">Proposal title<input value={draft.title} maxLength={500} onChange={e => change("title", e.target.value)} /></label>
        <label>Applicant(s)<input value={draft.applicant} maxLength={500} onChange={e => change("applicant", e.target.value)} /></label>
        <label>Date submitted<input type="date" value={draft.submitted} onChange={e => change("submitted", e.target.value)} /></label>
        <label>Sheet status<select value={draft.status} onChange={e => change("status", e.target.value)}><option value="">Select a status</option>{[...new Set([...context.statuses, draft.status].filter(Boolean))].map(status => <option key={status} value={status}>{status}</option>)}</select></label>
        <label>Committee decision date<input type="date" value={draft.decided} min={draft.submitted} onChange={e => change("decided", e.target.value)} /></label>
        <label className="proposal-sheet-wide">Forum link <span className="proposal-sheet-optional">Optional</span><input type="url" value={draft.forumUrl} maxLength={2048} onChange={e => change("forumUrl", e.target.value)} placeholder="https://forum.zcashcommunity.com/t/…" /></label>
      </div>
      <details className="proposal-sheet-preview"><summary>Preview columns A–G</summary><dl>{proposalSheetCells(draft).map((cell,i) => <div key={context.columns[i]}><dt>{String.fromCharCode(65+i)} · {context.columns[i]}</dt><dd>{cell || "—"}</dd></div>)}</dl></details>
      <p className="proposal-sheet-boundary">Only A–G. Formulas, funding amounts and columns H onward stay unchanged.</p>
      <label className="proposal-sheet-consent"><input type="checkbox" checked={confirmed} onChange={e => { setConfirmed(e.target.checked); setNotice(""); }} />I checked this row against the official ZCG decision and register.</label>
      {confirmed && errors.length ? <ul className="proposal-sheet-errors" role="alert">{errors.map(message => <li key={message}>{message}</li>)}</ul> : null}
      <div className="proposal-sheet-actions"><button type="button" className="dao-button dao-button--primary" disabled={!ready} onClick={() => void copy()}>Copy A–G</button><button type="button" className="dao-text-button" disabled={!ready} onClick={download}>Download CSV ↓</button></div>
      <small className="proposal-sheet-checked">Sheet checked {new Date(context.checkedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC. Copy and paste; no automatic sync.</small>
    </> : null}
    {notice ? <p className="committee-notice" role="status">{notice}</p> : null}
  </section>;
}
