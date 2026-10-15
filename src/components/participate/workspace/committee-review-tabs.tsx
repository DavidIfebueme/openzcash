"use client";

import { useRef, type KeyboardEvent } from "react";

export type CommitteeReviewPanel = "Proposal" | "Discussion" | "Vote" | "Finish";
const reviewTabs: { value: CommitteeReviewPanel; detail: string }[] = [
  { value: "Proposal", detail: "Application & tags" },
  { value: "Discussion", detail: "Comments & context" },
  { value: "Vote", detail: "Choice & reason" },
  { value: "Finish", detail: "Decision, proof & Sheets" },
];

export const reviewTabId = (recordId: string, value: CommitteeReviewPanel) => `committee-tab-${encodeURIComponent(recordId)}-${value.toLowerCase()}`;

export function CommitteeReviewTabs({ recordId, panelId, selected, historical, onChange }: {
  recordId: string; panelId: string; selected: CommitteeReviewPanel; historical: boolean;
  onChange: (value: CommitteeReviewPanel) => void;
}) {
  const buttons = useRef<Partial<Record<CommitteeReviewPanel, HTMLButtonElement | null>>>({});
  const items = historical ? reviewTabs.filter(item => item.value !== "Finish") : reviewTabs;
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft") next = (index + items.length - 1) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    onChange(items[next].value);
    buttons.current[items[next].value]?.focus();
  }
  return <div className="committee-review-tabs" role="tablist" aria-label="Review sections" data-historical={historical}>
    {items.map((item, index) => {
      const id = reviewTabId(recordId, item.value);
      const label = historical && item.value === "Vote" ? "Published decision" : item.value;
      const detail = historical && item.value === "Vote" ? "Votes & meeting minutes" : item.detail;
      return <button key={item.value} ref={element => { buttons.current[item.value] = element; }}
        type="button" role="tab" id={id} aria-label={label} aria-describedby={`${id}-detail`}
        aria-selected={selected === item.value} aria-controls={panelId} tabIndex={selected === item.value ? 0 : -1}
        onClick={() => onChange(item.value)} onKeyDown={event => navigate(event, index)}>
        <span className="committee-review-tab-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <span className="committee-review-tab-copy"><strong>{label}</strong><small id={`${id}-detail`}>{detail}</small></span>
      </button>;
    })}
  </div>;
}
