"use client";

import { CommentEmojiPicker } from "./comment-emoji-picker";
import { AccountAvatar } from "@/components/participate/workspace/workspace-account";
import type { CreditScope } from "@/lib/participate/workspace/domain/credit-scope";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";

export type DiscussionComment = {
  id: string;
  parentId: string | null;
  authorLabel: string;
  authorNick?: string;
  authorAvatarUrl?: string | null;
  createdAt: string;
  body: string | null;
  hidden: boolean;
  moderation: { reason: string; moderatorLabel: string; hiddenAt: string } | null;
  reaction?: { count: number; likedByMe: boolean; chargedBefore: boolean };
};
export type DiscussionCapabilities = { canPost: boolean; canModerate: boolean; canReact?: boolean };
export type DiscussionParticipation = {
  communityId?: string;
  creditScope?: CreditScope;
  mode: "FREE" | "CREDITS";
  commentCost: number;
  reactionCost: number;
  version: number;
  availableCredits: number | null;
  paymentReview?: boolean;
  sponsored: boolean;
  sandbox: boolean;
};
export type DiscussionPolicy = {
  visibility: "INVITED_PARTICIPANTS" | "PUBLIC";
  immutable: true;
  maxLength: number;
  readOnly: boolean;
  participation?: DiscussionParticipation;
};
export type ProposalDiscussionProps = {
  pollId: string;
  sectionId?: string;
  embedded?: boolean;
  showBalance?: boolean;
  commentsEndpoint?: string;
  communityId?: string;
  initialComments: DiscussionComment[];
  capabilities: DiscussionCapabilities;
  policy: DiscussionPolicy;
  loading?: boolean;
  expectedCommentCount?: number;
};

const ERRORS: Record<string, string> = {
  unauthorized: "Sign in again to continue.",
  forbidden: "Your account does not have access to this discussion.",
  forbidden_origin: "This request could not be verified. Reload the page and try again.",
  INVALID_COMMENT_INPUT: "Write a comment within the allowed length.",
  INVALID_MODERATION_INPUT: "Enter a reason of up to 500 characters.",
  PROPOSAL_NOT_FOUND: "This proposal is no longer available to your account.",
  COMMENT_NOT_FOUND: "This comment is no longer available.",
  PARENT_COMMENT_NOT_FOUND: "The comment you are replying to is no longer available.",
  DISCUSSION_READ_ONLY: "This discussion is now read only.",
  REPLY_DEPTH_EXCEEDED: "Replies are limited to one level. Reply to the original comment.",
  COMMENT_ALREADY_HIDDEN: "This comment has already been hidden.",
  CONCURRENT_UPDATE: "The discussion changed while saving. Reload the page and review the latest record.",
  COMMENT_RATE_LIMIT: "You’ve posted several comments recently. Please wait before trying again.",
  REACTION_RATE_LIMIT: "You’ve updated several likes recently. Please wait before trying again.",
  INSUFFICIENT_PARTICIPATION_CREDITS: "You don’t have enough credits for this action. Add credits to continue.",
  INSUFFICIENT_CREDITS: "You don’t have enough credits for this action. Add credits to continue.",
  PARTICIPATION_POLICY_CHANGED: "The participation cost has changed. Review the updated cost before trying again.",
  POLICY_CHANGED: "The participation cost has changed. Review the updated cost before trying again.",
  PARTICIPATION_CREDITS_UNAVAILABLE: "Credits are unavailable for this account. Please try again later.",
  CREDIT_PAYMENT_REVIEW: "A payment needs review. Credit spending is paused.",
  CREDIT_IDEMPOTENCY_CONFLICT: "This request no longer matches its original action. Refresh the discussion before trying again.",
  COMMENT_IDEMPOTENCY_CONFLICT: "This request no longer matches its original comment. Refresh the discussion before trying again.",
  REACTION_IDEMPOTENCY_CONFLICT: "This request no longer matches its original like. Refresh the discussion before trying again.",
  INVALID_REACTION_INPUT: "This like could not be recorded. Refresh the discussion and try again."
};
const POLICY_CHANGED_ERRORS = new Set(["PARTICIPATION_POLICY_CHANGED", "POLICY_CHANGED"]);
const LOW_CREDIT_ERRORS = new Set(["INSUFFICIENT_PARTICIPATION_CREDITS", "INSUFFICIENT_CREDITS"]);
type DiscussionSnapshot = { comments: DiscussionComment[]; capabilities: DiscussionCapabilities; policy: DiscussionPolicy };
type ActionRequest = { signature: string; requestKey: string; policyVersion?: number };
type ActionError = { message: string; needsCredits?: boolean };

