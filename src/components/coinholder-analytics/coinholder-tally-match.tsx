"use client";

import { CoinholderChartHelp } from "@/components/coinholder-analytics/coinholder-chart-help";

import { useId, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from "react";
import type { CoinholderActivitySeries, CoinholderProposal } from "@/lib/coinholder/analytics/model";
import { formatInsightUnits } from "@/lib/coinholder/analytics/insights";
import { formatTallyDistance, groupTallies, pairTallies, TALLY_GROUP_LIMIT_BP, voteRange, type TallyGroup } from "@/lib/coinholder/analytics/tally-patterns";

type Props = {
  proposals: CoinholderProposal[];
  activity: CoinholderActivitySeries | null;
  selectedBallot: number | null;
  onSelectBallot: (ballot: number | null) => void;
};
type Cell = { row: number; column: number };
type Inspection = Cell & { method: "pointer" | "touch" | "keyboard" };

const CELL = 10;
const BAND = 16;
// Closer pairs take more of the accent; upper bounds are inclusive, like the grouping limit.
const SHADES = [
  { upTo: 1, label: "Up to 1%" }, { upTo: 2, label: "1–2%" }, { upTo: 5, label: "2–5%" },
  { upTo: 15, label: "5–15%" }, { upTo: 35, label: "15–35%" }, { upTo: Number.POSITIVE_INFINITY, label: "Over 35%" },
] as const;
const MOVES: Record<string, readonly [number, number]> = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
const VERBS = { accept: "accepted", reject: "rejected", lower: "chose lower amount", abstain: "abstained" } as const;
const FIRST_PAIR: Cell = { row: 0, column: 1 };
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 0 });
const counts = new Intl.NumberFormat("en-US");
const percent = (value: number | null) => value === null ? "N/A" : `${value.toFixed(2)}%`;
const shade = (value: number | null) => value === null ? SHADES.length - 1 : SHADES.findIndex(item => value <= item.upTo);
const pairKey = (left: number, right: number) => left < right ? `${left}:${right}` : `${right}:${left}`;
const LIMIT = `${Number(TALLY_GROUP_LIMIT_BP) / 100}%`;

export function tallyGroupLabel(group: TallyGroup): string {
  return group.nearUnanimous ? `${group.outcome} · near-unanimous`
    : `${group.outcome} · ~${compact.format(Number(group.runnerUpMeanUnits) / 8)} ZEC ${VERBS[group.runnerUp]}`;
}

