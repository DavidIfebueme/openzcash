"use client";

import { OPEN_REVIEW_EVENT, type CommitteeReviewDestination } from "@/lib/participate/workspace/domain/discussion-notifications";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AccountAvatar } from "@/components/participate/workspace/workspace-account";
import { WorkspaceSignInButton } from "@/components/participate/workspace/workspace-auth";
import { useParticipateHost } from "@/components/participate/workspace/participate-bridge";
import { SignedDecision } from "@/components/participate/workspace/signed-decision";
import { CommitteeDecisionRule, CommitteeCountingHelp } from "@/components/participate/workspace/committee-decision-rule";
import { ProposalInlineDetails } from "@/components/participate/workspace/proposal-inline-details";
import { CommitteeLabels, CommitteeLabelEditor } from "@/components/participate/workspace/committee-labels";
import { CommitteeReviewGuide } from "./committee-review-guide";
import { CommitteeReviewTabs, reviewTabId, type CommitteeReviewPanel } from "./committee-review-tabs";
import { ReviewFinish } from "./review-finish";
import { CommitteeSourceDecision } from "@/components/participate/workspace/committee-source-decision";
import { passkeyFetch } from "@/lib/participate/workspace/auth/passkey-client";
import { committeeRoleLabels, reviewerRoles, type CommitteeWorkspace } from "@/lib/participate/workspace/domain/committee";

const endpoint = "/api/participate/committee";
const tabs = ["Reviews", "Members", "Rules", "History"] as const;
const messages: Record<string, string> = {
  COMMITTEE_NOT_ENABLED: "Committee operations are awaiting authorization.",
  COMMITTEE_VERIFIED_ACCOUNT_REQUIRED: "Use your own verified email account. Demo profiles cannot change committee access.",
  COMMITTEE_FORBIDDEN: "Your role does not allow this change.", COMMITTEE_OWNER_PROTECTED: "The owner’s access is protected.",
  COMMITTEE_REFRESH_REQUIRED: "The workspace changed. Refresh before trying again.", COMMITTEE_INVALID_INPUT: "Check the fields and try again.",
  COMMITTEE_ALREADY_MEMBER: "This account is already an active member.", COMMITTEE_INVITATION_EXISTS: "Revoke the existing invitation before changing its role.",
  COMMITTEE_INVITATION_UNAVAILABLE: "This invitation is expired, revoked, or belongs to another email.", COMMITTEE_INVITATION_USED: "This invitation has already been accepted.",
  COMMITTEE_INVITATION_LIMIT: "There are 50 pending invitations. Revoke unused invitations first.", COMMITTEE_MEMBER_LIMIT: "This committee has reached its member limit.",
  COMMITTEE_INVALID_QUORUM: "Quorum must fit the active reviewer count.", COMMITTEE_FIXED_RULES: "Committee reviews use 3 of 5 approvals with no deadline. Refresh to use the current rules.", COMMITTEE_RATE_LIMITED: "Too many changes. Try again in a few minutes.",
  forbidden_origin: "Reload the workspace and try again.", unauthorized: "Sign in to your account again."
};
const states: Record<string, string> = { AWAITING_REVIEW: "To review", OPEN: "Open", APPROVED: "Approved", REJECTED: "Rejected", QUORUM_NOT_MET: "No quorum", HISTORICAL: "Published", ABANDONED: "Abandoned" };
const filters = ["To review", "For me", "Closed", "Source decisions"] as const;
type ReviewFilter = (typeof filters)[number];
function matchesFilter(proposal: CommitteeWorkspace["queue"][number], filter: ReviewFilter) {
  return filter === "For me" ? proposal.myPending : filter === "To review" ? ["AWAITING_REVIEW", "OPEN"].includes(proposal.state) : filter === "Closed" ? ["APPROVED", "REJECTED", "QUORUM_NOT_MET", "ABANDONED"].includes(proposal.state) : proposal.state === "HISTORICAL";
}
function CommitteeIcon({ kind }: { kind: "refresh" | "search" | "arrow" | "close" | "info" }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind === "refresh" ? <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" /></> : kind === "search" ? <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></> : kind === "arrow" ? <path d="M5 12h14m-5-5 5 5-5 5" /> : kind === "close" ? <path d="m6 6 12 12M18 6 6 18" /> : <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10h.01" /></>}</svg>;
}
const date = (value: string) => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC";
const sourceDate = (value: string) => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
const getForm = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); return new FormData(event.currentTarget); };

