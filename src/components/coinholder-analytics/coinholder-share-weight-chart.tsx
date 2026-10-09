"use client";

import Link from "next/link";
import { CoinholderChartHelp } from "@/components/coinholder-analytics/coinholder-chart-help";

import { useState } from "react";
import type { CoinholderOptionId, CoinholderProposal } from "@/lib/coinholder/analytics/model";
import type { CoinholderRevealHistory } from "@/lib/coinholder/analytics/reveals";
import { INSIGHT_OPTIONS, formatInsightZec, insightGap, insightPercent } from "@/lib/coinholder/analytics/insights";

type Props = {
  proposals: CoinholderProposal[];
  history: CoinholderRevealHistory | null;
  selectedBallot: number | null;
  onSelectBallot: (ballot: number | null) => void;
};
type Comparison = {
  count: number | null;
  sharePercent: number | null;
  zec: string | null;
  weightPercent: number | null;
  gap: number | null;
};
const numbers = new Intl.NumberFormat("en-US");
const percent = (value: number | null) => value === null ? "Unavailable" : `${value.toFixed(2)}%`;
function gapLabel(value: number | null) {
  if (value === null) return "Unavailable";
  const rounded = Number(value.toFixed(2));
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(2)} pp`;
}

function compare(proposal: CoinholderProposal, optionId: CoinholderOptionId, history: CoinholderRevealHistory | null): Comparison {
  const option = proposal.options.find(candidate => candidate.id === optionId);
  const weightTotal = proposal.options.reduce((total, candidate) => total + BigInt(candidate.weightUnits), 0n);
  const final = history?.complete ? history.proposals.find(candidate => candidate.id === proposal.ballot)?.days.at(-1) : undefined;
  const count = final?.cumulative[optionId] ?? null;
  const shareTotal = final ? INSIGHT_OPTIONS.reduce((total, candidate) => total + final.cumulative[candidate.id], 0) : null;
  return {
    count,
    sharePercent: count !== null && shareTotal !== null ? insightPercent(BigInt(count), BigInt(shareTotal)) : null,
    zec: option ? formatInsightZec(option.zec) : null,
    weightPercent: option ? insightPercent(BigInt(option.weightUnits), weightTotal) : null,
    gap: count !== null && shareTotal !== null && option ? insightGap(count, shareTotal, option.weightUnits, weightTotal.toString()) : null
  };
}

function ComparisonCells({ comparison }: { comparison: Comparison }) {
  const { count, sharePercent, zec, weightPercent, gap } = comparison;
  const comparable = sharePercent !== null && weightPercent !== null;
  return <>
    <td className="coin-share-weight-visual-cell"><div className="coin-share-weight-track" aria-hidden="true">
      {comparable ? <span className="coin-share-weight-connector" style={{ left: `${Math.min(sharePercent, weightPercent)}%`, width: `${Math.abs(weightPercent - sharePercent)}%` }} /> : null}
      {sharePercent !== null ? <i className="coin-share-weight-share" style={{ left: `${sharePercent}%` }} /> : null}
      {weightPercent !== null ? <i className="coin-share-weight-zec" style={{ left: `${weightPercent}%` }} /> : null}
    </div></td>
    <td className="coin-share-weight-shares" data-label="Shares"><strong>{count === null ? "Unavailable" : `${numbers.format(count)} ${count === 1 ? "share" : "shares"}`}</strong>{count !== null ? <small>{percent(sharePercent)}</small> : null}</td>
    <td className="coin-share-weight-amount" data-label="Final ZEC"><strong>{zec === null ? "Unavailable" : `${zec} ZEC`}</strong>{zec !== null ? <small>{percent(weightPercent)}</small> : null}</td>
    <td className="coin-share-weight-gap">{gapLabel(gap)}</td>
  </>;
}

export function CoinholderShareWeightChart({ proposals, history, selectedBallot, onSelectBallot }: Props) {
  const [optionId, setOptionId] = useState<CoinholderOptionId>("accept");
  const selected = selectedBallot === null ? null : proposals.find(proposal => proposal.ballot === selectedBallot);
  const optionLabel = INSIGHT_OPTIONS.find(option => option.id === optionId)!.label;
  const unavailableSelection = selectedBallot !== null && !selected;

  return <section className="coin-panel coin-share-weight-panel" aria-label="Shares vs ZEC">
    <header className="coin-series-heading"><div><span className="coin-chart-index">03</span><h2>Shares vs ZEC</h2><p>Final composition</p></div></header>
    <CoinholderChartHelp chart="comparison" />
    {unavailableSelection ? <p className="coin-share-weight-unavailable">Proposal unavailable</p> : <>
      <div className="coin-share-weight-toolbar">
        {selected ? <div className="coin-share-weight-selection"><strong>#{selected.ballot} {selected.title}</strong><button type="button" onClick={() => onSelectBallot(null)}>All proposals</button></div>
          : <div className="coin-segmented" role="group" aria-label="Comparison option">{INSIGHT_OPTIONS.map(option => <button key={option.id} type="button" aria-pressed={option.id === optionId} onClick={() => setOptionId(option.id)}>{option.label}</button>)}</div>}
        <ul className="coin-share-weight-legend" aria-label="Comparison markers"><li><i className="coin-share-weight-share" aria-hidden="true" />Shares</li><li><i className="coin-share-weight-zec" aria-hidden="true" />ZEC</li></ul>
      </div>
      <div className={`coin-share-weight-scroll${selected ? " coin-share-weight-scroll--selected" : ""}`} tabIndex={0} role="region" aria-label="Scrollable shares and ZEC comparison">
        <table className="coin-share-weight-table">
          <caption className="coin-sr-only">{selected ? `All options for proposal ${selected.ballot}: ${selected.title}` : `${optionLabel} across all ${proposals.length} proposals`}. Share percentages and ZEC percentages each include all four options. Gap is ZEC percentage minus share percentage.</caption>
          <thead><tr><th scope="col">{selected ? "Option" : "Proposal"}</th><th scope="col" className="coin-share-weight-scale" aria-label="Share and ZEC percentages, 0 to 100 percent"><span>0%</span><span>50%</span><span>100%</span></th><th scope="col">Revealed shares</th><th scope="col">Final ZEC</th><th scope="col">Gap · pp</th></tr></thead>
          <tbody>{selected ? INSIGHT_OPTIONS.map(option => <tr key={option.id}>
            <th scope="row"><span className={`coin-key-${option.id}`}>{option.label}</span></th><ComparisonCells comparison={compare(selected, option.id, history)} />
          </tr>) : proposals.map(proposal => <tr key={proposal.ballot}>
            <th scope="row"><button className="coin-share-weight-proposal" type="button" title={`#${proposal.ballot} ${proposal.title}`} onClick={() => onSelectBallot(proposal.ballot)}><span>#{proposal.ballot}</span><span>{proposal.title}</span></button></th><ComparisonCells comparison={compare(proposal, optionId, history)} />
          </tr>)}</tbody>
        </table>
      </div>
      <p className="coin-share-weight-caption">Each percentage includes all four options. Gap = ZEC % − share %.</p>
      {selected ? <details className="coin-share-weight-details"><summary>Proposal details</summary>
        {selected.correction ? <p>{selected.correction.text}{selected.correction.url ? <> <a href={selected.correction.url} target="_blank" rel="noopener noreferrer">FPF correction</a></> : null}</p> : null}
        <div><Link href={selected.verifyUrl}>Verify totals</Link><a href={selected.githubUrl} target="_blank" rel="noopener noreferrer">Grant application</a></div>
      </details> : null}
    </>}
  </section>;
}
