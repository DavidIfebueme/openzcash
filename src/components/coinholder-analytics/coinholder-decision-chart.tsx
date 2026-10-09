"use client";

import { CoinholderChartHelp } from "@/components/coinholder-analytics/coinholder-chart-help";

import { useId, useRef, type KeyboardEvent } from "react";
import type { CoinholderProposal } from "@/lib/coinholder/analytics/model";
import { formatInsightZec, insightMargin, insightPercent } from "@/lib/coinholder/analytics/insights";

const QUORUM_UNITS = 420_000n * 8n;
const amount = (units: bigint) => formatInsightZec(`${units / 8n}.${((units % 8n) * 125n).toString().padStart(3, "0")}`);
const percent = (value: number | null) => value === null ? "N/A" : `${value.toFixed(2)}%`;
const marginLabel = (value: number | null) => value === null ? "N/A" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(2)} pp`;

function decision(proposal: CoinholderProposal) {
  const weight = (id: "accept" | "reject" | "lower" | "abstain") => BigInt(proposal.options.find(option => option.id === id)!.weightUnits);
  const accept = weight("accept"), reject = weight("reject"), lower = weight("lower"), abstain = weight("abstain");
  const eligible = accept + reject + lower;
  const total = eligible + abstain;
  const quorumMet = total >= QUORUM_UNITS;
  const approved = quorumMet && accept > reject + lower;
  return { proposal, accept, reject, lower, abstain, eligible, total, quorumMet, approved,
    approval: insightPercent(accept, eligible), margin: insightMargin(accept, eligible) };
}
type Decision = ReturnType<typeof decision>;

function rank(left: Decision, right: Decision) {
  if (left.eligible === 0n || right.eligible === 0n) return left.eligible === right.eligible ? left.proposal.ballot - right.proposal.ballot : left.eligible === 0n ? 1 : -1;
  // Rank the exact ratios; rounded percentages cannot determine ties or outcomes.
  const difference = left.accept * right.eligible - right.accept * left.eligible;
  return difference === 0n ? left.proposal.ballot - right.proposal.ballot : difference > 0n ? -1 : 1;
}

function detailText(row: Decision) {
  return `Accept ${percent(row.approval)}; margin ${marginLabel(row.margin)}; ${row.approved ? "Approved" : "Rejected"}. `
    + `Quorum ${row.quorumMet ? "met" : "not met"}: ${amount(row.total)} ZEC of 420,000 ZEC required, including abstentions. `
    + `Accept ${amount(row.accept)} ZEC; reject ${amount(row.reject)} ZEC; lower amount ${amount(row.lower)} ZEC; abstain ${amount(row.abstain)} ZEC. `
    + `Majority weight ${amount(row.eligible)} ZEC, excluding abstentions. Strictly more than 50% accept is required.`;
}

export function CoinholderDecisionChart({ proposals, selectedBallot, onSelectBallot }: {
  proposals: CoinholderProposal[]; selectedBallot: number | null; onSelectBallot: (ballot: number | null) => void;
}) {
  const id = useId();
  const list = useRef<HTMLOListElement>(null);
  const ranked = proposals.map(decision).sort(rank);
  const selected = selectedBallot === null ? null : ranked.find(row => row.proposal.ballot === selectedBallot);
  const rows = selectedBallot === null ? ranked : selected ? [selected] : [];
  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "Escape" && selectedBallot !== null) { event.preventDefault(); onSelectBallot(null); return; }
    const next = event.key === "ArrowDown" ? index + 1 : event.key === "ArrowUp" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    list.current?.querySelectorAll<HTMLButtonElement>("button[data-margin-ballot]")[Math.max(0, Math.min(rows.length - 1, next))]?.focus();
  };

  return <section className="coin-panel coin-margin-panel" aria-label="Decision margin">
    <header className="coin-series-heading"><div><span className="coin-chart-index">04</span><h2>Decision margin</h2><p>Final ZEC · margin from 50%</p></div>
      <div className="coin-margin-sort">{selectedBallot === null ? "Highest margin first" : <button type="button" onClick={() => onSelectBallot(null)}>All proposals</button>}</div>
    </header>
    <CoinholderChartHelp chart="margin" />
    <p className="coin-sr-only" id={`${id}-help`}>Margins use ZEC weight excluding abstentions. A proposal needs strictly more than 50% accept and at least 420,000 ZEC including abstentions. Percentages display two decimals; outcomes use exact weights. Use arrow keys to move between proposals, Enter to select, or Escape to clear a selection.</p>
    {rows.length ? <div className="coin-margin-scroll" role="region" aria-label="Decision margin ranking" tabIndex={0} aria-describedby={`${id}-help`}>
      <div className="coin-margin-grid coin-margin-columns" aria-hidden="true"><span>Proposal</span><span className="coin-margin-axis"><span>−50</span><span>0 pp</span><span>+50</span></span><span>Accept</span><span>Margin</span><span>Outcome</span></div>
      <ol ref={list} className="coin-margin-list" aria-label="Proposals ranked by decision margin">
        {rows.map((row, index) => <li key={row.proposal.ballot}>
          <button type="button" className="coin-margin-grid coin-margin-row" data-margin-ballot={row.proposal.ballot}
            aria-label={`Select #${row.proposal.ballot} ${row.proposal.title}`} aria-pressed={selectedBallot === row.proposal.ballot}
            aria-describedby={`${id}-${row.proposal.ballot}-detail`} title={`#${row.proposal.ballot} ${row.proposal.title}\n${detailText(row)}`}
            onClick={() => onSelectBallot(row.proposal.ballot)} onKeyDown={event => moveFocus(event, index)}>
            <span className="coin-margin-proposal"><span>#{row.proposal.ballot}</span><strong>{row.proposal.title}</strong></span>
            <span className="coin-margin-track" aria-hidden="true"><span className="coin-margin-mobile-axis"><span>−50</span><span>0 pp</span><span>+50</span></span><i className="coin-margin-zero" />{row.margin !== null ? <i className={`coin-margin-bar coin-margin-bar--${row.margin > 0 ? "positive" : "negative"}`} style={{ left: `${row.margin < 0 ? 50 + row.margin : 50}%`, width: `${Math.abs(row.margin)}%` }} /> : null}</span>
            <span className="coin-margin-number"><small className="coin-margin-mobile-label" aria-hidden="true">Accept</small>{percent(row.approval)}</span><span className="coin-margin-number coin-margin-distance"><small className="coin-margin-mobile-label" aria-hidden="true">Margin</small>{marginLabel(row.margin)}</span>
            <span className={`coin-margin-outcome coin-margin-outcome--${row.approved ? "approved" : "rejected"}`}><small className="coin-margin-mobile-label" aria-hidden="true">Outcome</small>{row.approved ? "Approved" : "Rejected"}</span>
            <span className="coin-sr-only" id={`${id}-${row.proposal.ballot}-detail`}>{detailText(row)}</span>
          </button>
        </li>)}
      </ol>
    </div> : <p className="coin-margin-empty">Decision data unavailable for this selection.</p>}
    {selected ? <div className="coin-margin-selected" role="group" aria-label="Selected proposal quorum">
      <strong className={selected.quorumMet ? "coin-margin-quorum-met" : "coin-margin-quorum-unmet"}>{selected.quorumMet ? "Quorum met" : "Quorum not met"}</strong>
      <span>{amount(selected.total)} ZEC <small>/ 420,000 ZEC minimum</small></span>
      <details className="coin-margin-details"><summary>Exact weights</summary><dl>
        <div><dt>Accept</dt><dd>{amount(selected.accept)} ZEC</dd></div><div><dt>Reject</dt><dd>{amount(selected.reject)} ZEC</dd></div>
        <div><dt>Lower amount</dt><dd>{amount(selected.lower)} ZEC</dd></div><div><dt>Abstain</dt><dd>{amount(selected.abstain)} ZEC</dd></div>
        <div><dt>Majority weight</dt><dd>{amount(selected.eligible)} ZEC</dd></div>
      </dl></details>
    </div> : null}
    <p className="coin-margin-note">Percentage points · Majority excludes abstentions.</p>
  </section>;
}
