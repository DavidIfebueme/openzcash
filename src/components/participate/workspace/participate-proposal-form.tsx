"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProposalMarkdown } from "@/components/participate/workspace/proposal-markdown";
import { ProposalTags } from "@/components/participate/workspace/proposal-tags";
import { WorkspaceSignInButton } from "@/components/participate/workspace/workspace-auth";
import { AbandonmentNotice, SubmissionLifecycleAction } from "@/components/participate/workspace/submission-lifecycle";
import { PROPOSAL_TAGS, MAX_PROPOSAL_TAGS } from "@/lib/participate/workspace/domain/proposal-tags";
import { formatProposalUsd, parseProposalUsdCents, PROPOSAL_SETTLEMENT_LABEL } from "@/lib/participate/workspace/domain/proposal-funding";
import { EMPTY_SUBMISSION, PARTICIPATE_TEMPLATE, SUBMISSION_PRICE, submissionDraftSchema, submissionPublishableSchema, type SubmissionDraft, type SubmissionPayload } from "@/lib/participate/workspace/domain/proposal-submission";

const messages: Record<string, string> = {
  unauthorized: "Sign in to save or publish. Your text is still here.", forbidden_origin: "Reopen Participate and try again.",
  VERIFIED_EMAIL_REQUIRED: "Sign in with your verified email to publish in the free pilot. Your text is still here.",
  DRAFT_CHANGED: "This draft changed in another tab. Download your text before reopening the saved draft.",
  DRAFT_NOT_FOUND: "This draft is unavailable for your account.", ALREADY_PUBLISHED: "This version is already published. Open it from My proposals.",
  PRICE_CHANGED: "The publication price changed. Reopen the review before continuing.",
  INSUFFICIENT_PARTICIPATION_CREDITS: "You need 20 demo Zcred. Check Credits in your profile menu.",
  CREDIT_PAYMENT_REVIEW: "Your credit account needs a payment review before publishing.",
  DEMO_CREDITS_REQUIRED: "This pilot accepts only free demo Zcred.", DEMO_PUBLICATION_ONLY: "Paid publication is not available yet. You can save or export your draft.",
  INCOMPLETE_PROPOSAL: "Complete the title, public applicant, proposal and USD budget, and add a Zcash forum discussion.", INVALID_PROPOSAL_INPUT: "Check the proposal fields and public links.",
  DRAFT_LIMIT: "The draft limit was reached. Continue an existing draft from My proposals.", CONCURRENT_UPDATE: "Another update occurred. Retry with the same version.",
  PROPOSAL_TOO_LARGE: "Keep the proposal within 40,000 characters.", PUBLICATION_UNAVAILABLE: "Proposal intake is unavailable. Download your text and try again later."
};
async function send(method: "PUT" | "POST", body: unknown) {
  const response = await fetch("/api/participate/proposals", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => null);
  if (!response.ok || typeof result?.draft?.id !== "string") throw new Error(messages[result?.error] ?? "We could not confirm the save. Retry safely; the same request will not publish or charge twice.");
  return result.draft as SubmissionDraft;
}
function download(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ParticipateProposalForm({ initial, drafts, signedIn, sandbox, balance, communityId, creditScopeId, publicationMode = "demo" }: {
  initial?: SubmissionDraft; drafts: SubmissionDraft[]; signedIn: boolean; sandbox: boolean; balance: number | null;
  communityId: string; creditScopeId: string; publicationMode?: "production" | "demo";
}) {
  const router = useRouter();
  const [payload, setPayload] = useState<SubmissionPayload>(initial?.payload ?? EMPTY_SUBMISSION);
  const [saved, setSaved] = useState<SubmissionDraft | undefined>(initial);
  const [mode, setMode] = useState<"write" | "preview" | "review">("write");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [forumError, setForumError] = useState("");
  const [notice, setNotice] = useState("");
  const [consent, setConsent] = useState(false);
  const [replacement, setReplacement] = useState<string | null>(null);
  const [reviewBalance, setReviewBalance] = useState<number | null>(null);
  const [canClaimAllowance, setCanClaimAllowance] = useState(false);
  const requestId = useRef(initial?.id ?? "");
  const publicationKey = useRef("");
  const flight = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const forumInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const dirty = JSON.stringify(payload) !== JSON.stringify(saved?.payload ?? EMPTY_SUBMISSION);
  const published = Boolean(saved && saved.state !== "DRAFT");
  useEffect(() => {
    if (!dirty || published) return;
    const leave = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty, published]);
  useEffect(() => { if (error) feedback.current?.focus(); }, [error]);

  function update<K extends keyof SubmissionPayload>(key: K, value: SubmissionPayload[K]) {
    setPayload(current => ({ ...current, [key]: value })); setNotice(""); setError(""); setConsent(false);
    if (key === "forumUrl") setForumError("");
  }
  async function run(action: () => Promise<void>) {
    if (flight.current) return;
    flight.current = true; setBusy(true); setError(""); setNotice("");
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Please try again. Your text is still here."); }
    finally { flight.current = false; setBusy(false); }
  }
  async function persist() {
    const validated = submissionDraftSchema.safeParse(payload);
    if (!validated.success) throw new Error(validated.error.issues[0]?.message ?? messages.INVALID_PROPOSAL_INPUT);
    requestId.current ||= crypto.randomUUID();
    const draft = await send("PUT", { id: requestId.current, expectedVersion: saved?.version ?? 0, payload: validated.data });
    setSaved(draft); setPayload(draft.payload);
    // Keep editor state mounted across authentication and saves; the saved draft is addressable.
    window.history.replaceState(null, "", `/zcg/participate?compose=${draft.id}`);
    return draft;
  }
  async function review() {
    const valid = submissionPublishableSchema.safeParse(payload);
    if (!valid.success) {
      const issue = valid.error.issues[0];
      if (issue?.path[0] === "forumUrl") {
        setForumError(issue.message); forumInput.current?.focus(); return;
      }
      throw new Error(issue?.message ?? messages.INCOMPLETE_PROPOSAL);
    }
    await persist();
    const response = await fetch(`/api/account/credits?communityId=${encodeURIComponent(creditScopeId)}`, { cache: "no-store" });
    const result = await response.json().catch(() => null);
    const account = result?.credits?.accounts?.find((row: { communityId: string }) => row.communityId === creditScopeId);
    if (!response.ok || typeof account?.balance !== "number") throw new Error("Your draft is saved. We could not load your credits; try reviewing again.");
    setReviewBalance(account.balance); setCanClaimAllowance(account.canClaimPreview === true); setMode("review"); setConsent(false);
    window.setTimeout(() => heading.current?.focus(), 0);
  }
  async function claimAllowance() {
    const response = await fetch("/api/account/credits/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ communityId: creditScopeId }) });
    const result = await response.json().catch(() => null);
    const account = result?.credits?.accounts?.find((row: { communityId: string }) => row.communityId === creditScopeId);
    if (!response.ok || typeof account?.balance !== "number") throw new Error(messages[result?.error] ?? "Your allowance could not be confirmed. Retry safely; free credits are added only once.");
    setReviewBalance(account.balance); setCanClaimAllowance(false);
    setNotice("25 free demo Zcred are available in your account.");
    window.dispatchEvent(new CustomEvent("dao:credits-updated"));
  }
  function offer(text: string) {
    if (payload.body.trim() && payload.body !== text) setReplacement(text);
    else { update("body", text); setMode("write"); }
  }
  async function importFile(file?: File) {
    if (!file) return;
    await run(async () => {
      if (!/\.(md|markdown)$/i.test(file.name) || file.size > 160000) throw new Error("Choose a UTF-8 Markdown file up to 40,000 characters.");
      const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      if (!text.trim() || text.length > 40000 || text.includes("\0")) throw new Error("Choose a non-empty Markdown file up to 40,000 characters.");
      offer(text);
    });
  }
  function exportDraft() {
    download(`# ${payload.title || "Untitled proposal"}\n\nApplicant: ${payload.applicant}\nRequested: ${payload.requestedAmountUsd || "Not set"} USD\n${PROPOSAL_SETTLEMENT_LABEL}\n\n${payload.body}\n\n${[payload.githubUrl, payload.forumUrl].filter(Boolean).join("\n")}\n`, "proposal-draft.md");
  }
  const canReview = signedIn && !busy && !replacement;
  const creditBalance = reviewBalance ?? balance ?? 0;
  const myDrafts = drafts.filter(draft => draft.id !== saved?.id && draft.state === "DRAFT");
  const back = (event: React.MouseEvent<HTMLAnchorElement>) => { if (dirty && !published && !window.confirm("Leave without saving these changes?")) event.preventDefault(); };

  return <div className="participate-compose">
    <div className="participate-compose-top"><Link href="/zcg/participate" className="dao-back-link" onClick={back}>← Proposals</Link><button type="button" className="dao-text-button" onClick={exportDraft}>Export .md ↗</button></div>
    <header className="participate-compose-heading"><div><p className="dao-eyebrow">OpenZcash · Community proposals</p><h1 ref={heading} tabIndex={-1}>{saved?.state === "ABANDONED" ? "Proposal abandoned" : published ? "Proposal published" : mode === "review" ? "Review your proposal" : "New proposal"}</h1><p>{saved?.state === "ABANDONED" ? "Your proposal and its history remain public." : published ? "Your public record is ready for discussion." : mode === "review" ? "Check the public version before submitting." : "An idea, a clear plan, a public record."}</p></div><span className="participate-draft-state">{saved?.state === "ABANDONED" ? "Abandoned" : published ? saved?.state === "PUBLISHED_DEMO" ? "Legacy test proposal" : "Published" : dirty ? "Unsaved changes" : saved ? "Draft saved" : "Private draft"}</span></header>
    {saved ? <SubmissionLifecycleAction key={saved.id} draft={saved} disabled={busy} onDeleted={() => { setPayload(EMPTY_SUBMISSION); setSaved(undefined); router.replace("/zcg/participate"); }} onAbandoned={setSaved} /> : null}
    {published && saved ? <section className="dao-panel participate-published"><span className="participate-published-check" aria-hidden="true">✓</span><h2>{saved.payload.title}</h2><p>20 demo Zcred used. No real payment was made.</p>{saved.abandonment ? <AbandonmentNotice value={saved.abandonment} endpoint={`/api/communities/${encodeURIComponent(communityId)}/archives/${saved.recordId}`} /> : <p>Files preserved · Check the record for current verification</p>}<div className="dao-form-actions"><Link className="dao-button dao-button--primary" href={`/zcg/participate?record=${saved.recordId}`}>View proposal →</Link><a className="dao-button" href={`/api/communities/${encodeURIComponent(communityId)}/archives/${saved.recordId}/revisions/1`}>Download record</a></div></section> : <div className="participate-compose-grid">
      <form className="dao-panel dao-form participate-editor" noValidate onSubmit={event => { event.preventDefault(); if (canReview) void run(review); }} aria-busy={busy}>
        {mode !== "review" ? <>
          <div className="participate-template-bar"><button type="button" className="dao-text-button" disabled={busy} onClick={() => offer(PARTICIPATE_TEMPLATE)}>Use ZCG template</button><span aria-hidden="true">·</span><button type="button" className="dao-text-button" disabled={busy} onClick={() => input.current?.click()}>Import .md</button><input ref={input} type="file" accept=".md,.markdown,text/markdown" className="dao-file-input" aria-label="Import Markdown file" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void importFile(file); }} /></div>
          {replacement !== null ? <div className="dao-template-replace" role="group" aria-label="Replace proposal text"><p>Replace your current text?</p><div className="dao-form-actions"><button type="button" className="dao-button" onClick={() => { update("body", replacement); setReplacement(null); setMode("write"); }}>Replace text</button><button type="button" className="dao-button" onClick={() => setReplacement(null)}>Keep my text</button></div></div> : null}
          <div className="dao-field"><label htmlFor="participate-title">Proposal title</label><input id="participate-title" maxLength={200} disabled={busy} value={payload.title} onChange={event => update("title", event.target.value)} placeholder="What will your project make possible?" /></div>
          <div className="dao-field-row"><div className="dao-field"><label htmlFor="participate-applicant">Public name or team</label><input id="participate-applicant" maxLength={120} disabled={busy} value={payload.applicant} onChange={event => update("applicant", event.target.value)} placeholder="How you want to be credited" /></div><div className="dao-field"><label htmlFor="participate-budget">Requested budget · USD</label><input id="participate-budget" inputMode="decimal" maxLength={20} disabled={busy} value={payload.requestedAmountUsd} onChange={event => update("requestedAmountUsd", event.target.value)} placeholder="0.00" aria-describedby="participate-settlement" /><p id="participate-settlement">{PROPOSAL_SETTLEMENT_LABEL}</p></div></div>
          <fieldset className="dao-tag-picker" disabled={busy}><legend>Topics <span>Up to {MAX_PROPOSAL_TAGS}</span></legend><div>{PROPOSAL_TAGS.map(tag => { const selected = payload.tags.includes(tag.id); return <button key={tag.id} type="button" className={`dao-topic-choice dao-topic--${tag.tone}`} aria-pressed={selected} disabled={busy || (!selected && payload.tags.length >= MAX_PROPOSAL_TAGS)} onClick={() => update("tags", selected ? payload.tags.filter(value => value !== tag.id) : [...payload.tags, tag.id])}>{selected ? "✓ " : "+ "}{tag.label}</button>; })}</div></fieldset>
          <div className="dao-field"><div className="dao-editor-heading"><label htmlFor="participate-body">Proposal</label><div role="group" aria-label="Markdown editor mode"><button type="button" disabled={busy} aria-pressed={mode === "write"} onClick={() => setMode("write")}>Write</button><button type="button" disabled={busy} aria-pressed={mode === "preview"} onClick={() => setMode("preview")}>Preview</button></div></div><textarea id="participate-body" className="dao-markdown-editor" rows={17} hidden={mode === "preview"} maxLength={40000} disabled={busy} value={payload.body} onChange={event => update("body", event.target.value)} placeholder="Describe the work, its impact, budget and milestones. Start with the ZCG template or import your Markdown." />{mode === "preview" ? <div className="dao-markdown-preview" aria-label="Proposal preview">{payload.body.trim() ? <ProposalMarkdown>{payload.body}</ProposalMarkdown> : <p>Your proposal preview will appear here.</p>}</div> : null}<p className="dao-editor-hint"><span>Markdown supported</span><span>{payload.body.length.toLocaleString("en-US")} / 40,000</span></p></div>
          <div className="dao-field participate-forum-field">
            <label htmlFor="participate-forum">Forum discussion <span aria-hidden="true">Required</span></label>
            <input ref={forumInput} id="participate-forum" type="url" required maxLength={2048} disabled={busy} value={payload.forumUrl} onChange={event => update("forumUrl", event.target.value)} placeholder="https://forum.zcashcommunity.com/t/…" aria-invalid={Boolean(forumError)} aria-describedby={`participate-forum-hint${forumError ? " participate-forum-error" : ""}`} />
            <p id="participate-forum-hint">Link your proposal’s topic on the Zcash Community Forum. You can add it later in a draft.</p>
            {forumError ? <p id="participate-forum-error" className="participate-field-error" role="alert">{forumError}</p> : null}
          </div>
          <details className="participate-source-fields"><summary>GitHub application <span>Optional</span></summary><div className="dao-field"><label htmlFor="participate-github">Application link</label><input id="participate-github" type="url" maxLength={2048} disabled={busy} value={payload.githubUrl} onChange={event => update("githubUrl", event.target.value)} placeholder="https://github.com/…" /></div></details>
        </> : <article className="participate-review" aria-label="Public proposal review"><div className="participate-review-meta"><span>{payload.applicant}</span><strong>{formatProposalUsd(parseProposalUsdCents(payload.requestedAmountUsd))}</strong></div><h2>{payload.title}</h2><ProposalTags tags={payload.tags} /><ProposalMarkdown>{payload.body}</ProposalMarkdown><div className="participate-review-links">{[payload.githubUrl, payload.forumUrl].filter(Boolean).map(url => <a key={url} href={url} target="_blank" rel="noopener noreferrer">{url} ↗</a>)}</div></article>}
        {error ? <p ref={feedback} className="dao-error" role="alert" tabIndex={-1}>{error}</p> : null}{notice ? <p role="status" className="dao-field-hint">{notice}</p> : null}
        {mode !== "review" ? <div className="participate-editor-footer">{signedIn ? <><button type="button" className="dao-button" disabled={busy || Boolean(replacement)} onClick={() => void run(async () => { await persist(); setNotice("Private draft saved to your account."); })}>{busy ? "Please wait…" : "Save draft"}</button><button type="submit" className="dao-button dao-button--primary" disabled={!canReview}>Review & submit →</button></> : <><span>Sign in to save your draft.</span><WorkspaceSignInButton label="Sign in to continue" className="dao-button dao-button--primary" /></>}</div> : <button type="button" className="dao-text-button" disabled={busy} onClick={() => { setMode("write"); setConsent(false); setError(""); }}>← Back to editing</button>}
      </form>
      <aside className="participate-compose-aside">
        <section className="dao-panel participate-publication-card" aria-labelledby="participate-publication-title">
          <header className="participate-publication-heading"><h2 id="participate-publication-title">Publication</h2><span className="participate-credit-badge">{sandbox ? "Demo" : "Coming soon"}</span></header>
          <div className="participate-price"><strong>{SUBMISSION_PRICE.credits}</strong><span>Zcred</span></div>
          <p className="participate-price-note">US${(SUBMISSION_PRICE.usdCents / 100).toFixed(2)} {sandbox ? "reference value · Free in this pilot" : "per proposal"}</p>
          <p className="participate-credit-rate">1 Zcred <span>= US${(SUBMISSION_PRICE.creditUsdCents / 100).toFixed(2)}</span></p>
          {mode !== "review" ? <><p className="participate-credit-description">Credits let you publish, comment and like. Drafts are free.</p>
          <details className="participate-credit-guide">
            <summary>How credits work <span aria-hidden="true">+</span></summary>
            <ol className="participate-publication-steps">
              <li><span>01</span><div><strong>{sandbox ? "Get 25 free Zcred" : "Buy with ZEC"}</strong><p>{sandbox ? "Sign in by email, then claim your one-time allowance in Credits or when reviewing a proposal." : "When payments open, the US dollar price is converted to ZEC at checkout."}</p></div></li>
              <li><span>02</span><div><strong>{sandbox ? "Prepare your proposal" : "Wait for confirmation"}</strong><p>{sandbox ? "Save a private draft, review the public version and decide when to publish." : "Credits enter your balance after the payment is confirmed."}</p></div></li>
              <li><span>03</span><div><strong>Use your credits</strong><p>Publishing costs {SUBMISSION_PRICE.credits} Zcred. Comment and like costs appear before you confirm.</p></div></li>
            </ol>
            <p className="participate-credit-footnote">Zcred are participation credits, not voting power or a cryptocurrency.</p>
          </details></> : null}
          {mode !== "review" || !sandbox ? <div className="participate-credit-status"><strong>{sandbox ? "Try it with free Zcred" : "Start with a free draft"}</strong><p>{sandbox ? "Zcred are free demo credits. Your proposal and discussion are public and real." : "Paid publication is being prepared. Save or export your draft today."}</p></div> : null}
          {mode === "review" ? <div className="participate-submit-review">
            <div className="participate-demo-disclosure" role="note"><strong>{publicationMode === "production" ? "Publish to the community" : "Publish a test proposal"}</strong><p>Your proposal will be public on OpenZcash. Official ZCG applications still go through GitHub. Committee review is not enabled here.</p></div>
            <dl><div><dt>Available</dt><dd>{creditBalance} demo Zcred</dd></div><div><dt>After publication</dt><dd>{Math.max(0, creditBalance - SUBMISSION_PRICE.credits)} demo Zcred</dd></div></dl>
            {sandbox && canClaimAllowance ? <button type="button" className="dao-button" disabled={busy} onClick={() => void run(claimAllowance)}>{busy ? "Adding…" : "Get 25 free Zcred"}</button> : null}
            <label className="participate-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} /><span>Publish this exact version on OpenZcash. Its text and public name will be visible to everyone and cannot be edited.</span></label><button type="button" className="dao-button dao-button--primary" disabled={busy || !consent || creditBalance < SUBMISSION_PRICE.credits || !sandbox} onClick={() => void run(async () => {
            if (!saved) return;
            publicationKey.current ||= crypto.randomUUID();
            const result = await send("POST", { id: saved.id, expectedVersion: saved.version, contentHash: saved.contentHash, priceVersion: SUBMISSION_PRICE.version, requestKey: publicationKey.current, consent: true });
            setSaved(result); setNotice(""); router.refresh();
          })}>{busy ? "Please wait…" : "Publish · 20 demo Zcred"}</button>{creditBalance < SUBMISSION_PRICE.credits && !canClaimAllowance ? <p className="dao-error">Open Credits in your profile to check your demo allowance.</p> : null}</div> : null}
        </section>
        <details className="participate-intake-note"><summary>Publication & verification</summary><p>Saving a draft is private. Publishing creates a permanent community record using free demo Zcred. Automatic blockchain anchoring applies to eligible applications from the official ZCG GitHub source.</p></details>
        {myDrafts.length ? <details className="participate-my-drafts"><summary>My drafts <span>{myDrafts.length}</span></summary>{myDrafts.map(draft => <Link key={draft.id} href={`/zcg/participate?compose=${draft.id}`} onClick={back}>{draft.payload.title || "Untitled proposal"}</Link>)}</details> : null}
      </aside>
    </div>}
  </div>;
}
