"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { WorkspaceSignInButton } from "@/components/participate/workspace/workspace-auth";
import type { ProposalParticipationBoard } from "@/lib/participate/workspace/domain/proposal-participation";

const LikeIcon = ({ filled = false }: { filled?: boolean }) => <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z" /></svg>;
const credits = (amount: number) => `${amount.toLocaleString("en-US")} Zcred`;
const errors: Record<string, string> = {
  INSUFFICIENT_PARTICIPATION_CREDITS: "You need more Zcred to like this proposal.",
  PARTICIPATION_POLICY_CHANGED: "The price changed. Review the updated cost and try again.",
  CREDIT_PAYMENT_REVIEW: "A payment needs review. Spending is paused.",
  PARTICIPATION_CREDITS_UNAVAILABLE: "Zcred spending is unavailable in this environment.",
  REACTION_RATE_LIMIT: "Please wait a minute before updating more likes.",
  forbidden: "Sign in with an active account to participate.",
  unauthorized: "Sign in again to participate."
};
type EconomyContext = {
  board: ProposalParticipationBoard;
  busy: boolean;
  pendingRecordId: string | null;
  refreshing: boolean;
  refreshFailed: boolean;
  errors: Record<string, string>;
  like: (recordId: string) => void;
  openCredits: () => void;
  reload: () => void;
  communityId: string;
};
const Context = createContext<EconomyContext | null>(null);
function useEconomy() { const value = useContext(Context); if (!value) throw new Error("Proposal economy provider missing"); return value; }

