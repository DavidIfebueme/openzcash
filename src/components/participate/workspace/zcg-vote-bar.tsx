"use client";

import Image from "next/image";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ZCG_EXAMPLE_MEMBERS, summarizeZcgVotes, type ZcgMemberId, type ZcgProposalExample } from "@/lib/participate/workspace/data/zcg-proposal-examples";

const voteLabels = { approve: "Approve", reject: "Reject", abstain: "Abstain" };

export type FeedbackSelection = { memberId: ZcgMemberId; pinned: boolean };

export function ZcgVoteBar({ proposal, selection: controlledSelection, onSelectionChange, showSummary = true }: { proposal: ZcgProposalExample; selection?: FeedbackSelection | null; onSelectionChange?: (selection: FeedbackSelection | null) => void; showSummary?: boolean }) {
  const [localSelection, setLocalSelection] = useState<FeedbackSelection | null>(null);
  const selection = controlledSelection === undefined ? localSelection : controlledSelection;
  const setSelection = onSelectionChange ?? setLocalSelection;
  const active = selection?.memberId;
  const pinned = selection?.pinned;
  const root = useRef<HTMLDivElement>(null);
  const feedbackPanel = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState({ side: "below", maxHeight: 400 });
  const popoverId = useId();
  const counts = summarizeZcgVotes(proposal.votes);
  const selected = proposal.votes.find(vote => vote.memberId === active);
  const selectedMember = selected ? ZCG_EXAMPLE_MEMBERS[selected.memberId] : null;

  useLayoutEffect(() => {
    if (!active) return;
    function position() {
      if (!root.current || !feedbackPanel.current) return;
      const bounds = root.current.getBoundingClientRect();
      const above = bounds.top - 12;
      const below = window.innerHeight - bounds.bottom - 12;
      const side = below < feedbackPanel.current.scrollHeight + 2 && above > below ? "above" : "below";
      const maxHeight = Math.max(1, side === "above" ? above : below);
      setPlacement(previous => previous.side === side && previous.maxHeight === maxHeight ? previous : { side, maxHeight });
    }
    position();
    window.addEventListener("resize", position);
    document.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      document.removeEventListener("scroll", position, true);
    };
  }, [active, selected?.summary]);

  useEffect(() => {
    if (!active) return;
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) { setSelection(null); }
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [active, setSelection]);

  function close(restoreFocus = false) {
    if (restoreFocus && active) root.current?.querySelector<HTMLButtonElement>(`[data-member="${active}"]`)?.focus();
    setSelection(null);
  }

  return <div ref={root} className="dao-zcg-votes" onMouseLeave={() => { if (!pinned) setSelection(null); }} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) close();
  }} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); close(true); } }}>
    <div className={showSummary ? "dao-zcg-vote-summary" : "dao-sr-only"}>
      {showSummary ? <div className="dao-zcg-support"><strong>{counts.supportPercent === null ? "—" : `${counts.supportPercent}%`}</strong><span>support <span className="dao-zcg-denominator">· {counts.approve} of {counts.total}</span></span></div> : null}
      <div className="dao-zcg-legend" aria-label={`${counts.approve} approve, ${counts.reject} reject, ${counts.abstain} abstain`}>
        <span data-vote="approve">{counts.approve} approve</span><span data-vote="reject">{counts.reject} reject</span>{counts.abstain > 0 ? <span data-vote="abstain">{counts.abstain} abstain</span> : null}
      </div>
    </div>
    <div className="dao-zcg-vote-rail" role="group" aria-label="Committee votes and feedback">
      {proposal.votes.map(vote => {
        const member = ZCG_EXAMPLE_MEMBERS[vote.memberId];
        return <button key={vote.memberId} type="button" className="dao-zcg-voter" data-member={vote.memberId} data-vote={vote.vote} aria-label={`${member.name}: ${voteLabels[vote.vote]}${vote.basis === "unanimous" ? " via unanimous record" : ""}. Read feedback`} aria-expanded={active === vote.memberId} aria-controls={active === vote.memberId ? popoverId : undefined} onMouseEnter={() => { if (!pinned) setSelection({ memberId: vote.memberId, pinned: false }); }} onFocus={() => setSelection({ memberId: vote.memberId, pinned: false })} onClick={() => active === vote.memberId && pinned ? close() : setSelection({ memberId: vote.memberId, pinned: true })}>
          <span className="dao-zcg-vote-segment" aria-hidden="true" />
          <span className="dao-zcg-voter-identity"><span className="dao-zcg-portrait"><Image src={member.avatar} alt="" width={40} height={40} /><span className="dao-zcg-vote-symbol" aria-hidden="true">{vote.vote === "approve" ? "✓" : vote.vote === "reject" ? "×" : "−"}</span></span><span>{member.shortName}{vote.basis === "unanimous" ? <small className="dao-zcg-vote-basis">Collective vote</small> : null}</span></span>
        </button>;
      })}
    </div>
    {selected && selectedMember ? <div ref={feedbackPanel} id={popoverId} className="dao-zcg-feedback" data-placement={placement.side} style={{ "--zcg-anchor": `${(proposal.votes.indexOf(selected) + 0.5) / proposal.votes.length * 100}%`, maxHeight: placement.maxHeight } as CSSProperties} role="dialog" aria-label={`${selectedMember.name}'s feedback`}>
      <div className="dao-zcg-feedback-heading"><strong>{selectedMember.name}</strong><span data-vote={selected.vote}>{voteLabels[selected.vote]}</span><button type="button" aria-label="Close feedback" onClick={() => close(true)}>×</button></div>
      <p>{selected.summary}</p>
      <div className="dao-zcg-feedback-source"><span>{selected.basis === "unanimous" ? "Unanimous vote record" : "From the minutes · Summary"}</span><a href={selected.basis === "unanimous" ? proposal.voteEvidenceUrl ?? proposal.minutesUrl : proposal.minutesUrl} target="_blank" rel="noopener noreferrer">Read source ↗</a></div>
    </div> : null}
  </div>;
}
