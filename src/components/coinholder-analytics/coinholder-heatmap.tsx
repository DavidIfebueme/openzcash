"use client";

import { CoinholderChartHelp } from "@/components/coinholder-analytics/coinholder-chart-help";

import { useId, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import type { CoinholderOptionId, CoinholderProposal } from "@/lib/coinholder/analytics/model";
import type { CoinholderRevealBucket, CoinholderRevealHistory } from "@/lib/coinholder/analytics/reveals";
import { INSIGHT_OPTIONS, insightPercent } from "@/lib/coinholder/analytics/insights";

type Props = {
  proposals: CoinholderProposal[];
  history: CoinholderRevealHistory | null;
  selectedBallot: number | null;
  onSelectBallot: (ballot: number | null) => void;
};
type Cell = { ballot: number; at: string };
type Inspection = Cell & { scope: string };
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const numbers = new Intl.NumberFormat("en-US");
const cellKey = (cell: Cell) => `${cell.ballot}:${cell.at}`;
const cellPercent = (value: number) => `${Math.round(value * 10) / 10}%`;

function values(day: CoinholderRevealBucket | undefined, option: CoinholderOptionId) {
  if (!day) return null;
  const total = INSIGHT_OPTIONS.reduce((sum, candidate) => sum + day.counts[candidate.id], 0);
  return { count: day.counts[option], total, percent: insightPercent(BigInt(day.counts[option]), BigInt(total)) };
}

export function CoinholderHeatmap({ proposals, history, selectedBallot, onSelectBallot }: Props) {
  const [optionId, setOptionId] = useState<CoinholderOptionId>("accept");
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const cells = useRef(new Map<string, HTMLButtonElement>());
  const hintId = useId();
  const optionLabel = INSIGHT_OPTIONS.find(option => option.id === optionId)!.label;
  const rows = proposals.filter(proposal => selectedBallot === null || proposal.ballot === selectedBallot).sort((a, b) => a.ballot - b.ballot);
  const days = history?.days ?? [];
  const sourceRows = new Map(history?.proposals.map(proposal => [proposal.id, new Map(proposal.days.map(day => [day.at, day]))]));
  const scope = `${history?.sha256 ?? "unavailable"}:${selectedBallot ?? "all"}`;
  const firstCell = rows[0] && days[0] ? { ballot: rows[0].ballot, at: days[0].at } : null;
  const focusedCellExists = rows.some(row => days.some(day => cellKey({ ballot: row.ballot, at: day.at }) === focusKey));
  const tabStop = focusedCellExists ? focusKey : firstCell ? cellKey(firstCell) : null;
  const inspectedProposal = inspection?.scope === scope ? rows.find(row => row.ballot === inspection.ballot) : undefined;
  const inspectedDay = inspectedProposal && inspection ? sourceRows.get(inspectedProposal.ballot)?.get(inspection.at) : undefined;
  const inspectedValues = values(inspectedDay, optionId);
  const hasHistory = Boolean(history?.complete && days.length);

  function inspect(cell: Cell) { setInspection({ ...cell, scope }); }
  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, rowIndex: number, dayIndex: number) {
    let nextRow = rowIndex;
    let nextDay = dayIndex;
    switch (event.key) {
      case "ArrowRight": nextDay = Math.min(days.length - 1, dayIndex + 1); break;
      case "ArrowLeft": nextDay = Math.max(0, dayIndex - 1); break;
      case "ArrowDown": nextRow = Math.min(rows.length - 1, rowIndex + 1); break;
      case "ArrowUp": nextRow = Math.max(0, rowIndex - 1); break;
      case "Home": nextDay = 0; if (event.ctrlKey || event.metaKey) nextRow = 0; break;
      case "End": nextDay = days.length - 1; if (event.ctrlKey || event.metaKey) nextRow = rows.length - 1; break;
      default: return;
    }
    event.preventDefault();
    cells.current.get(cellKey({ ballot: rows[nextRow].ballot, at: days[nextDay].at }))?.focus();
  }

  return <section className="coin-panel coin-heatmap-panel" aria-label="Reveal heatmap" style={{ "--coin-heat-color": `var(--coin-${optionId})` } as CSSProperties}>
    <header className="coin-series-heading"><div><span className="coin-chart-index">05</span><h2>Reveal heatmap</h2><p>Daily share composition · UTC</p></div></header>
    <CoinholderChartHelp chart="heatmap" />
    {!hasHistory ? <div className="coin-heatmap-unavailable"><strong>Reveal history unavailable</strong><p>Daily option counts are needed to show this heatmap.</p></div>
      : !rows.length ? <p className="coin-heatmap-unavailable">Proposal unavailable</p> : <>
        <div className="coin-heatmap-toolbar">
          <div className="coin-segmented" role="group" aria-label="Heatmap option">{INSIGHT_OPTIONS.map(option => <button type="button" key={option.id} aria-pressed={option.id === optionId} onClick={() => setOptionId(option.id)}>{option.label}</button>)}</div>
          <div className="coin-heatmap-legend" aria-label="Heatmap scale"><span>0%</span><i aria-hidden="true" /><span>100%</span><span className="coin-heatmap-no-shares-key"><b aria-hidden="true">—</b> No shares</span></div>
        </div>
        {selectedBallot !== null ? <div className="coin-heatmap-selection"><strong>#{rows[0].ballot} {rows[0].title}</strong><button type="button" onClick={() => onSelectBallot(null)}>All proposals</button></div> : null}
        <p id={hintId} className="coin-sr-only">Use arrow keys to inspect adjacent days and proposals. Home and End move to the first and last day. Select a proposal name to filter all charts.</p>
        <div className="coin-heatmap-scroll" tabIndex={0} role="region" aria-label="Scrollable reveal heatmap" aria-describedby={hintId}>
          <table className="coin-heatmap-table" style={{ minWidth: `${220 + days.length * 52}px` }}>
            <caption className="coin-sr-only">{optionLabel} shares as a percentage of all four options revealed for the same proposal and UTC day. {rows.length} {rows.length === 1 ? "proposal" : "proposals"}, {days.length} {days.length === 1 ? "day" : "days"}. No shares means the daily total is zero; 0% means other options have shares.</caption>
            <thead><tr><th scope="col">Proposal</th>{days.map(day => <th key={day.at} scope="col"><time dateTime={day.at} title={`${longDate.format(new Date(day.at))} · UTC`}>{shortDate.format(new Date(day.at))}</time></th>)}</tr></thead>
            <tbody>{rows.map((proposal, rowIndex) => <tr key={proposal.ballot}>
              <th scope="row"><button type="button" className="coin-heatmap-proposal" title={`#${proposal.ballot} ${proposal.title}`} onClick={() => onSelectBallot(proposal.ballot)}><span>#{proposal.ballot}</span><span>{proposal.title}</span></button></th>
              {days.map((day, dayIndex) => {
                const cell = { ballot: proposal.ballot, at: day.at };
                const key = cellKey(cell);
                const data = values(sourceRows.get(proposal.ballot)?.get(day.at), optionId);
                const noShares = data?.total === 0;
                const result = !data ? "Unavailable" : noShares ? "No shares; daily total 0" : `${optionLabel}: ${numbers.format(data.count)} of ${numbers.format(data.total)} revealed shares, ${data.percent!.toFixed(2)}%`;
                const label = `#${proposal.ballot} ${proposal.title}, ${longDate.format(new Date(day.at))} UTC. ${result}`;
                const isInspected = inspectedProposal?.ballot === proposal.ballot && inspection?.at === day.at;
                return <td key={day.at}><button type="button" className={`coin-heatmap-cell${noShares ? " is-empty" : ""}${!data ? " is-unavailable" : ""}${isInspected ? " is-inspected" : ""}`} aria-label={label} title={label} tabIndex={key === tabStop ? 0 : -1}
                  style={data?.percent !== null && data?.percent !== undefined ? { "--coin-heat-strength": `${4 + data.percent * .24}%` } as CSSProperties : undefined}
                  ref={node => { if (node) cells.current.set(key, node); else cells.current.delete(key); }}
                  onMouseEnter={() => inspect(cell)} onFocus={() => { setFocusKey(key); inspect(cell); }} onClick={() => inspect(cell)} onKeyDown={event => moveFocus(event, rowIndex, dayIndex)}>
                  {!data ? "N/A" : noShares ? "—" : cellPercent(data.percent!)}
                </button></td>;
              })}
            </tr>)}</tbody>
          </table>
        </div>
        <div className="coin-heatmap-readout" role="status" aria-label="Reveal cell details" aria-live="off">
          {inspectedProposal && inspection ? <><div><strong>#{inspectedProposal.ballot} {inspectedProposal.title}</strong><span>{longDate.format(new Date(inspection.at))} · UTC</span></div><p>{!inspectedValues ? "Daily counts unavailable" : inspectedValues.total === 0 ? "No shares revealed on this day" : <><span className={`coin-key-${optionId}`}>{optionLabel}</span><strong>{numbers.format(inspectedValues.count)} / {numbers.format(inspectedValues.total)} shares</strong><span>{inspectedValues.percent!.toFixed(2)}%</span></>}</p></>
            : <p>Hover, focus or tap a cell for exact counts.</p>}
        </div>
        <p className="coin-heatmap-caption">Each cell compares one option with that proposal’s daily shares. Share counts, not ZEC weight. Sep 17 starts at round creation.</p>
      </>}
  </section>;
}
