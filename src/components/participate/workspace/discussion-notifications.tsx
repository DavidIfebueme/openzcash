"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountAvatar } from "@/components/participate/workspace/workspace-account";
import { OPEN_COMMENT_EVENT, OPEN_REVIEW_EVENT, type CommitteeReviewDestination, type CommentDestination, type DiscussionInbox, type DiscussionNotificationItem } from "@/lib/participate/workspace/domain/discussion-notifications";

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export function DiscussionNotifications({ communityId }: { communityId: string }) {
  const router = useRouter();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const writing = useRef(false);
  const [open, setOpen] = useState(false);
  const [inbox, setInbox] = useState<DiscussionInbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const endpoint = `/api/account/notifications?communityId=${encodeURIComponent(communityId)}&include=proposals`;
  const cancelLoad = useCallback(() => {
    generation.current++;
    controller.current?.abort();
  }, []);

  const load = useCallback(async (cursor?: string) => {
    if (writing.current) return;
    const version = ++generation.current;
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setLoading(true);
    try {
      const response = await fetch(`${endpoint}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store", credentials: "same-origin", signal: request.signal });
      if (!response.ok) {
        if ([401, 403].includes(response.status) && version === generation.current) setInbox(null);
        throw new Error("Unavailable");
      }
      const result = await response.json() as DiscussionInbox;
      if (!Array.isArray(result.items) || typeof result.unreadCount !== "number") throw new Error("Invalid inbox");
      if (version !== generation.current || request.signal.aborted) return;
      setInbox(previous => cursor && previous ? { ...result, asOf: previous.asOf, items: [...previous.items, ...result.items.filter(item => !previous.items.some(old => old.id === item.id))] } : result);
      setError("");
    } catch {
      if (version === generation.current && !request.signal.aborted) setError("Could not refresh notifications.");
    } finally { if (version === generation.current && !request.signal.aborted) setLoading(false); }
  }, [endpoint]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== "hidden") void load(); };
    refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { cancelLoad(); window.clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [load, cancelLoad]);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    function outside(event: PointerEvent) { if (!root.current?.contains(event.target as Node)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); } }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  async function markRead(item?: DiscussionNotificationItem) {
    if (writing.current || !inbox) return false;
    writing.current = true; setSaving(true); setError("");
    cancelLoad(); setLoading(false);
    try {
      const response = await fetch(endpoint, { method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(item ? { ids: [item.id] } : { through: inbox.asOf }) });
      if (!response.ok) {
        if ([401, 403].includes(response.status)) setInbox(null);
        throw new Error("Unavailable");
      }
      const { updated } = await response.json();
      if (typeof updated !== "number") throw new Error("Invalid response");
      setInbox(previous => previous ? { ...previous, unreadCount: Math.max(0, previous.unreadCount - updated),
        items: previous.items.map(row => (!item && row.createdAt <= inbox.asOf) || row.id === item?.id ? { ...row, read: true } : row) } : previous);
      return true;
    } catch { setError("Could not mark notifications as read. Try again."); return false; }
    finally { writing.current = false; setSaving(false); }
  }

  async function visit(item: DiscussionNotificationItem) {
    if (writing.current || (!item.read && !await markRead(item))) return;
    setOpen(false);
    if (item.kind === "PROPOSAL_ARRIVED") {
      const destination: CommitteeReviewDestination = { communityId, recordId: item.recordId };
      const event = new CustomEvent(OPEN_REVIEW_EVENT, { detail: destination });
      window.dispatchEvent(event);
      router.push(`/zcg/participate?view=committee&record=${encodeURIComponent(item.recordId)}`);
      return;
    }
    const destination: CommentDestination = { communityId, recordId: item.recordId, commentId: item.commentId };
    const event = new CustomEvent(OPEN_COMMENT_EVENT, { detail: destination, cancelable: true });
    // The proposal list claims this event to open the exact conversation in place.
    if (window.dispatchEvent(event)) router.push(`/zcg/participate?record=${encodeURIComponent(item.recordId)}&comment=${encodeURIComponent(item.commentId)}`);
  }

  const unread = inbox?.unreadCount ?? 0;
  return <div ref={root} className="discussion-notifications" onBlur={event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className="discussion-notifications-trigger" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} aria-expanded={open} aria-controls={open ? id : undefined} aria-haspopup="dialog" onClick={() => { setOpen(!open); if (!open) void load(); }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      {unread > 0 ? <span className="discussion-notifications-count" aria-hidden="true">{unread > 99 ? "99+" : unread}</span> : null}
    </button>
    {open ? <section id={id} role="dialog" aria-label="Notifications" className="discussion-notifications-panel">
      <header><h2>Notifications</h2><button ref={closeButton} type="button" className="discussion-notifications-close" aria-label="Close notifications" onClick={() => { setOpen(false); trigger.current?.focus(); }}>×</button></header>
      {unread > 0 ? <div className="discussion-notifications-toolbar"><span>{unread} unread</span><button type="button" disabled={saving || loading} onClick={() => void markRead()}>Mark all as read</button></div> : null}
      {error ? <div className="discussion-notifications-error" role="alert"><p>{error}</p><button type="button" disabled={loading || saving} onClick={() => void load()}>Refresh</button></div> : null}
      {loading && !inbox ? <p className="discussion-notifications-empty" role="status">Loading notifications…</p> : inbox && !inbox.items.length ? <div className="discussion-notifications-empty"><strong>You’re all caught up</strong><p>New proposals, replies and likes appear here.</p></div> : null}
      {inbox?.items.length ? <ul className="discussion-notifications-list">{inbox.items.map(item => <li key={item.id}>
        <button type="button" className={`discussion-notification${item.read ? "" : " discussion-notification--unread"}`} disabled={saving} onClick={() => void visit(item)}>
          {item.kind === "PROPOSAL_ARRIVED" ? <span className="discussion-notification-proposal-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" /></svg></span>
            : <AccountAvatar name={item.actorLabel} src={item.actorAvatarUrl} className="dao-comment-avatar" />}
          <span className="discussion-notification-copy"><span>{item.kind === "PROPOSAL_ARRIVED" ? <strong>New proposal to review</strong> : <><strong>{item.actorLabel}</strong> {item.kind === "COMMENT_LIKED" ? "liked your comment" : "replied to your comment"}</>}</span><span className="discussion-notification-proposal">{item.proposalTitle}</span><span className="discussion-notification-excerpt">{item.excerpt}</span><time dateTime={item.createdAt}>{dateFormat.format(new Date(item.createdAt))}</time></span>
          {!item.read ? <span className="discussion-notification-dot"><span className="dao-sr-only">Unread</span></span> : null}
        </button>
      </li>)}</ul> : null}
      {inbox?.nextCursor ? <button type="button" className="discussion-notifications-more" disabled={loading || saving} onClick={() => void load(inbox.nextCursor!)}>{loading ? "Loading…" : "Load older notifications"}</button> : null}
    </section> : null}
  </div>;
}
