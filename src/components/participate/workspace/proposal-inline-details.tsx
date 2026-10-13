"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ProposalDiscussion, type DiscussionCapabilities, type DiscussionComment, type DiscussionPolicy } from "@/components/participate/workspace/proposal-discussion";
import { ProposalMarkdown } from "@/components/participate/workspace/proposal-markdown";
import { ArchiveFileVerifier } from "@/components/participate/workspace/archive-file-verifier";
import { ArchiveRecoveryGuide } from "@/components/participate/workspace/archive-recovery-guide";
import { WorkspaceSignInButton } from "@/components/participate/workspace/workspace-auth";
import type { ProposalRecord } from "@/lib/participate/workspace/domain/proposal-record";
import { ArchiveActivity } from "@/components/participate/workspace/archive-activity";
import { GitHubComments } from "./github-comments";
import { zcgSourceMetadata } from "@/lib/participate/workspace/data/zcg-source-metadata";
import { officialIssueNumber } from "@/lib/participate/official-proposals-model";
import { AbandonmentNotice } from "@/components/participate/workspace/submission-lifecycle";
import { CommitteeLabels } from "@/components/participate/workspace/committee-labels";
import type { SourceCapture } from "@/lib/participate/workspace/archive/source-proposals";

export type ProposalPanel = "discussion" | "record";
type Discussion = { comments: DiscussionComment[]; capabilities: DiscussionCapabilities; policy: DiscussionPolicy };
type DiscussionPreview = { commentCount: number; canParticipate: boolean; participation: DiscussionPolicy["participation"] | null };
const date = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC";

// Keep loaded children mounted when folded so closing a panel preserves drafts.
// Reopening refreshes public evidence and permissions without navigating away.
function useDisclosureData<T>(url: string, open: boolean, refreshKey = "", refreshRequest = 0) {
  const [snapshot, setSnapshot] = useState<{ url: string; refreshKey: string; value?: T; failed?: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void fetch(url, { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Unavailable");
      const value = await response.json() as T;
      if (!controller.signal.aborted) setSnapshot({ url, refreshKey, value });
    }).catch(() => { if (!controller.signal.aborted) setSnapshot(previous => ({ url, refreshKey, value: previous?.url === url && previous.refreshKey === refreshKey ? previous.value : undefined, failed: true })); });
    return () => controller.abort();
  }, [url, open, attempt, refreshKey, refreshRequest]);
  const current = snapshot?.url === url && snapshot.refreshKey === refreshKey ? snapshot : null;
  return { value: current?.value, failed: current?.failed, retry: () => { setSnapshot(previous => previous ? { ...previous, failed: false } : null); setAttempt(count => count + 1); } };
}

function LoadState({ failed, retry, label }: { failed?: boolean; retry: () => void; label: string }) {
  return failed ? <div className="proposal-inline-state" role="alert"><span>Could not load {label.toLowerCase()}.</span><button type="button" className="dao-text-button" onClick={retry}>Try again</button></div>
    : <p className="proposal-inline-state" role="status">Loading {label.toLowerCase()}…</p>;
}