function creditLabel(amount: number) {
  return `${amount.toLocaleString("en-US")} Zcred`;
}

function actionRequest(signature: string, participation?: DiscussionParticipation): ActionRequest {
  return { signature, requestKey: crypto.randomUUID(), ...(participation?.mode === "CREDITS" ? { policyVersion: participation.version } : {}) };
}

function reactionCost(comment: DiscussionComment, participation?: DiscussionParticipation) {
  return participation?.mode === "CREDITS" && !participation.sponsored && !comment.reaction?.likedByMe && !comment.reaction?.chargedBefore
    ? participation.reactionCost : 0;
}
const commentDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });
function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : commentDate.format(date);
}

export function ProposalDiscussion(props: ProposalDiscussionProps) {
  return <DiscussionBody key={props.pollId} {...props} />;
}

function DiscussionBody({ pollId, sectionId = "discussion", embedded = false, showBalance = true, commentsEndpoint, communityId, initialComments, capabilities: initialCapabilities, policy: initialPolicy, loading = false, expectedCommentCount }: ProposalDiscussionProps) {
  const router = useRouter();
  const commentsUrl = commentsEndpoint ?? `/api/polls/${encodeURIComponent(pollId)}/comments`;
  const fieldId = useId();
  const composer = useRef<HTMLTextAreaElement>(null);
  const [commentUpdate, setCommentUpdate] = useState<{ source: DiscussionComment[]; items: DiscussionComment[] } | null>(null);
  const [snapshot, setSnapshot] = useState<{ source: DiscussionPolicy; sourceComments: DiscussionComment[]; value: DiscussionSnapshot } | null>(null);
  const currentSnapshot = snapshot?.source === initialPolicy && snapshot.sourceComments === initialComments ? snapshot.value : null;
  const policy = currentSnapshot?.policy ?? initialPolicy;
  const capabilities = currentSnapshot?.capabilities ?? initialCapabilities;
  const comments = commentUpdate?.source === initialComments ? commentUpdate.items : currentSnapshot?.comments ?? initialComments;
  const [order, setOrder] = useState<"oldest" | "newest">("oldest");
  const [replyTo, setReplyTo] = useState<DiscussionComment | null>(null);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [reactingId, setReactingId] = useState<string | null>(null);
  const [error, setError] = useState<ActionError | null>(null);
  const [reactionErrors, setReactionErrors] = useState<Record<string, ActionError | undefined>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [paymentReviewDetected, setPaymentReviewDetected] = useState(false);
  const actionPending = useRef(false);
  const creditsRefreshPending = useRef(false);
  const refreshSequence = useRef(0);
  const postRequest = useRef<ActionRequest | null>(null);
  const likeRequests = useRef(new Map<string, ActionRequest>());
  const roots = useMemo(() => comments.filter((comment) => comment.parentId === null).sort((a, b) => order === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)), [comments, order]);
  const canPost = capabilities.canPost && !policy.readOnly;
  const canModerate = capabilities.canModerate && !policy.readOnly;
  const canReact = capabilities.canReact === true && !policy.readOnly;
  const maxLength = Math.min(policy.maxLength, 4000);
  const participation = policy.participation;
  const paid = participation?.mode === "CREDITS" && !participation.sponsored;
  const commentCost = paid ? participation.commentCost : 0;
  const busy = posting || reactingId !== null;
  const participationUnavailable = Boolean(loading || (paid && (refreshFailed || refreshing)));
  const creditSpendingPaused = Boolean(paid && (participation.paymentReview || paymentReviewDetected));
  const spaceId = participation?.communityId ?? communityId;

  const refreshDiscussion = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    setRefreshing(true);
    try {
      const response = await fetch(commentsUrl, { cache: "no-store" });
      const result = await response.json().catch(() => null) as DiscussionSnapshot | null;
      if (!response.ok || !result || !Array.isArray(result.comments) || !result.policy || !result.capabilities) throw new Error("Discussion unavailable");
      if (sequence === refreshSequence.current) {
        setSnapshot({ source: initialPolicy, sourceComments: initialComments, value: result });
        setCommentUpdate({ source: initialComments, items: result.comments });
        setRefreshFailed(false);
        // Only an explicit, current account state can clear a payment-review pause.
        setPaymentReviewDetected(current => result.policy.participation?.paymentReview ?? current);
      }
    } catch {
      if (sequence === refreshSequence.current) setRefreshFailed(true);
    } finally {
      if (sequence === refreshSequence.current) setRefreshing(false);
    }
  }, [commentsUrl, initialComments, initialPolicy]);

  useEffect(() => {
    function creditsUpdated(event: Event) {
      const changedCommunity = (event as CustomEvent<{ communityId?: string }>).detail?.communityId;
      if (changedCommunity && spaceId && changedCommunity !== spaceId) return;
      if (actionPending.current) creditsRefreshPending.current = true;
      else void refreshDiscussion();
    }
    window.addEventListener("dao:credits-updated", creditsUpdated);
    window.addEventListener("participate:moderation-updated", creditsUpdated);
    return () => { window.removeEventListener("dao:credits-updated", creditsUpdated); window.removeEventListener("participate:moderation-updated", creditsUpdated); };
  }, [refreshDiscussion, spaceId]);

  function openCredits() {
    window.dispatchEvent(new CustomEvent("dao:open-credits", { detail: { communityId: spaceId, creditScope: participation?.creditScope } }));
  }

  function finishAction() {
    actionPending.current = false;
    if (creditsRefreshPending.current) {
      creditsRefreshPending.current = false;
      void refreshDiscussion();
    }
  }

  function setComments(update: (current: DiscussionComment[]) => DiscussionComment[]) {
    setCommentUpdate((current) => ({ source: initialComments, items: update(current?.source === initialComments ? current.items : currentSnapshot?.comments ?? initialComments) }));
  }

  function reply(comment: DiscussionComment) {
    setReplyTo(comment);
    setError(null);
    setNotice(null);
    composer.current?.focus();
    composer.current?.scrollIntoView({ block: "center", behavior: "auto" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = body.trim();
    if (actionPending.current || !canPost || participationUnavailable || creditSpendingPaused) return;
    if (!text || text.length > maxLength) {
      setError({ message: `Write a comment between 1 and ${maxLength.toLocaleString("en-US")} characters.` });
      return;
    }
    const parentId = replyTo?.id ?? null;
    const signature = JSON.stringify({ body: text, parentId });
    if (postRequest.current?.signature !== signature) postRequest.current = actionRequest(signature, participation);
    const request = postRequest.current;
    actionPending.current = true;
    setPosting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(commentsUrl, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text, parentId, requestKey: request.requestKey, policyVersion: request.policyVersion })
      });
      const result = await response.json().catch(() => null) as { error?: string; comment?: DiscussionComment; participation?: DiscussionParticipation } | null;
      if (!response.ok || !result?.comment) {
        const code = result?.error ?? "";
        setError({ message: ERRORS[code] ?? "Your comment could not be posted. Please try again.", needsCredits: LOW_CREDIT_ERRORS.has(code) });
        if (POLICY_CHANGED_ERRORS.has(code)) {
          postRequest.current = null;
          await refreshDiscussion();
        } else if (code === "CREDIT_PAYMENT_REVIEW") {
          setPaymentReviewDetected(true);
          await refreshDiscussion();
        }
        return;
      }
      const nextComment = result.comment;
      setComments((current) => current.some((comment) => comment.id === nextComment.id) ? current : [...current, nextComment]);
      setBody(""); setReplyTo(null); setNotice("Comment published.");
      postRequest.current = null;
      if (result.participation) {
        setSnapshot({ source: initialPolicy, sourceComments: initialComments, value: { comments: initialComments, capabilities, policy: { ...policy, participation: result.participation } } });
        setRefreshFailed(false);
        setPaymentReviewDetected(Boolean(result.participation.paymentReview));
      } else if (participation) await refreshDiscussion();
      else router.refresh();
      window.dispatchEvent(new CustomEvent("dao:participation-updated", { detail: { communityId: spaceId, creditScope: participation?.creditScope } }));
    } catch {
      setError({ message: "The connection was interrupted. Your draft is still here. Retry to safely check and complete the same request." });
    } finally {
      finishAction();
      setPosting(false);
    }
  }

  async function toggleReaction(comment: DiscussionComment) {
    if (actionPending.current || !canReact || comment.hidden || participationUnavailable || (creditSpendingPaused && reactionCost(comment, participation) > 0)) return;
    const liked = !comment.reaction?.likedByMe;
    const signature = JSON.stringify({ liked });
    let request = likeRequests.current.get(comment.id);
    if (request?.signature !== signature) {
      request = actionRequest(signature, participation);
      likeRequests.current.set(comment.id, request);
    }
    actionPending.current = true;
    setReactingId(comment.id);
    setReactionErrors(current => ({ ...current, [comment.id]: undefined }));
    setComments(current => current.map(item => item.id === comment.id ? { ...item, reaction: {
      count: Math.max(0, (item.reaction?.count ?? 0) + (liked ? 1 : -1)), likedByMe: liked, chargedBefore: item.reaction?.chargedBefore ?? false
    } } : item));
    try {
      const response = await fetch(`${commentsUrl}/${encodeURIComponent(comment.id)}/reaction`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ liked, requestKey: request.requestKey, policyVersion: request.policyVersion })
      });
      const result = await response.json().catch(() => null) as { error?: string; comment?: DiscussionComment; participation?: DiscussionParticipation } | null;
      if (!response.ok || !result?.comment) {
        setComments(current => current.map(item => item.id === comment.id ? comment : item));
        const code = result?.error ?? "";
        setReactionErrors(current => ({ ...current, [comment.id]: {
          message: ERRORS[code] ?? "Your like could not be saved. Please try again.", needsCredits: LOW_CREDIT_ERRORS.has(code)
        } }));
        if (POLICY_CHANGED_ERRORS.has(code)) {
          likeRequests.current.delete(comment.id);
          await refreshDiscussion();
        } else if (code === "CREDIT_PAYMENT_REVIEW") {
          setPaymentReviewDetected(true);
          await refreshDiscussion();
        }
        return;
      }
      const updated = result.comment;
      setComments(current => current.map(item => item.id === updated.id ? updated : item));
      likeRequests.current.delete(comment.id);
      if (result.participation) {
        setSnapshot({ source: initialPolicy, sourceComments: initialComments, value: { comments: initialComments, capabilities, policy: { ...policy, participation: result.participation } } });
        setRefreshFailed(false);
        setPaymentReviewDetected(Boolean(result.participation.paymentReview));
      } else await refreshDiscussion();
      window.dispatchEvent(new CustomEvent("dao:participation-updated", { detail: { communityId: spaceId, creditScope: participation?.creditScope, skipBoardRefresh: true } }));
    } catch {
      setComments(current => current.map(item => item.id === comment.id ? comment : item));
      setReactionErrors(current => ({ ...current, [comment.id]: { message: "The connection was interrupted. Retry this like to safely complete the same request." } }));
    } finally {
      finishAction();
      setReactingId(null);
    }
  }

  function renderComment(comment: DiscussionComment, root: boolean) {
    return <CommentItem comment={comment} permalink={!embedded} commentsUrl={commentsUrl} canReply={root && canPost} replyDisabled={posting} canModerate={canModerate}
      canReact={canReact} reactionDisabled={busy || participationUnavailable || (creditSpendingPaused && reactionCost(comment, participation) > 0)} reactionPending={reactingId === comment.id}
      reactionCost={reactionCost(comment, participation)} reactionError={reactionErrors[comment.id]} onReact={toggleReaction} onOpenCredits={openCredits}
      onReply={reply} onUpdated={updated => setComments(current => current.map(item => item.id === updated.id ? updated : item))} />;
  }

  return <section className={`dao-discussion ${embedded ? "proposal-inline-discussion" : "dao-panel"}`} id={sectionId} aria-labelledby={`${fieldId}-heading`}>
    <div className="dao-section-heading"><div><p className="dao-eyebrow">{policy.visibility === "PUBLIC" ? "Community perspectives" : "Before we decide"}</p><h2 id={`${fieldId}-heading`}>Discussion <span className="dao-count">{loading ? expectedCommentCount ?? comments.length : comments.length}</span></h2></div><label className="dao-comment-sort"><span className="dao-sr-only">Comment order</span><select value={order} onChange={(event) => setOrder(event.target.value as "oldest" | "newest")}><option value="oldest">Oldest first</option><option value="newest">Newest first</option></select></label></div>
    {loading ? <p className="proposal-inline-state" role="status">Loading latest comments…</p> : null}
    {!embedded ? <p className="dao-discussion-policy">{policy.visibility === "PUBLIC" ? "Public discussion · Separate from ZCG review and decisions." : "Visible to assigned participants and community managers. Comments are separate from ballots and formal reviews."}</p> : null}
    {canPost ? <form className="dao-comment-composer" onSubmit={submit}>
      <div className="dao-composer-heading"><label className={embedded && !replyTo ? "dao-sr-only" : undefined} htmlFor={`${fieldId}-comment`}>{replyTo ? `Reply to ${replyTo.authorLabel}` : "Add to the discussion"}</label>{replyTo ? <button type="button" className="dao-text-button" disabled={posting} onClick={() => setReplyTo(null)}>Cancel reply</button> : null}</div>
      {replyTo ? <p className="dao-reply-context">{replyTo.hidden ? "Comment hidden by a moderator" : replyTo.body}</p> : null}
      <textarea id={`${fieldId}-comment`} ref={composer} value={body} onChange={(event) => setBody(event.target.value)} placeholder={embedded ? "Add a comment…" : "Share a question, a perspective, or something the community should consider."} required maxLength={maxLength} rows={embedded ? 2 : 4} disabled={posting} aria-describedby={`${fieldId}-hint`} />
      {participation && (paid || participation.sponsored) && (!embedded || showBalance || refreshing || refreshFailed || (participation.availableCredits !== null && participation.availableCredits < commentCost)) ? <div className="dao-participation-meta" id={`${fieldId}-participation`}>
        <div className="dao-participation-balance">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="8" /><path d="M9 9h6m-6 3h6m-6 3h4" /></svg>
          <span>{participation.sponsored ? "Participation sponsored" : refreshing ? "Updating credits…" : refreshFailed ? (showBalance ? "Balance unavailable" : "Credits unavailable") : showBalance ? (participation.availableCredits === null ? "Credits unavailable" : `${creditLabel(participation.availableCredits)} available`) : `${creditLabel(commentCost)} per comment`}</span>
          {paid && participation.sandbox ? <span className="dao-credit-demo">Demo Zcred</span> : null}
        </div>
        {!participation.sponsored ? <button className="dao-credit-link" type="button" onClick={openCredits}>{participation.availableCredits !== null && participation.availableCredits < commentCost ? "Get Zcred" : "Credits"}</button> : null}
      </div> : null}
      <div className="dao-composer-footer">
        <div className="dao-composer-meta">
          <CommentEmojiPicker textareaRef={composer} value={body} onChange={setBody} maxLength={maxLength} disabled={posting} />
          <p id={`${fieldId}-hint`}>{commentsEndpoint?.includes("/archives/") ? (embedded ? "Public · Cannot be edited after publishing." : "Public and preserved for verification. Cannot be edited.") : "Published comments cannot be edited."}{!embedded || body.length > maxLength * .9 ? <span>{body.length.toLocaleString("en-US")} / {maxLength.toLocaleString("en-US")}</span> : null}</p>
        </div>
        <button type="submit" className="dao-button dao-button--primary" disabled={busy || participationUnavailable || creditSpendingPaused || !body.trim()} aria-describedby={`${fieldId}-hint`}>
          {posting ? "Publishing…" : commentCost > 0 ? `${replyTo ? "Publish reply" : "Publish"} · ${creditLabel(commentCost)}` : replyTo ? "Publish reply" : "Publish comment"}
        </button>
      </div>
    </form> : <p className="dao-read-only">{policy.readOnly ? "This discussion is read only." : policy.visibility === "PUBLIC" ? (capabilities.canReact ? "The comment limit has been reached. Likes and moderation remain available." : "Sign in with an active account to comment and like.") : "Commenting is available to assigned participants and community managers."}</p>}
    {error ? <div className="dao-error dao-participation-error" role="alert"><span>{error.message}</span>{error.needsCredits ? <button type="button" className="dao-credit-link" onClick={openCredits}>Get Zcred</button> : null}</div> : null}
    {notice ? <p className="dao-notice" role="status">{notice}</p> : null}
    {creditSpendingPaused ? <p className="dao-error" role="alert">A payment needs review. Credit spending is paused.</p> : null}
    {refreshFailed ? <div className="dao-participation-refresh" role="status"><span>The latest discussion and credit balance could not be loaded.</span><button type="button" className="dao-credit-link" disabled={refreshing || busy} onClick={() => void refreshDiscussion()}>{refreshing ? "Refreshing…" : "Refresh discussion"}</button></div> : null}
    <ol className="dao-comment-list">{roots.map(comment => <li key={comment.id}>
      {renderComment(comment, true)}
      {comments.some(item => item.parentId === comment.id) ? <ol className="dao-comment-replies">{comments.filter(item => item.parentId === comment.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(item => <li key={item.id}>{renderComment(item, false)}</li>)}</ol> : null}
    </li>)}</ol>
    {roots.length === 0 && !embedded ? <div className="dao-discussion-empty"><p>There’s room for your perspective.</p><span>No comments have been published yet.</span></div> : null}
  </section>;
}