export function CoinholderBallotButtons({ ballots, titles, selectedBallot, onSelectBallot }: {
  ballots: number[]; titles: Map<number, string>; selectedBallot: number | null; onSelectBallot: (ballot: number | null) => void;
}) {
  return <div className="coin-match-ballots">{ballots.map(ballot => <button key={ballot} type="button" aria-pressed={selectedBallot === ballot}
    aria-label={`Select #${ballot} ${titles.get(ballot) ?? ""}`} title={`#${ballot} ${titles.get(ballot) ?? ""}`}
    onClick={() => onSelectBallot(selectedBallot === ballot ? null : ballot)}>#{ballot}</button>)}</div>;
}

export function CoinholderTallyMatchChart({ proposals, activity, selectedBallot, onSelectBallot }: Props) {
  const id = useId();
  const svg = useRef<SVGSVGElement>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const { grouping, pairs, range } = useMemo(() => ({
    grouping: groupTallies(proposals),
    pairs: new Map(pairTallies(proposals).map(pair => [pairKey(pair.a, pair.b), pair])),
    range: proposals.length ? voteRange(proposals) : null,
  }), [proposals]);
  const titles = useMemo(() => new Map(proposals.map(proposal => [proposal.ballot, proposal.title])), [proposals]);
  const order = grouping.order;
  const n = order.length;
  const size = BAND + n * CELL;
  const cells = useMemo(() => order.flatMap((rowBallot, row) => order.map((columnBallot, column) => row === column
    ? <rect key={`${row}:${column}`} x={BAND + column * CELL} y={BAND + row * CELL} width={CELL - 1} height={CELL - 1} className="coin-match-self" />
    : <rect key={`${row}:${column}`} x={BAND + column * CELL} y={BAND + row * CELL} width={CELL - 1} height={CELL - 1}
      className={`coin-match-cell coin-match-shade-${shade(pairs.get(pairKey(rowBallot, columnBallot))?.sharePercent ?? null)}`} />)), [order, pairs]);
  const spans = grouping.groups.map((group, index) => ({
    letter: group.letter, length: group.ballots.length,
    start: grouping.groups.slice(0, index).reduce((sum, item) => sum + item.ballots.length, 0),
  }));
  const boundaries = spans.slice(1).map(span => span.start).concat(spans.length && grouping.ungrouped.length ? [n - grouping.ungrouped.length] : []);
  const selectedIndex = selectedBallot === null ? -1 : order.indexOf(selectedBallot);
  const grouped = n - grouping.ungrouped.length;
  const casts = activity?.complete ? activity.proposals.map(proposal => proposal.castMessages) : [];
  const describe = (cell: Cell) => {
    const a = order[cell.row];
    const b = order[cell.column];
    return { ...cell, a, b, pair: pairs.get(pairKey(a, b)) };
  };
  const inspected = inspection && inspection.row < n && inspection.column < n ? describe(inspection) : null;
  const current = n > 1 ? describe(inspected ?? FIRST_PAIR) : null;
  const selectedNearest = selectedBallot === null ? undefined : grouping.nearest.get(selectedBallot);
  const selectedGroup = selectedBallot === null ? undefined : grouping.groups.find(group => group.letter === grouping.groupOf.get(selectedBallot));

  const cellFromPointer = (event: PointerEvent<SVGRectElement>): Cell | null => {
    const bounds = svg.current?.getBoundingClientRect();
    if (!bounds?.width) return null;
    const scale = bounds.width / size;
    const column = Math.floor(((event.clientX - bounds.left) / scale - BAND) / CELL);
    const row = Math.floor(((event.clientY - bounds.top) / scale - BAND) / CELL);
    return row >= 0 && column >= 0 && row < n && column < n && row !== column ? { row, column } : null;
  };
  const inspectPointer = (event: PointerEvent<SVGRectElement>) => {
    const cell = cellFromPointer(event);
    const method = event.pointerType === "touch" ? "touch" : "pointer";
    setInspection(previous => !cell ? previous?.method === "keyboard" ? previous : null
      : previous?.row === cell.row && previous.column === cell.column && previous.method === method ? previous : { ...cell, method });
  };
  // Only keyboard focus seeds a pair; a click already chose its own cell, or none on the diagonal.
  const seedOnKeyboardFocus = (event: FocusEvent<SVGRectElement>) => {
    if (event.currentTarget.matches(":focus-visible")) setInspection(previous => previous ?? { ...FIRST_PAIR, method: "keyboard" });
  };
  const moveFocus = (event: KeyboardEvent<SVGRectElement>) => {
    const from = inspection ?? FIRST_PAIR;
    if (event.key === "Escape") {
      event.preventDefault();
      if (inspection) setInspection(null);
      else if (selectedBallot !== null) onSelectBallot(null);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectBallot(order[from.row] === selectedBallot ? null : order[from.row]);
      return;
    }
    const move = MOVES[event.key];
    if (!move) return;
    event.preventDefault();
    const clamp = (value: number) => Math.max(0, Math.min(n - 1, value));
    const step = (cell: Cell): Cell => ({ row: clamp(cell.row + move[0]), column: clamp(cell.column + move[1]) });
    // The diagonal compares a proposal with itself, so keyboard moves step over it.
    const once = step(from);
    const twice = step(once);
    const next = once.row !== once.column ? once : twice.row !== twice.column ? twice : from;
    setInspection({ ...next, method: "keyboard" });
  };

  return <section className="coin-panel coin-match-panel" aria-label="Matching tallies">
    <header className="coin-series-heading"><div><span className="coin-chart-index">06</span><h2>Matching tallies</h2><p>Final ZEC · every pair of proposals</p></div>
      {n > 1 ? <div className="coin-series-metric"><strong>{grouped} of {n}</strong><span>with a near-copy</span></div> : null}</header>
    <CoinholderChartHelp chart="matching" />
    {!current ? <div className="coin-chart-empty"><strong>Tallies unavailable</strong><p>At least two final tallies are needed to compare proposals.</p></div> : <>
      <div className="coin-match-legend" aria-label="Distance scale"><span>Share of the vote apart</span>
        {SHADES.map((item, index) => <span key={item.label} className={`coin-match-key coin-match-shade-${index}`}><i aria-hidden="true" />{item.label}</span>)}</div>
      <div className="coin-match-layout">
        <figure className="coin-match-figure">
          <p className="coin-sr-only" id={`${id}-hint`}>Use the arrow keys to compare adjacent pairs, Enter to select or clear the row’s proposal and Escape to clear. A data table follows.</p>
          <svg ref={svg} viewBox={`0 0 ${size} ${size}`} role="group" aria-label="Interactive matching-tallies matrix">
            <g role="img" aria-label={`${n} proposals compared in pairs and ordered by group. ${grouped} have a tally within ${LIMIT} of another proposal’s.`}>{cells}</g>
            <g className="coin-match-boundaries" aria-hidden="true">{boundaries.map(start => <g key={start}>
              <line x1={BAND + start * CELL - .5} x2={BAND + start * CELL - .5} y1={BAND} y2={size} />
              <line x1={BAND} x2={size} y1={BAND + start * CELL - .5} y2={BAND + start * CELL - .5} />
            </g>)}</g>
            <g className="coin-match-bands" aria-hidden="true">{spans.map(span => <g key={span.letter}>
              <text x={BAND + (span.start + span.length / 2) * CELL - .5} y={BAND - 5} textAnchor="middle">{span.letter}</text>
              <text x={BAND / 2} y={BAND + (span.start + span.length / 2) * CELL - .5} dy=".35em" textAnchor="middle">{span.letter}</text>
            </g>)}</g>
            {selectedIndex >= 0 ? <g className="coin-match-selected" aria-hidden="true">
              <rect x={BAND - .5} y={BAND + selectedIndex * CELL - .5} width={n * CELL} height={CELL} />
              <rect x={BAND + selectedIndex * CELL - .5} y={BAND - .5} width={CELL} height={n * CELL} />
            </g> : null}
            {inspected ? <rect className="coin-match-inspected" aria-hidden="true" x={BAND + inspected.column * CELL - .5} y={BAND + inspected.row * CELL - .5} width={CELL} height={CELL} /> : null}
            <rect className="coin-match-target" x={BAND} y={BAND} width={n * CELL} height={n * CELL} fill="transparent" tabIndex={0} role="slider"
              aria-label="Compare proposal pairs" aria-valuemin={1} aria-valuemax={n * n} aria-valuenow={current.row * n + current.column + 1}
              aria-valuetext={`#${current.a} ${titles.get(current.a)} and #${current.b} ${titles.get(current.b)}: ${current.pair ? `${formatTallyDistance(current.pair.distance)} ZEC apart, ${percent(current.pair.sharePercent)} of the vote` : "unavailable"}`}
              aria-describedby={`${id}-hint`}
              onPointerMove={inspectPointer} onPointerDown={inspectPointer}
              onPointerLeave={() => setInspection(previous => previous?.method === "pointer" ? null : previous)}
              onFocus={seedOnKeyboardFocus} onBlur={() => setInspection(null)} onKeyDown={moveFocus} />
          </svg>
          <div className="coin-match-readout" role="status" aria-live="off">
            {inspected?.pair ? <>
              <div><strong>#{inspected.a} {titles.get(inspected.a)}</strong><strong>#{inspected.b} {titles.get(inspected.b)}</strong></div>
              <p><span>{formatTallyDistance(inspected.pair.distance)} ZEC apart</span><span>{percent(inspected.pair.sharePercent)} of the vote</span></p>
            </> : selectedBallot !== null && selectedNearest ? <>
              <div><strong>#{selectedBallot} {titles.get(selectedBallot)}</strong><span>{selectedGroup ? `Group ${selectedGroup.letter} · ${tallyGroupLabel(selectedGroup)}` : "No near-copy"}</span></div>
              <p><span>Nearest: #{selectedNearest.ballot} {titles.get(selectedNearest.ballot)}</span><span>{formatTallyDistance(selectedNearest.distance)} ZEC apart · {percent(selectedNearest.sharePercent)} of the vote</span></p>
            </> : <p>Hover, focus or tap a cell to compare two proposals.</p>}
          </div>
        </figure>
        <ol className="coin-match-groups" aria-label="Groups of matching tallies">
          {grouping.groups.map(group => <li key={group.letter}>
            <span className="coin-match-letter" aria-hidden="true">{group.letter}</span>
            <div><strong><span className="coin-sr-only">Group {group.letter}: </span>{tallyGroupLabel(group)}</strong>
              <CoinholderBallotButtons ballots={group.ballots} titles={titles} selectedBallot={selectedBallot} onSelectBallot={onSelectBallot} /></div>
          </li>)}
          {grouping.ungrouped.length ? <li>
            <span className="coin-match-letter" aria-hidden="true">·</span>
            <div><strong>No near-copy</strong>
              <CoinholderBallotButtons ballots={grouping.ungrouped} titles={titles} selectedBallot={selectedBallot} onSelectBallot={onSelectBallot} /></div>
          </li> : null}
        </ol>
      </div>
      <p className="coin-match-caption">
        About the same ZEC voted on every proposal: {range ? `${formatInsightUnits(range.min)}–${formatInsightUnits(range.max)} ZEC` : "unavailable"}{casts.length ? `, from ${counts.format(Math.min(...casts))} to ${counts.format(Math.max(...casts))} casts each` : ""}. A pair’s distance is half the sum of its four option differences; with totals this close, that is about the least ZEC that would have to change option to turn one tally into the other. Groups chain pairs within {LIMIT} of the vote. These are patterns in public totals; they do not identify holders.
      </p>
      <details className="coin-chart-data"><summary>Chart data</summary><div className="coin-data-scroll" tabIndex={0} role="region" aria-label="Scrollable matching-tally data"><table>
        <caption>Nearest final tally for each proposal. ZEC apart is half the sum of the four option differences between the two tallies.</caption>
        <thead><tr><th scope="col">Proposal</th><th scope="col">Group</th><th scope="col">Nearest</th><th scope="col">ZEC apart</th><th scope="col">Share of vote</th></tr></thead>
        <tbody>{order.map(ballot => {
          const nearest = grouping.nearest.get(ballot);
          return <tr key={ballot}><td>#{ballot} {titles.get(ballot)}</td><td>{grouping.groupOf.get(ballot) ?? "—"}</td><td>{nearest ? `#${nearest.ballot}` : "—"}</td>
            <td>{nearest ? formatTallyDistance(nearest.distance) : "—"}</td><td>{nearest ? percent(nearest.sharePercent) : "—"}</td></tr>;
        })}</tbody>
      </table></div></details>
    </>}
  </section>;
}
