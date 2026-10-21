"use client";

import { CoinholderChartHelp } from "@/components/coinholder-analytics/coinholder-chart-help";
import { CoinholderBallotButtons } from "@/components/coinholder-analytics/coinholder-tally-match";

import { useMemo, useState, type CSSProperties } from "react";
import type { CoinholderOptionId, CoinholderProposal } from "@/lib/coinholder/analytics/model";
import { formatInsightUnits as zec } from "@/lib/coinholder/analytics/insights";
import { abstainBeyondMargin, recurringAmounts, RECURRING_GAP_UNITS, sameBallotCap, voteRange, type RecurringAmount } from "@/lib/coinholder/analytics/tally-patterns";

type Props = { proposals: CoinholderProposal[]; selectedBallot: number | null; onSelectBallot: (ballot: number | null) => void };

const LANES = [{ id: "abstain", label: "Abstain" }, { id: "lower", label: "Lower amount" }] as const satisfies ReadonlyArray<{ id: CoinholderOptionId; label: string }>;
const LABELS: Record<CoinholderOptionId, string> = { accept: "Accept", reject: "Reject", lower: "Lower amount", abstain: "Abstain" };
// Axis steps in whole ZEC; the first one that covers the largest total in five steps wins.
const STEPS = [100_000n, 200_000n, 250_000n, 500_000n, 1_000_000n, 2_000_000n, 5_000_000n] as const;
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 0 });
const axisLabel = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const short = (units: bigint) => compact.format(Number(units) / 8);
const percent = (value: number | null) => value === null ? "N/A" : `${value.toFixed(2)}%`;
const keyOf = (amount: RecurringAmount) => `${amount.option}:${amount.from}`;
const weight = (proposal: CoinholderProposal, option: CoinholderOptionId) => BigInt(proposal.options.find(item => item.id === option)?.weightUnits ?? "0");

/** A zero-based axis in 1/8-ZEC units, with at most five steps of whole ZEC. */
export function recurringAxis(maxUnits: bigint): { maxUnits: bigint; ticks: bigint[] } {
  const maxZec = maxUnits > 0n ? (maxUnits + 7n) / 8n : 1n;
  const step = STEPS.find(candidate => maxZec <= candidate * 5n) ?? STEPS[STEPS.length - 1];
  const count = (maxZec + step - 1n) / step;
  return { maxUnits: count * step * 8n, ticks: Array.from({ length: Number(count) + 1 }, (_, index) => BigInt(index) * step * 8n) };
}