type CommentItemProps = {
  comment: DiscussionComment;
  permalink: boolean;
  commentsUrl: string;
  canReply: boolean;
  replyDisabled: boolean;
  canModerate: boolean;
  canReact: boolean;
  reactionDisabled: boolean;
  reactionPending: boolean;
  reactionCost: number;
  reactionError?: ActionError;
  onReply: (comment: DiscussionComment) => void;
  onUpdated: (comment: DiscussionComment) => void;
  onReact: (comment: DiscussionComment) => void;
  onOpenCredits: () => void;
};

function CommentItem({ comment, permalink, commentsUrl, canReply, replyDisabled, canModerate, canReact, reactionDisabled, reactionPending, reactionCost: cost, reactionError, onReply, onUpdated, onReact, onOpenCredits }: CommentItemProps) {
  const router = useRouter();
  const fieldId = useId();
  const [moderating, setModerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const liked = comment.reaction?.likedByMe ?? false;
  const likeCount = comment.reaction?.count ?? 0;
  const reactionLabel = `${liked ? "Remove like from" : "Like"} ${comment.authorLabel}’s comment. ${likeCount.toLocaleString("en-US")} ${likeCount === 1 ? "like" : "likes"}${cost > 0 ? `. ${creditLabel(cost)}` : ""}`;

  async function hide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !canModerate) return;
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    if (!reason || reason.length > 500) { setError("Enter a reason between 1 and 500 characters."); return; }
    setSaving(true); setError(null);
    try {
      const response = await fetch(`${commentsUrl}/${encodeURIComponent(comment.id)}/hide`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }) });
      const result = await response.json().catch(() => null) as { error?: string; comment?: DiscussionComment } | null;
      if (!response.ok || !result?.comment) { setError(ERRORS[result?.error ?? ""] ?? "The comment could not be hidden. Please try again."); return; }
      onUpdated(result.comment); setModerating(false); router.refresh();
      window.dispatchEvent(new CustomEvent("dao:participation-updated", { detail: { communityId: commentsUrl.split("/communities/")[1]?.split("/")[0] } }));
    } catch { setError("The connection was interrupted. Reload to check the moderation record before retrying."); }
    finally { setSaving(false); }
  }

  return <article className={`dao-comment${comment.hidden ? " dao-comment--hidden" : ""}`} id={`comment-${comment.id}`} tabIndex={-1}>
    <header className="dao-comment-header"><AccountAvatar name={comment.authorLabel} src={comment.authorAvatarUrl} className="dao-comment-avatar" /><strong>{comment.authorLabel}{comment.authorNick && comment.authorNick !== comment.authorLabel ? <small className="dao-comment-username">@{comment.authorNick}</small> : null}</strong>{permalink ? <a className="dao-comment-permalink" href={`#comment-${comment.id}`} aria-label={`Permanent link to ${comment.authorLabel}’s comment`}><time dateTime={comment.createdAt}>{displayDate(comment.createdAt)}</time></a> : <time className="dao-comment-permalink" dateTime={comment.createdAt}>{displayDate(comment.createdAt)}</time>}</header>
    {comment.hidden ? <div className="dao-comment-tombstone"><p>Comment hidden by a moderator</p>{comment.moderation ? <><p className="dao-moderation-reason">{comment.moderation.reason}</p><span>{comment.moderation.moderatorLabel}<span aria-hidden="true"> · </span><time dateTime={comment.moderation.hiddenAt}>{displayDate(comment.moderation.hiddenAt)}</time></span></> : null}</div> : <p className="dao-comment-body">{comment.body}</p>}
    {!comment.hidden && (canReply || canModerate || canReact || comment.reaction) ? <div className="dao-comment-actions">
      {canReact || comment.reaction ? <button className="dao-like-button" type="button" aria-label={reactionLabel} aria-pressed={liked} aria-busy={reactionPending} style={reactionPending ? { opacity: 1, cursor: "progress" } : undefined} title={cost > 0 ? `Like · ${creditLabel(cost)}` : liked ? "Remove like" : "Like"} disabled={!canReact || reactionDisabled || saving} onClick={() => onReact(comment)}>
        <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v10H3V10h4Zm0 0 5-7c2 0 2.5 1.5 2 3l-1 4h5.8a2 2 0 0 1 2 2.4l-1.3 6A2 2 0 0 1 17.6 20H7" /></svg>
        <span className="dao-like-count" aria-hidden="true">{likeCount.toLocaleString("en-US")}</span>
        {cost > 0 ? <span className="dao-like-cost" aria-hidden="true">{creditLabel(cost)}</span> : null}
      </button> : null}
      {canReply ? <button className="dao-text-button" type="button" aria-label={`Reply to ${comment.authorLabel}`} disabled={replyDisabled} onClick={() => onReply(comment)}>Reply <span aria-hidden="true">↗</span></button> : null}
      {canModerate ? <button className="dao-text-button dao-text-button--muted" type="button" aria-label={`Moderate comment by ${comment.authorLabel}`} aria-expanded={moderating} aria-controls={moderating ? `${fieldId}-moderation` : undefined} disabled={saving || reactionPending} onClick={() => { setModerating(!moderating); setError(null); }}>Moderate</button> : null}
    </div> : null}
    {reactionError && !comment.hidden ? <div className="dao-error dao-participation-error dao-reaction-error" role="alert"><span>{reactionError.message}</span>{reactionError.needsCredits ? <button type="button" className="dao-credit-link" onClick={onOpenCredits}>Get Zcred</button> : null}</div> : null}
    {moderating && canModerate && !comment.hidden ? <form id={`${fieldId}-moderation`} aria-label={`Moderate comment by ${comment.authorLabel}`} className="dao-moderation-form dao-form" onSubmit={hide}><div className="dao-field"><label htmlFor={`${fieldId}-reason`}>Reason for hiding this comment</label><textarea id={`${fieldId}-reason`} name="reason" required maxLength={500} rows={2} disabled={saving} /><p className="dao-field-hint">The reason, your name, and the date remain visible in the discussion.</p></div><div className="dao-form-actions"><button type="submit" className="dao-button dao-button--danger" disabled={saving}>{saving ? "Recording…" : "Hide comment"}</button><button className="dao-button" type="button" disabled={saving} onClick={() => setModerating(false)}>Cancel</button></div></form> : null}
    {error ? <p className="dao-error" role="alert">{error}</p> : null}
  </article>;
}