export function ProposalEconomyProvider({ communityId, initial, children }: { communityId: string; initial: ProposalParticipationBoard; children: ReactNode }) {
  const [update, setUpdate] = useState<{ source: ProposalParticipationBoard; value: ProposalParticipationBoard } | null>(null);
  const board = update?.source === initial ? update.value : initial;
  const [pendingRecordId, setPendingRecordId] = useState<string | null>(null);
  const busy = pendingRecordId !== null;
  const [refresh, setRefresh] = useState<{ source: ProposalParticipationBoard; state: "loading" | "ready" | "failed" } | null>(null);
  const refreshing = refresh?.source === initial && refresh.state === "loading";
  const refreshFailed = refresh?.source === initial && refresh.state === "failed";
  const [messages, setMessages] = useState<Record<string, string>>({});
  const lock = useRef(false);
  const generation = useRef({ value: 0 });
  const request = useRef<{ recordId: string; liked: boolean; requestKey: string; policyVersion?: number } | null>(null);
  const endpoint = `/api/communities/${encodeURIComponent(communityId)}/archives`;
  const reload = useCallback(async () => {
    const current = ++generation.current.value;
    setRefresh({ source: initial, state: "loading" });
    try {
      const response = await fetch(`${endpoint}/participation`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.board) throw new Error("Unavailable");
      if (current === generation.current.value) { setUpdate({ source: initial, value: result.board }); setRefresh({ source: initial, state: "ready" }); }
    } catch { if (current === generation.current.value) setRefresh({ source: initial, state: "failed" }); }
  }, [endpoint, initial]);
  useEffect(() => {
    const requests = generation.current;
    const changed = (event: Event) => {
      const detail = (event as CustomEvent<{ communityId?: string; skipBoardRefresh?: boolean }>).detail;
      if (detail?.skipBoardRefresh) return;
      const changedId = detail?.communityId;
      if (!changedId || changedId === communityId || changedId === initial.participation?.communityId) void reload();
    };
    window.addEventListener("dao:credits-updated", changed);
    window.addEventListener("dao:participation-updated", changed);
    return () => { requests.value++; window.removeEventListener("dao:credits-updated", changed); window.removeEventListener("dao:participation-updated", changed); };
  }, [communityId, initial.participation?.communityId, reload]);
  function openCredits() { window.dispatchEvent(new CustomEvent("dao:open-credits", { detail: { communityId: board.participation?.communityId ?? communityId, creditScope: board.participation?.creditScope } })); }
  async function like(recordId: string) {
    const proposal = board.proposals.find(item => item.recordId === recordId);
    if (lock.current || refreshing || refreshFailed || !proposal || !board.canParticipate || !board.participation) return;
    lock.current = true; setPendingRecordId(recordId); setMessages(previous => ({ ...previous, [recordId]: "" }));
    const liked = !proposal.likedByMe;
    setUpdate({ source: initial, value: { ...board, proposals: board.proposals.map(item => item.recordId === recordId
      ? { ...item, likedByMe: liked, likes: Math.max(0, item.likes + (liked ? 1 : -1)) } : item) } });
    // Preserve this intent across an uncertain response; a retry cannot charge twice.
    if (!request.current || request.current.recordId !== recordId || request.current.liked !== liked) request.current = {
      recordId, liked, requestKey: crypto.randomUUID(), ...(board.participation.mode === "CREDITS" ? { policyVersion: board.participation.version } : {})
    };
    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(recordId)}/like`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ liked, requestKey: request.current.requestKey, policyVersion: request.current.policyVersion }) });
      const result = await response.json();
      if (!response.ok || !result.proposal || !result.participation) {
        setUpdate({ source: initial, value: board });
        setMessages(previous => ({ ...previous, [recordId]: errors[result.error] ?? "Your like could not be saved. Try again." }));
        if (result.error === "PARTICIPATION_POLICY_CHANGED") { request.current = null; await reload(); }
        if (result.error === "CREDIT_PAYMENT_REVIEW") await reload();
        return;
      }
      setUpdate({ source: initial, value: { ...board, participation: result.participation, proposals: board.proposals.map(item => item.recordId === recordId ? result.proposal : item) } });
      request.current = null;
      window.dispatchEvent(new CustomEvent("dao:participation-updated", { detail: { communityId: board.participation?.communityId ?? communityId, creditScope: board.participation?.creditScope, skipBoardRefresh: true } }));
    } catch { setUpdate({ source: initial, value: board }); setMessages(previous => ({ ...previous, [recordId]: "Connection interrupted. Retry safely to check this like." })); }
    finally { lock.current = false; setPendingRecordId(null); }
  }
  return <Context.Provider value={{ board, busy, pendingRecordId, refreshing, refreshFailed, errors: messages, like, openCredits, reload, communityId }}>{children}</Context.Provider>;
}

export function ProposalEconomyNotice() {
  const { board, refreshing, refreshFailed, reload } = useEconomy();
  return <>
    {refreshFailed ? <p className="proposal-economy-warning" role="alert">Could not refresh participation. <button type="button" className="dao-text-button" disabled={refreshing} onClick={reload}>Try again</button></p> : null}
    {board.participation?.paymentReview ? <p className="proposal-economy-warning" role="alert">A payment needs review. Credit spending is paused.</p> : null}
  </>;
}

export function ProposalEngagement({ recordId, onToggleComments, commentsOpen = false }: { recordId: string; onToggleComments?: () => void; commentsOpen?: boolean }) {
  const { board, busy, pendingRecordId, refreshing, refreshFailed, errors: messages, like, openCredits, communityId } = useEconomy();
  const proposal = board.proposals.find(item => item.recordId === recordId);
  if (!proposal) return null;
  const p = board.participation;
  const pending = pendingRecordId === recordId;
  const price = p?.mode === "CREDITS" && !proposal.chargedBefore && !proposal.likedByMe ? p.reactionCost : 0;
  const label = `${proposal.likedByMe ? "Unlike" : "Like"} · ${proposal.likes.toLocaleString("en-US")}${price ? ` · ${credits(price)}` : ""}`;
  const path = `/communities/${encodeURIComponent(communityId)}/archives/${encodeURIComponent(recordId)}`;
  const commentLabel = <><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.4A8.5 8.5 0 1 1 21 11.5Z" /></svg><span>{`${proposal.commentCount.toLocaleString("en-US")} ${proposal.commentCount === 1 ? "comment" : "comments"}`}</span></>;
  return <div className="proposal-engagement">
    <div className="proposal-engagement-actions">
      {board.canParticipate ? <button type="button" className="proposal-like" aria-pressed={proposal.likedByMe} aria-busy={pending} aria-label={label} style={pending ? { opacity: 1, cursor: "progress" } : undefined} disabled={busy || refreshing || refreshFailed || (Boolean(p?.paymentReview) && price > 0)} onClick={() => like(recordId)}><LikeIcon filled={proposal.likedByMe} /><span>{proposal.likes.toLocaleString("en-US")}</span><span>{proposal.likedByMe ? "Liked" : "Like"}</span>{price ? <small>{credits(price)}</small> : null}</button> : <WorkspaceSignInButton className="proposal-like" label={`♡ ${label}`} />}
      {onToggleComments ? <button id={`proposal-comments-${recordId}`} type="button" className="proposal-comment-link" aria-expanded={commentsOpen} aria-controls={`proposal-panel-${recordId}`} onClick={onToggleComments}>{commentLabel}<span className="proposal-disclosure-arrow" aria-hidden="true">⌄</span></button> : <Link href={`${path}#discussion`} className="proposal-comment-link">{commentLabel}</Link>}
    </div>
    {messages[recordId] ? <p className="proposal-engagement-error" role="alert">{messages[recordId]} <button type="button" className="dao-text-button" onClick={openCredits}>Credits</button></p> : null}
  </div>;
}