export function CommitteeWorkspacePanel({ initial, initialRecordId }: { initial: CommitteeWorkspace; initialRecordId?: string }) {
  const openHostView = useParticipateHost();
  const [data, setData] = useState(initial), [tab, setTab] = useState<(typeof tabs)[number]>("Reviews");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<ReviewFilter>(() => { const row = initial.queue.find(p => p.recordId === initialRecordId); return row?.state === "HISTORICAL" ? "Source decisions" : row && matchesFilter(row, "Closed") ? "Closed" : "To review"; }), [search, setSearch] = useState(""), [selected, setSelected] = useState<string | null>(initial.queue.some(p => p.recordId === initialRecordId) ? initialRecordId! : null);
  const [editing, setEditing] = useState<string | null>(null), [invitation, setInvitation] = useState<string | null>(null);
  const [panel, setPanel] = useState<CommitteeReviewPanel>(() => { const row = initial.queue.find(p => p.recordId === initialRecordId); return row && matchesFilter(row, "Closed") ? "Finish" : row?.state === "HISTORICAL" ? "Vote" : "Proposal"; });
  const [discussion, setDiscussion] = useState<"source" | "discussion">("source");
  const [inviting, setInviting] = useState(false);
  const guard = useRef(false);
  const reviewPanel = useRef<HTMLDivElement>(null);
  const reviewTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (selected && tab === "Reviews") { reviewPanel.current?.focus({ preventScroll: true }); reviewPanel.current?.scrollIntoView?.({ block: "nearest" }); } }, [selected, tab]);
  useEffect(() => {
    function openReview(event: Event) {
      const destination = (event as CustomEvent<CommitteeReviewDestination>).detail;
      const row = data.queue.find(p => p.hostId === destination?.communityId && p.recordId === destination?.recordId);
      if (!row) return; // A newly arrived record needs a fresh server read through the URL.
      setTab("Reviews"); setSearch(""); setSelected(row.recordId); setError("");
      setFilter(row.state === "HISTORICAL" ? "Source decisions" : matchesFilter(row, "Closed") ? "Closed" : "To review");
      setPanel(matchesFilter(row, "Closed") ? "Finish" : "Proposal");
    }
    window.addEventListener(OPEN_REVIEW_EVENT, openReview);
    return () => window.removeEventListener(OPEN_REVIEW_EVENT, openReview);
  }, [data.queue]);
  function closeReview() { setSelected(null); reviewTrigger.current?.focus({ preventScroll: true }); }
  const explain = (cause: unknown) => setError(cause instanceof Error && messages[cause.message] ? messages[cause.message] : "The workspace could not be updated. Please try again.");
  async function refresh() { try { const next = await passkeyFetch<CommitteeWorkspace>(endpoint, undefined, "GET"); setData(next); setError(""); return next; } catch (cause) { explain(cause); } }
  async function reviewChanged(recordId: string) { const next = await refresh(); const row = next?.queue.find(p => p.recordId === recordId); if (row && matchesFilter(row, "Closed")) { setFilter("Closed"); setPanel("Finish"); } }
  async function mutate(input: unknown, success: string) {
    if (guard.current) return;
    guard.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const result = await passkeyFetch<{ invitationId?: string }>(endpoint, input);
      if (result.invitationId) setInvitation(result.invitationId);
      setEditing(null); setNotice(success); await refresh();
    } catch (cause) { explain(cause); }
    finally { guard.current = false; setBusy(false); }
  }
  async function older() {
    if (!data.historyBefore || guard.current) return;
    guard.current = true; setBusy(true);
    try { const more = await passkeyFetch<CommitteeWorkspace>(`${endpoint}?before=${data.historyBefore}`, undefined, "GET"); setData(previous => ({ ...previous, history: [...previous.history, ...more.history], historyBefore: more.historyBefore })); }
    catch (cause) { explain(cause); }
    finally { guard.current = false; setBusy(false); }
  }
  async function copyInvite(id: string) {
    try { await navigator.clipboard.writeText(new URL(`/zcg/participate?view=committee&invitation=${encodeURIComponent(id)}`, window.location.origin).href); setNotice("Invitation link copied. Share it with the invited email’s owner."); }
    catch { setInvitation(id); setNotice("Copy the invitation path below and share it on this site’s origin."); }
  }
  const reviewers = data.members.filter(m => m.status === "ACTIVE" && reviewerRoles.includes(m.role));
  const ready = reviewers.filter(m => m.ready).length;
  // Keep management totals independent of the current filter and search.
  // Imported source decisions and closed reviews without a verdict are separate records.
  const reviewQueue = data.queue.filter(proposal => proposal.kind !== "HISTORICAL_SUMMARY");
  const reviewSummary = [
    { label: "Awaiting review", count: reviewQueue.filter(proposal => proposal.state === "AWAITING_REVIEW").length },
    { label: "Review started", count: reviewQueue.filter(proposal => proposal.state === "OPEN").length },
    { label: "Decided", count: reviewQueue.filter(proposal => ["APPROVED", "REJECTED"].includes(proposal.state)).length },
  ];
  const shown = data.queue.filter(p => p.title.toLocaleLowerCase("en").includes(search.trim().toLocaleLowerCase("en")) && matchesFilter(p, filter));
  if (filter === "Source decisions") shown.sort((a, b) => (b.sourceDecision?.decisionDate ?? "").localeCompare(a.sourceDecision?.decisionDate ?? "") || a.title.localeCompare(b.title, "en"));

  return <section className="committee-workspace" aria-labelledby="committee-heading">
    <header className="committee-heading">
      <div className="committee-title"><h1 id="committee-heading">Committee</h1>{data.access === "MEMBER" ? <span>{data.name} <i aria-hidden="true">/</i> {data.role ? committeeRoleLabels[data.role] : "Admin preview"}</span> : null}</div>
      <div className="committee-heading-actions">{data.access === "MEMBER" && (data.demo || !data.canMutate) ? <details className="committee-mode"><summary>{data.demo ? "Preview · Read only" : !data.emailReady ? "Verify email" : "Read only"}<CommitteeIcon kind="info" /></summary><p>{data.demo ? "Committee operations are not enabled. This preview cannot submit votes or change decisions." : !data.emailReady ? "Verify your email to make changes." : "Changes are unavailable for this session."}</p></details> : null}<button type="button" className="committee-icon-button" aria-label="Refresh committee" title="Refresh" disabled={busy} onClick={() => void refresh()}><CommitteeIcon kind="refresh" /></button></div>
    </header>
    {error ? <p className="dao-form-error" role="alert">{error}</p> : null}
    {notice ? <p className="committee-notice" role="status">{notice}</p> : null}
    {data.access === "RESTRICTED" ? <div className="committee-empty"><h2>Committee access is restricted</h2><p>The committee workspace is awaiting authorization. Admins can unlock a read-only preview from their profile.</p><Link href="/zcg/participate" className="dao-button" onClick={event => { if (openHostView && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); openHostView("proposals"); } }}>Back to proposals</Link></div> : data.access === "SIGNED_OUT" ? <div className="committee-empty"><h2>Your committee account</h2><p>Sign in with the email that received access.</p><WorkspaceSignInButton label="Sign in" /></div>
      : data.access === "DENIED" ? <div className="committee-empty"><h2>No committee access</h2><p>Ask an owner to invite your verified email. Public proposals remain available.</p><Link href="/zcg/participate" className="dao-button" onClick={event => { if (openHostView && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); openHostView("proposals"); } }}>Back to proposals</Link></div>
      : <>
        {data.invitations.filter(i => i.mine && i.state === "PENDING").map(invite => <form key={invite.id} className="committee-invitation" onSubmit={event => { const f = getForm(event); void mutate({ action: "accept", invitationId: invite.id, publicName: f.get("name"), consent: f.get("consent") === "on" }, "Invitation accepted. Add your passkey under Profile → Passkeys to review."); }}>
          <h2>Join {data.name}</h2><p>{committeeRoleLabels[invite.role]} · expires {date(invite.expiresAt)}</p>
          <label>Public reviewer name<input name="name" minLength={2} maxLength={80} required disabled={busy} autoComplete="nickname" /></label>
          <label className="committee-consent"><input name="consent" type="checkbox" required disabled={busy} />I agree to publish this name with my signed decisions and feedback.</label>
          <button className="dao-button dao-button--primary" disabled={busy}>Accept invitation</button>
        </form>)}
        {data.access === "MEMBER" ? <>
          <dl className="committee-review-summary" aria-label="Review overview">
            {reviewSummary.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.count.toLocaleString("en-US")}</dd></div>)}
          </dl>
          <nav className="committee-tabs" aria-label="Committee sections">{tabs.map(item => <button key={item} type="button" aria-current={tab === item ? "page" : undefined} onClick={() => { setTab(item); setError(""); setSelected(null); }}>{item}</button>)}</nav>
          {tab === "Reviews" ? <>
            <CommitteeReviewGuide data={data} onMembers={() => { setTab("Members"); setSelected(null); }} />
            <div className="committee-tools"><div className="committee-filters" aria-label="Review filters">{filters.map(item => <button type="button" key={item} aria-label={item} aria-pressed={filter === item} onClick={() => { setFilter(item); setSelected(null); }}>{item}<span>{data.queue.filter(p => matchesFilter(p, item)).length}</span></button>)}</div><label className="committee-search"><CommitteeIcon kind="search" /><span className="dao-sr-only">Search committee proposals</span><input type="search" placeholder="Search proposals" value={search} onChange={e => { setSearch(e.target.value); setSelected(null); }} /></label></div>
            <ul className="committee-queue">{shown.map(proposal => {
              const historical = proposal.kind === "HISTORICAL_SUMMARY";
              const source = historical ? proposal.sourceDecision : null;
              const state = source ? source.outcome.toUpperCase() : proposal.state;
              return <li key={proposal.recordId} data-selected={selected === proposal.recordId}>
              <div className="committee-queue-row">
                <div className="committee-proposal"><h2>{proposal.title}</h2><p>{source ? <><time dateTime={source.decisionDate}>{sourceDate(source.decisionDate)}</time> · {source.votes.length} published votes</> : <>v{proposal.revision}{proposal.closesAt && proposal.state !== "ABANDONED" ? <> · {proposal.state === "OPEN" ? "Closes" : "Closed"} <time dateTime={proposal.closesAt}>{date(proposal.closesAt)}</time></> : ` · ${proposal.kind === "REVIEW_SNAPSHOT" || proposal.kind === "SOURCE_PROPOSAL" ? "Application" : proposal.kind === "NATIVE_PROPOSAL" ? "Pilot submission" : "Historical record"}`}{!historical && proposal.roundId ? <span> · {proposal.signed}/{proposal.eligible} signed{proposal.myChoice ? ` · You: ${proposal.myChoice.toLowerCase()}` : ""}</span> : null}</>}</p><CommitteeLabels ids={proposal.labels} /></div>
                <span className={`committee-state committee-state--${state.toLowerCase()}`}>{states[state]}</span>
                <button type="button" className="committee-review-button" aria-label={`${historical ? "View source decision:" : "Review"} ${proposal.title}`} aria-expanded={selected === proposal.recordId} aria-controls={selected === proposal.recordId ? `committee-review-${proposal.recordId}` : undefined} onClick={event => { reviewTrigger.current = event.currentTarget; setSelected(selected === proposal.recordId ? null : proposal.recordId); setPanel(historical ? "Vote" : matchesFilter(proposal, "Closed") ? "Finish" : "Proposal"); }}>{selected === proposal.recordId ? "Close" : historical ? "View decision" : proposal.myPending ? "Your decision" : "Review"}<CommitteeIcon kind={selected === proposal.recordId ? "close" : "arrow"} /></button>
              </div>
              {selected === proposal.recordId ? <div className="committee-review-panel" id={`committee-review-${proposal.recordId}`} ref={reviewPanel} tabIndex={-1} role="region" aria-label={`Review: ${proposal.title}`}>
                <div className="committee-review-context"><span>Revision {proposal.revision} · {historical ? "Published source evidence" : "Independent pilot review"}</span><Link href={`/zcg/participate?record=${encodeURIComponent(proposal.recordId)}`}>View public proposal ↗</Link></div>
                <CommitteeReviewTabs recordId={proposal.recordId} panelId={`committee-content-${proposal.recordId}`} selected={panel} historical={historical} onChange={setPanel} />
                <div className="committee-review-content" role="tabpanel" id={`committee-content-${proposal.recordId}`} aria-labelledby={reviewTabId(proposal.recordId, panel)} tabIndex={0}>
                <details className="committee-tags-disclosure" hidden={panel !== "Proposal"}><summary>Proposal tags</summary><CommitteeLabelEditor key={`${proposal.recordId}:${proposal.labelsVersion}`} recordId={proposal.recordId} labels={proposal.labels} version={proposal.labelsVersion} canReview={data.permissions.canReview} canSave={data.canMutate} demo={data.demo} onReload={async () => { await refresh(); }} onSaved={value => {
                  setData(previous => ({ ...previous, queue: previous.queue.map(row => row.recordId === proposal.recordId ? { ...row, ...value } : row) }));
                  setNotice("Labels saved."); void refresh();
                }} /></details>
                <div hidden={panel !== "Vote"}>{historical ? <CommitteeSourceDecision decision={source} /> : <SignedDecision key={proposal.recordId} endpoint={`/api/communities/${encodeURIComponent(proposal.hostId)}/archives/${encodeURIComponent(proposal.recordId)}`} revision={proposal.revision} initiallyOpen compact readOnlyReason={data.demo ? "Committee operations are disabled. This admin preview cannot open reviews or sign votes." : undefined} visible={panel === "Vote"} onChanged={() => reviewChanged(proposal.recordId)} />}</div>
                {!historical ? <div hidden={panel !== "Finish"}><ReviewFinish endpoint={`/api/communities/${encodeURIComponent(proposal.hostId)}/archives/${encodeURIComponent(proposal.recordId)}`} recordId={proposal.recordId} revision={proposal.revision} roundId={proposal.roundId} visible={panel === "Finish"} /></div> : null}
                {panel === "Discussion" ? <div className="committee-discussion-switch" aria-label="Discussion source"><button type="button" aria-pressed={discussion === "source"} onClick={() => setDiscussion("source")}>Source comments</button><button type="button" aria-pressed={discussion === "discussion"} onClick={() => setDiscussion("discussion")}>OpenZcash</button></div> : null}
                <ProposalInlineDetails committeeReview key={proposal.recordId} communityId={proposal.hostId} recordId={proposal.recordId} active={panel === "Discussion" ? discussion : panel === "Proposal" ? "record" : null} onClose={closeReview} />
                </div>
              </div> : null}
            </li>; })}</ul>
            {!shown.length ? <p className="committee-empty">{filter === "For me" ? data.demo ? "No votes are assigned in this read-only preview." : "No open review is waiting for your vote. A coordinator must open the review first." : "No proposals in this view."}</p> : null}
          </> : tab === "Members" ? <>
            <div className="committee-section-top"><div><h2>Members <span>{data.members.filter(member => member.status === "ACTIVE").length}</span></h2><p>{ready} of {reviewers.length} reviewers ready</p></div>{data.permissions.canManageTeam ? <button type="button" className="dao-button" aria-expanded={inviting} onClick={() => setInviting(!inviting)}>{inviting ? "Cancel invitation" : "+ Invite member"}</button> : null}</div>
            {data.permissions.canManageTeam && inviting ? <form className="committee-invite-form" onSubmit={event => { const f = getForm(event); void mutate({ action: "invite", email: f.get("email"), role: f.get("role") }, "Invitation created. Share its link; no email has been sent."); }}><label>Email<input name="email" type="email" required maxLength={254} placeholder="member@example.org" disabled={busy || !data.canMutate} /></label><label>Role<select name="role" defaultValue="REVIEWER" disabled={busy || !data.canMutate}><option value="REVIEWER">Reviewer</option><option value="MANAGER">Coordinator</option><option value="MODERATOR">Moderator</option></select></label><button className="dao-button dao-button--primary" disabled={busy || !data.canMutate}>Create invitation</button></form> : null}
            {invitation ? <p className="committee-invite-link"><code>/zcg/participate?view=committee&invitation={invitation}</code><button type="button" className="dao-text-button" onClick={() => void copyInvite(invitation)}>Copy link</button></p> : null}
            <ul className="committee-members">{data.members.map(member => <li key={member.id}>
              <div className="committee-member-identity"><AccountAvatar name={member.name} src={member.avatar} /><div><strong>{member.name}{member.isMe ? " · You" : ""}</strong>{member.email ? <span>{member.email}</span> : null}</div></div>
              <div className="committee-member-state"><span>{member.status === "DISABLED" ? "Removed" : committeeRoleLabels[member.role]}</span><small>{member.status === "DISABLED" ? "Past decisions preserved" : !reviewerRoles.includes(member.role) ? "Discussion only" : member.ready ? "Ready to sign" : !member.emailVerified ? "Email verification needed" : !member.keyCount ? "Passkey needed" : "Account not ready"}</small></div>
              {data.permissions.canManageTeam && member.role !== "OWNER" && !member.isMe ? <button type="button" className="dao-text-button" disabled={busy || !data.canMutate} onClick={() => setEditing(editing === member.id ? null : member.id)}>Manage</button> : null}
              {editing === member.id ? <form className="committee-member-edit" onSubmit={event => { const f = getForm(event); void mutate({ action: "member", memberId: member.id, version: member.version, role: f.get("role"), status: f.get("status"), reason: f.get("reason") }, "Access updated for future reviews."); }}><label>Role<select name="role" defaultValue={member.role} disabled={busy}><option value="REVIEWER">Reviewer</option><option value="MANAGER">Coordinator</option><option value="MODERATOR">Moderator</option></select></label><label>Access<select name="status" defaultValue={member.status} disabled={busy}><option value="ACTIVE">Active</option><option value="DISABLED">Removed</option></select></label><label className="committee-edit-reason">Reason<input name="reason" required minLength={5} maxLength={500} disabled={busy} /></label><p>Applies to future reviews. Open reviews and past signatures stay unchanged.</p><button className="dao-button dao-button--primary" disabled={busy}>Save access</button><button type="button" className="dao-text-button" disabled={busy} onClick={() => setEditing(null)}>Cancel</button></form> : null}
            </li>)}</ul>
            {data.invitations.length ? <section className="committee-invitations"><h2>Invitations</h2>{data.invitations.map(invite => <div key={invite.id}><div><strong>{invite.email}</strong><span>{committeeRoleLabels[invite.role]} · {invite.state.toLowerCase()} · {date(invite.expiresAt)}</span></div>{invite.state === "PENDING" && data.permissions.canManageTeam ? <><button type="button" className="dao-text-button" onClick={() => void copyInvite(invite.id)}>Copy link</button><button type="button" className="dao-text-button" disabled={busy || !data.canMutate} onClick={() => void mutate({ action: "revoke-invite", invitationId: invite.id }, "Invitation revoked.")}>Revoke</button></> : null}</div>)}</section> : null}
            <details className="committee-help"><summary>Roles & account setup</summary><div><p>Owners manage access. Coordinators open reviews. Reviewers vote. Moderators manage discussions.</p><p>Reviewers need a verified email and a passkey.</p>{!data.emailReady ? <p>Email delivery is awaiting sender configuration.</p> : null}</div></details>
          </> : tab === "Rules" ? <section className="committee-rules">
            <div className="committee-section-top"><div><h2>Review rules</h2><p>No deadline. Result after all 5 votes.</p></div></div>
            <CommitteeDecisionRule />
            <CommitteeCountingHelp />
          </section>
            : <section className="committee-history"><div className="committee-section-top"><h2>Activity</h2><span>UTC</span></div>{data.history.length ? <ol>{data.history.map(event => <li key={event.id}><span className="committee-event-number">{event.sequence.toString().padStart(2, "0")}</span><div><strong>{event.summary}</strong><p>{event.actor} <span aria-hidden="true">·</span> <time dateTime={event.createdAt}>{date(event.createdAt)}</time></p><details><summary>Verify record</summary><code>{event.hash}</code></details></div></li>)}</ol> : <p className="committee-empty">Committee actions will appear here.</p>}{data.historyBefore ? <button className="dao-button" type="button" disabled={busy} onClick={() => void older()}>Load earlier</button> : null}<details className="committee-help"><summary>About this history</summary><div><p>Access changes, rules, review openings and decisions recorded by this application. Signed review receipts provide separate cryptographic verification.</p></div></details></section>}
        </> : null}
      </>}
  </section>;
}
