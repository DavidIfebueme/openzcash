"use client";

import { useId, useRef, useState } from "react";

type Chart = "casts" | "reveals" | "comparison" | "margin" | "heatmap" | "matching" | "recurring";
const guides: Record<Chart, { title: string; paragraphs: [string, string] }> = {
  casts: {
    title: "Cast volume",
    paragraphs: [
      "Bars count encrypted cast messages by UTC day, hour or minute: time runs left to right and cast counts rise upward. Casts are not wallets or ZEC weight over time.",
      "Choose an interval and, for minute detail, an hour; hover or tap to inspect, or focus the chart and use Left/Right arrows, Home/End and Escape."
    ]
  },
  reveals: {
    title: "Revealed shares",
    paragraphs: [
      "Days run left to right and share counts rise vertically: Daily bars show new shares by option, while Cumulative lines step up at each UTC day’s end. Shares are protocol portions with variable ZEC weights, so their count does not represent people or ZEC.",
      "Switch views, then hover, tap, or focus the chart and use Left/Right arrows, Home/End and Escape for exact counts."
    ]
  },
  comparison: {
    title: "Shares vs ZEC",
    paragraphs: [
      "Circles show share percentages and diamonds show final ZEC percentages on a 0–100% scale, each divided by its own total across all four options. Gap is ZEC % minus share % in percentage points; share counts do not identify holders.",
      "Choose an option, or select a proposal for all four options using a click, tap, or Tab then Enter or Space."
    ]
  },
  margin: {
    title: "Decision margin",
    paragraphs: [
      "Rows rank proposals by final Accept ZEC percentage minus 50, excluding Abstain; bars extend left or right in percentage points. Approval requires strictly more than 50% and a separate quorum of at least 420,000 ZEC that includes Abstain.",
      "Click or tap a proposal for exact weights, or focus a row and use Up/Down, Home/End, Enter to select and Escape to clear."
    ]
  },
  heatmap: {
    title: "Reveal heatmap",
    paragraphs: [
      "Rows are proposals and columns are UTC days; darkness shows the selected option’s percentage of that proposal’s daily shares across all four options, not the number of shares. A 0% cell has shares in other options, “No shares” means no reveals that day, and Sep 17 begins at round creation.",
      "Hover, tap or focus a cell for counts, use arrow keys or Home/End to explore, and select a proposal name to filter."
    ]
  },
  matching: {
    title: "Matching tallies",
    paragraphs: [
      "Each cell compares the final tallies of two proposals, in the same group order on both axes. A pair’s distance is half the sum of its four option differences, shown as a share of the smaller vote; darker cells are closer. Because about the same ZEC voted on every proposal, a small distance means most of that ZEC chose the same option on both. Groups chain proposals within 2% of the vote; this describes public totals and does not identify holders.",
      "Hover, tap or focus the matrix and use the arrow keys to compare pairs, Enter to select or clear the row’s proposal and Escape to clear. Select a ballot number to filter every chart."
    ]
  },
  recurring: {
    title: "Recurring amounts",
    paragraphs: [
      "Each tick is one proposal’s final Abstain or lower-amount ZEC on a shared scale; ticks that pile up mark amounts that recur across proposals, and ×N counts them. Totals less than 25,000 ZEC apart count as one amount, and near-zero totals are left out. Recurring amounts are consistent with the same blocks of ZEC making the same choice, but they do not identify holders and can also come from many holders deciding alike.",
      "Select a recurring amount to list its proposals, or select a proposal to mark its amounts on both scales."
    ]
  }
};

export function CoinholderChartHelp({ chart }: { chart: Chart }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const guide = guides[chart];
  return <div className="coin-chart-help" onKeyDown={event => {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    button.current?.focus();
  }}>
    <button ref={button} type="button" className="coin-chart-help-toggle" aria-label={`How to read ${guide.title}`}
      aria-expanded={open} aria-controls={id} onClick={() => setOpen(previous => !previous)}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" /><path d="M8 7v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><circle cx="8" cy="4.5" r=".7" fill="currentColor" /></svg>
      <span>How to read</span>
      <svg className="coin-chart-help-chevron" width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    <div id={id} className="coin-chart-help-copy" role="region" aria-label={`${guide.title} guide`} hidden={!open}>
      {guide.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
    </div>
  </div>;
}