export function ProposalInlineDetails({ communityId, recordId, active, sessionKey, onClose, focusComment, preview }: { communityId: string; recordId: string; active: ProposalPanel | null; sessionKey?: string; onClose: () => void; focusComment?: { id: string; request: number }; preview?: DiscussionPreview }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    panel.current?.focus({ preventScroll: true });
    panel.current?.scrollIntoView?.({ block: "nearest", behavior: "auto" });
  }, [active]);
  const [revision, setRevision] = useState<number | null>(null);
  const endpoint = `/api/communities/${encodeURIComponent(communityId)}/archives/${encodeURIComponent(recordId)}`;
  const discussion = useDisclosureData<Discussion>(`${endpoint}/comments`, active === "discussion", sessionKey, focusComment?.request);
  const record = useDisclosureData<{ record: ProposalRecord }>(`${endpoint}${revision ? `?revision=${revision}` : ""}`, active === "record");
  const discussionReady = Boolean(discussion.value || preview);
  const pendingPreview: Discussion | null = active === "discussion" && preview ? { comments: [],
    capabilities: { canPost: preview.canParticipate && preview.commentCount < 500, canReact: preview.canParticipate, canModerate: false },
    policy: { visibility: "PUBLIC", immutable: true, maxLength: 4000, readOnly: false, participation: preview.participation ?? undefined } } : null;
  const shownDiscussion = discussion.value ?? pendingPreview;
  useEffect(() => {
    // A lazy-loaded composer can grow below the viewport after the initial open.
    // Bring it into view without opening the mobile keyboard or losing a draft.
    if (active !== "discussion" || !discussionReady || focusComment) return;
    const composer = panel.current?.querySelector(".dao-comment-composer");
    if (!composer) return;
    const bounds = composer.getBoundingClientRect();
    const viewport = composer.ownerDocument.defaultView?.innerHeight ?? 0;
    if (bounds.bottom > viewport - 80 || bounds.top < 120) composer.scrollIntoView?.({ block: "center" });
  }, [active, discussionReady, focusComment]);
  const focusedId = focusComment?.id, focusRequest = focusComment?.request;
  useEffect(() => {
    if (active !== "discussion" || !focusedId || !discussion.value) return;
    const target = document.getElementById(`comment-${focusedId}`);
    if (!target || !panel.current?.contains(target)) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: "center", behavior: "auto" });
  }, [active, focusedId, focusRequest, discussion.value]);
  return <div ref={panel} tabIndex={-1} className={`proposal-inline${active === "discussion" ? " proposal-inline--comments" : ""}`} id={`proposal-panel-${recordId}`} hidden={!active}>
    <div className="proposal-inline-toolbar"><button type="button" className="dao-text-button" onClick={onClose}>Close <span aria-hidden="true">×</span></button></div>
    <div hidden={active !== "discussion"}>
      {shownDiscussion ? <>
        {discussion.failed ? <LoadState failed retry={discussion.retry} label="Comments" /> : null}
        {!shownDiscussion.capabilities.canReact && !shownDiscussion.policy.readOnly ? <div className="proposal-inline-signin"><WorkspaceSignInButton label="Sign in to participate" className="dao-button" /></div> : null}
        <ProposalDiscussion pollId={recordId} sectionId={`discussion-${recordId}`} embedded showBalance={false} commentsEndpoint={`${endpoint}/comments`} communityId={communityId} initialComments={shownDiscussion.comments} capabilities={shownDiscussion.capabilities} policy={shownDiscussion.policy} loading={!discussion.value} expectedCommentCount={preview?.commentCount} focusComment={active === "discussion" ? focusComment : undefined} />
      </> : active === "discussion" ? <LoadState failed={discussion.failed} retry={discussion.retry} label="Comments" /> : null}
    </div>
    <div hidden={active !== "record"}>
      {record.value ? <>{record.failed ? <LoadState failed retry={record.retry} label="Record" /> : null}<InlineRecord record={record.value.record} endpoint={endpoint} onRevision={setRevision} sessionKey={sessionKey} visible={active === "record"} /></> : active === "record" ? <LoadState failed={record.failed} retry={record.retry} label="Record" /> : null}
    </div>
  </div>;
}

type RecordSection = "proposal" | "source" | "files" | "review" | "activity";

function RecordIcon({ section }: { section: RecordSection }) {
  const paths: Record<RecordSection, string> = {
    proposal: "M7 3h7l4 4v14H7V3Zm7 0v5h4M10 12h5m-5 4h5",
    source: "M4 6h16M4 12h16M4 18h10M7 3v6m10 0v6M7 15v6",
    files: "M12 3 4 6v6c0 4 8 9 8 9s8-5 8-9V6l-8-3Zm-4 9 3 3 5-6",
    review: "m4 17 11-11 3 3L7 20H4v-3Zm9-9 3 3M14 20h6",
    activity: "M4 12h4l3-7 3 14 3-7h3",
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[section]} /></svg>;
}