export function CoinholderRecurringAmounts({ proposals, selectedBallot, onSelectBallot }: Props) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const { lanes, repeats, axis, cap, swing, range } = useMemo(() => {
    const lanes = LANES.map(lane => ({ ...lane, amounts: recurringAmounts(proposals, lane.id) }));
    const largest = proposals.flatMap(proposal => LANES.map(lane => weight(proposal, lane.id))).reduce((max, value) => value > max ? value : max, 0n);
    return {
      lanes,
      repeats: lanes.flatMap(lane => lane.amounts.filter(amount => amount.repeat)),
      axis: recurringAxis(largest),
      cap: sameBallotCap(proposals),
      swing: abstainBeyondMargin(proposals),
      range: proposals.length ? voteRange(proposals) : null,
    };
  }, [proposals]);
  const titles = useMemo(() => new Map(proposals.map(proposal => [proposal.ballot, proposal.title])), [proposals]);
  const largestRepeat = repeats.reduce<RecurringAmount | null>((best, amount) => !best || amount.ballots.length > best.ballots.length ? amount : best, null);
  const active = repeats.find(amount => keyOf(amount) === activeKey) ?? largestRepeat;
  const selected = proposals.find(proposal => proposal.ballot === selectedBallot);
  const position = (units: bigint) => Number(units * 10_000n / axis.maxUnits) / 100;
  const repeatFor = (option: CoinholderOptionId, ballot: number) => repeats.find(amount => amount.option === option && amount.ballots.includes(ballot));
  // Exact: the cap bounds every same-ballot block, so it must stay below half of the smallest vote.
  const noMajority = Boolean(cap && range && cap.units * 2n < range.min);
  const summary = repeats.length
    ? `Ticks mark each proposal’s Abstain and lower-amount ZEC. Recurring amounts: ${repeats.map(amount => `${LABELS[amount.option]} ×${amount.ballots.length} at ${short(amount.from)}–${short(amount.to)} ZEC`).join("; ")}. A data table follows.`
    : "Ticks mark each proposal’s Abstain and lower-amount ZEC. No amount recurs across proposals. A data table follows.";

  return <section className="coin-panel coin-repeat-panel" aria-label="Recurring amounts">
    <header className="coin-series-heading"><div><span className="coin-chart-index">07</span><h2>Recurring amounts</h2><p>Abstain and lower amount · final ZEC</p></div>
      {largestRepeat ? <div className="coin-series-metric"><strong>×{largestRepeat.ballots.length}</strong><span>largest repeat · {LABELS[largestRepeat.option]}</span></div> : null}</header>
    <CoinholderChartHelp chart="recurring" />
    {!proposals.length ? <div className="coin-chart-empty"><strong>Tallies unavailable</strong><p>Final tallies are needed to compare amounts.</p></div> : <>
      <figure className="coin-repeat-figure">
        <div className="coin-repeat-lanes" role="img" aria-label={summary}>
          {lanes.map(lane => <div className="coin-repeat-lane" key={lane.id} style={{ "--coin-repeat-color": `var(--coin-${lane.id})` } as CSSProperties}>
            <span className="coin-repeat-lane-label">{lane.label}</span>
            <div className="coin-repeat-track">
              {proposals.map(proposal => <i key={proposal.ballot} style={{ left: `${position(weight(proposal, lane.id))}%` }}
                className={`coin-repeat-tick${active?.option === lane.id && active.ballots.includes(proposal.ballot) ? " is-active" : ""}${proposal.ballot === selectedBallot ? " is-selected" : ""}`} />)}
              {lane.amounts.filter(amount => amount.repeat).map(amount => <span key={keyOf(amount)} style={{ left: `${position((amount.from + amount.to) / 2n)}%` }}
                className={`coin-repeat-count${active && keyOf(active) === keyOf(amount) ? " is-active" : ""}`}>×{amount.ballots.length}</span>)}
            </div>
          </div>)}
          <div className="coin-repeat-axis">{axis.ticks.map((tick, index) => <span key={String(tick)} style={{ left: `${position(tick)}%` }}
            className={index === 0 ? "is-first" : index === axis.ticks.length - 1 ? "is-last" : undefined}>{axisLabel.format(Number(tick) / 8)}</span>)}</div>
        </div>
        <figcaption>ZEC per proposal · totals less than {short(RECURRING_GAP_UNITS)} ZEC apart count as one amount</figcaption>
      </figure>
      {repeats.length ? <div className="coin-repeat-chips" role="group" aria-label="Choose a recurring amount">
        {repeats.map(amount => <button type="button" key={keyOf(amount)} aria-pressed={active !== null && keyOf(active) === keyOf(amount)} onClick={() => setActiveKey(keyOf(amount))}>
          <span className={`coin-key-${amount.option}`}>{LABELS[amount.option]}</span><strong>×{amount.ballots.length}</strong><span>{short(amount.from)}–{short(amount.to)} ZEC</span>
        </button>)}
      </div> : <p className="coin-repeat-none">No amount recurs across proposals.</p>}
      <div className="coin-repeat-readout">
        <p role="status" aria-live="polite">{active ? <><strong>{LABELS[active.option]} · {active.ballots.length} proposals</strong><span>{zec(active.from)}–{zec(active.to)} ZEC</span></> : null}</p>
        {active ? <CoinholderBallotButtons ballots={active.ballots} titles={titles} selectedBallot={selectedBallot} onSelectBallot={onSelectBallot} /> : null}
        {selected ? <p className="coin-repeat-selected"><strong>#{selected.ballot} {selected.title}</strong>
          {LANES.map(lane => {
            const repeat = repeatFor(lane.id, selected.ballot);
            return <span key={lane.id}>{lane.label} {zec(weight(selected, lane.id))} ZEC{repeat ? ` · recurs ×${repeat.ballots.length}` : ""}</span>;
          })}</p> : null}
      </div>
      {cap ? <p className="coin-repeat-callout">
        {noMajority ? <strong>No block of ZEC that voted the same way on every proposal held a majority. </strong> : null}
        {titles.get(cap.ballot)} had the smallest leading option of any proposal: {LABELS[cap.option]}, {zec(cap.units)} ZEC, {percent(cap.sharePercent)} of all ZEC voted on it, and every such block fits inside that option. This does not bound a holder who split their weight across options or wallets.
        {swing.length === 1 && swing[0] === cap.ballot ? " It is also the only proposal whose Abstain alone could have reversed the outcome."
          : swing.length ? ` Abstain alone could have reversed the outcome on ${swing.map(ballot => `#${ballot}`).join(", ")}.` : ""}
      </p> : null}
      <details className="coin-chart-data"><summary>Chart data</summary><div className="coin-data-scroll" tabIndex={0} role="region" aria-label="Scrollable recurring-amount data"><table>
        <caption>Abstain and lower-amount totals, grouped where consecutive totals are less than {zec(RECURRING_GAP_UNITS)} ZEC apart. Near-zero totals are not counted as recurring.</caption>
        <thead><tr><th scope="col">Option</th><th scope="col">Proposals</th><th scope="col">From (ZEC)</th><th scope="col">To (ZEC)</th><th scope="col" className="coin-repeat-ballots">Ballots</th></tr></thead>
        <tbody>{lanes.flatMap(lane => lane.amounts.map(amount => <tr key={keyOf(amount)}>
          <td>{lane.label}{amount.repeat ? " · recurring" : ""}</td><td>{amount.ballots.length}</td><td>{zec(amount.from)}</td><td>{zec(amount.to)}</td>
          <td className="coin-repeat-ballots">{amount.ballots.map(ballot => `#${ballot}`).join(", ")}</td>
        </tr>))}</tbody>
      </table></div></details>
    </>}
  </section>;
}