function InlineRecord({ record, endpoint, onRevision, visible }: { record: ProposalRecord; endpoint: string; onRevision: (revision: number) => void; sessionKey?: string; visible: boolean }) {
  const id = useId();
  const heading = useRef<HTMLElement>(null);
  const returnToHeading = useRef(false);
  const [selected, setSelected] = useState<RecordSection>("proposal");
  const [visited, setVisited] = useState<RecordSection[]>(["proposal"]);
  const download = `${endpoint}/revisions/${record.revision}`;
  const { proof } = record;
  const source = record.sourceCapture?.schema === "PARTICIPATE_SOURCE_CAPTURE_V2" ? record.sourceCapture : null;
  const sourceReference = record.sourceCapture?.source ?? zcgSourceMetadata(record.recordId);
  const sourceIssue = sourceReference ? officialIssueNumber(sourceReference.url) : null;
  const activeSection = selected === "source" && !sourceIssue ? "proposal" : selected;
  const sections: { key: RecordSection; title: string; detail: string }[] = [
    { key: "proposal", title: "Proposal", detail: "Preserved contents" },
    ...(sourceIssue ? [{ key: "source" as const, title: "Source & comments", detail: source ? sourceOutcomes[source.proposal.outcome] : "GitHub discussion" }] : []),
    { key: "files", title: "Files & proof", detail: proof.label },
    { key: "activity", title: "Activity", detail: "Comments & likes" },
  ];
  useEffect(() => {
    if (!returnToHeading.current) return;
    returnToHeading.current = false;
    if (visible) heading.current?.scrollIntoView?.({ block: "start", behavior: "instant" });
  }, [selected, visible]);
  function selectSection(section: RecordSection) {
    if (section === activeSection) return;
    // The sticky navigation may remain visible after the record heading has left
    // the viewport. Restore that context after the shorter panel is rendered.
    returnToHeading.current = Boolean(heading.current && heading.current.getBoundingClientRect().top < 72);
    setSelected(section);
    setVisited(previous => previous.includes(section) ? previous : [...previous, section]);
  }
  return <section className="proposal-inline-record" aria-label="Preserved proposal and verification">
    <CommitteeLabels ids={record.labels} />
    {record.abandonment ? <AbandonmentNotice value={record.abandonment} endpoint={endpoint} /> : null}
    <header ref={heading} className="proposal-inline-record-heading"><div><h3>Preserved record</h3><p>{record.kind === "NATIVE_PROPOSAL" ? `Published on OpenZcash · ${date(record.capturedAt)}` : record.kind === "SOURCE_PROPOSAL" ? `${source ? "Source observation captured" : "Full application captured"} · ${date(record.capturedAt)}` : record.originalDecisionDate ? `Summary snapshot · ${record.originalDecisionDate}` : `Review snapshot · ${date(record.capturedAt)}`}</p>{record.application ? <p>{record.application.applicant} · {record.application.requestedAmountUsd} USD requested</p> : null}</div>
      {record.revisions.length > 1 ? <label className="dao-comment-sort"><span className="dao-sr-only">Record revision</span><select value={record.revision} onChange={event => onRevision(Number(event.target.value))}>{record.revisions.map(item => <option key={item.revision} value={item.revision}>Revision {item.revision}{item.revision === record.revisions[0].revision ? " · Latest" : ""}</option>)}</select></label> : <span className="dao-eyebrow">Revision {record.revision}</span>}
    </header>
    <nav className="proposal-record-nav" aria-label="Record sections">
      {sections.map(section => <button type="button" key={section.key} aria-pressed={activeSection === section.key} aria-controls={`${id}-${section.key}`} onClick={() => selectSection(section.key)}>
        <RecordIcon section={section.key} /><span><strong>{section.title}</strong><small>{section.detail}</small></span>
      </button>)}
    </nav>
    <div className="proposal-record-panel" id={`${id}-proposal`} role="region" aria-label="Proposal contents" hidden={activeSection !== "proposal"}>
      <ProposalMarkdown>{record.markdown.replace(/^# [^\n]+\n\n/, "")}</ProposalMarkdown>
    </div>
    {sourceIssue ? <div className="proposal-record-panel" id={`${id}-source`} role="region" aria-label="Source status and decisions" hidden={activeSection !== "source"}>
      <SourceRevisionEvidence key={record.manifestHash} capture={source} download={download} issueNumber={sourceIssue} visible={visible && activeSection === "source"} />
    </div> : null}
    <div className="proposal-record-panel" id={`${id}-files`} role="region" aria-label="Files and verification" hidden={activeSection !== "files"}>
      <div className="proposal-record-grid">
        <section className="proposal-record-box"><header><h4>Preserved files</h4><span>{record.fileCount} files</span></header>
          <p>Download this revision, or check a copy you already saved.</p>
          <div className="proposal-inline-downloads"><a className="dao-button" href={download}>Download revision ↓</a><a className="dao-text-button" href={`${download}?file=proposal.md`}>Markdown ↓</a></div>
          <ArchiveFileVerifier key={record.manifestHash} manifestHash={record.manifestHash} />
        </section>
        <section className="proposal-record-box"><header><h4>Blockchain proof</h4><span>{proof.label}</span></header>
          <p>{proof.detail}</p>{proof.evidence ? <p className="proposal-record-caption">Checked {date(proof.evidence.checkedAt)}</p> : null}
          {proof.hasReceipt ? <a className="dao-text-button" href={`${download}?file=verification.json`}>Chain receipt ↓</a> : null}
          <details className="dao-archive-details proposal-record-fingerprint"><summary>Fingerprint & evidence</summary><dl><div><dt>Manifest SHA-256</dt><dd><code>{record.manifestHash}</code></dd></div><div><dt>Snapshot captured</dt><dd>{date(record.capturedAt)}</dd></div>{proof.evidence ? <><div><dt>Transaction</dt><dd><code>{proof.evidence.txid}</code></dd></div><div><dt>Block</dt><dd>{proof.evidence.blockHeight.toLocaleString("en-US")} · {date(proof.evidence.blockTime)}</dd></div><div><dt>Memo</dt><dd><code>{proof.evidence.memo}</code></dd></div></> : null}</dl></details>
          <ArchiveRecoveryGuide download={download} />
        </section>
      </div>
    </div>
    <div className="proposal-record-panel proposal-record-panel--activity" id={`${id}-activity`} role="region" aria-label="Activity and verification" hidden={activeSection !== "activity"}>
      {visited.includes("activity") ? <ArchiveActivity key={endpoint} endpoint={endpoint} initiallyOpen visible={visible && activeSection === "activity"} /> : null}
    </div>
  </section>;
}

const sourceOutcomes = { under_review: "Under review", approved: "Approved", rejected: "Rejected", abandoned: "Abandoned", closed: "Closed without a recorded verdict" };
const repositoryRoles = { OWNER: "Repository owner", MEMBER: "Repository member", COLLABORATOR: "Repository collaborator" };

function SourceRevisionEvidence({ capture, download, issueNumber, visible }: { capture: Extract<SourceCapture, { schema: "PARTICIPATE_SOURCE_CAPTURE_V2" }> | null; download: string; issueNumber: number; visible: boolean }) {
  const [eventLimit, setEventLimit] = useState(5);
  const [commentLimit, setCommentLimit] = useState(5);
  if (!capture) return <GitHubComments issueNumber={issueNumber} visible={visible} />;
  const events = [...capture.evidence.events].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id);
  const comments = [...capture.evidence.comments].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || b.id - a.id);
  return <>
    <div className="proposal-source-heading"><div><strong>{sourceOutcomes[capture.proposal.outcome]}</strong><p>Official source · Updated <time dateTime={capture.proposal.sourceUpdatedAt}>{date(capture.proposal.sourceUpdatedAt)}</time></p></div><a className="dao-text-button" href={capture.proposal.proposalUrl} target="_blank" rel="noopener noreferrer">View source ↗</a></div>
    <div className="proposal-record-grid">
      <section className="proposal-record-box"><header><h4>Status history</h4><span>{events.length} {events.length === 1 ? "change" : "changes"}</span></header>
        {events.length ? <><ol className="proposal-source-timeline">{events.slice(0, eventLimit).map(event => <li key={event.id}>
          <strong>{event.event === "labeled" ? "Label added" : event.event === "unlabeled" ? "Label removed" : event.event === "closed" ? "Issue closed" : "Issue reopened"}{event.label ? ` · ${event.label.name}` : ""}</strong>
          <span>{event.actor ? `@${event.actor.login}` : "Actor unavailable"} · <time dateTime={event.createdAt}>{date(event.createdAt)}</time></span><a href={event.url} target="_blank" rel="noopener noreferrer">Source event ↗</a>
        </li>)}</ol>{events.length > eventLimit ? <button type="button" className="dao-text-button" onClick={() => setEventLimit(limit => limit + 5)}>Show older changes ({events.length - eventLimit})</button> : null}</> : <p className="proposal-record-empty">No status changes in this capture.</p>}
      <details className="proposal-source-comment"><summary>Comments preserved in this revision · {comments.length}</summary><header><h4>Captured comments</h4><span>{comments.length} {comments.length === 1 ? "comment" : "comments"}</span></header>
        <p className="proposal-record-caption">Repository roles identify the source, not individual committee votes.</p>
        {comments.length ? <>{comments.slice(0, commentLimit).map(comment => <details className="proposal-source-comment" key={comment.id}>
          <summary><span><strong>@{comment.author.login}</strong><small>{repositoryRoles[comment.association]} · {date(comment.createdAt)}</small></span></summary>
          {comment.updatedAt !== comment.createdAt ? <p className="proposal-record-caption">Edited at source <time dateTime={comment.updatedAt}>{date(comment.updatedAt)}</time></p> : null}
          <ProposalMarkdown>{comment.body}</ProposalMarkdown>
          <a className="dao-text-button" href={comment.url} target="_blank" rel="noopener noreferrer">Original comment ↗</a>
        </details>)}{comments.length > commentLimit ? <button type="button" className="dao-text-button" onClick={() => setCommentLimit(limit => limit + 5)}>Show older comments ({comments.length - commentLimit})</button> : null}</> : <p className="proposal-record-empty">This revision contains no comments. See the current GitHub discussion alongside it.</p>}
      </details></section>
      <GitHubComments key={issueNumber} issueNumber={issueNumber} visible={visible} />
    </div>
    <a className="dao-text-button proposal-source-download" href={`${download}?file=source.json`}>Download source evidence ↓</a>
  </>;
}
