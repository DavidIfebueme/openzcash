"use client";

import { useId, useRef, useState, type PointerEvent } from "react";
import type { CoinholderRevealHistory } from "@/lib/coinholder/analytics/reveals";
import { CoinholderChartHelp } from "@/components/coinholder-analytics/coinholder-chart-help";
import { CoinholderChartAxes, coinholderAxisIndices, coinholderAxisIntervals, coinholderCountScale, coinholderPlot as plot, coinholderTooltipPercent, coinholderPointerX, useCoinholderChartGeometry } from "@/components/coinholder-analytics/coinholder-chart-axis";

type RevealDay = CoinholderRevealHistory["days"][number];
type RevealView = "daily" | "cumulative";
type OptionKey = keyof RevealDay["counts"];
const options: { key: OptionKey; label: string; dash?: string }[] = [
  { key: "accept", label: "Accept" },
  { key: "reject", label: "Reject", dash: "7 3" },
  { key: "lower", label: "Reject · lower amount", dash: "2 3" },
  { key: "abstain", label: "Abstain", dash: "10 3 2 3" }
];
const numbers = new Intl.NumberFormat("en-US");
const dayLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const fullDayLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const shareLabel = (count: number) => `${numbers.format(count)} ${count === 1 ? "share" : "shares"}`;

function RevealPlot({ days, view }: { days: RevealDay[]; view: RevealView }) {
  const id = useId();
  const { svg, container, geometry, measure } = useCoinholderChartGeometry();
  const focused = useRef(false);
  const [inspection, setInspection] = useState<{ index: number; method: "pointer" | "keyboard" | "touch" } | null>(null);
  const step = plot.width / days.length;
  const values = (day: RevealDay) => view === "daily" ? day.counts : day.cumulative;
  const largest = view === "daily" ? Math.max(...days.map(day => day.total))
    : Math.max(...days.flatMap(day => options.map(option => day.cumulative[option.key])));
  const { max, ticks } = coinholderCountScale(largest, coinholderAxisIntervals(geometry));
  const y = (value: number) => plot.top + plot.height - value / max * plot.height;
  const defaultIndex = view === "cumulative" ? days.length - 1 : days.findIndex(day => day.total === largest);
  const currentIndex = inspection?.index ?? defaultIndex;
  const current = days[currentIndex];
  const currentValues = values(current);
  const currentTotal = view === "daily" ? current.total : current.cumulativeTotal;
  const markerX = plot.left + (currentIndex + (view === "daily" ? .5 : 1)) * step;
  const tooltipX = plot.left + (currentIndex + .5) * step;
  const tooltipPercent = coinholderTooltipPercent(tooltipX, geometry);
  const selectionText = `${fullDayLabel.format(new Date(current.at))} UTC; ${view === "cumulative" ? "cumulative through the end of this day; " : ""}${options.map(option => `${option.label}: ${shareLabel(currentValues[option.key])}`).join("; ")}; total ${shareLabel(currentTotal)}`;

  const inspectPointer = (event: PointerEvent<SVGRectElement>) => {
    const bounds = measure();
    if (!bounds) return;
    const position = coinholderPointerX(event.clientX, bounds) - plot.left;
    const index = Math.max(0, Math.min(days.length - 1, Math.floor(position / step)));
    const method = event.pointerType === "touch" ? "touch" : "pointer";
    setInspection(previous => previous?.index === index && previous.method === method ? previous : { index, method });
  };
  const stepPath = (key: OptionKey) => {
    const initial = days[0].cumulative[key] - days[0].counts[key];
    // A daily snapshot changes at the interval's end, without intraday interpolation.
    return `M ${plot.left} ${y(initial)} ${days.map((day, index) => `H ${plot.left + (index + 1) * step} V ${y(day.cumulative[key])}`).join(" ")}`;
  };

  return <div ref={container} className="coin-chart-plot coin-reveal-plot">
    <p className="coin-sr-only" id={`${id}-hint`}>Hover or tap to inspect a UTC day. Use the left and right arrow keys, Home or End to move, and Escape to dismiss.</p>
    <svg ref={svg} viewBox="0 0 872 252" preserveAspectRatio="none" role="group" aria-label="Interactive revealed-share chart">
      <g role="img" aria-label={`${view === "daily" ? "Daily" : "Cumulative"} revealed shares by option; ${shareLabel(days.at(-1)!.cumulativeTotal)} in the selected history. Daily snapshots in UTC. Exact counts follow in a table.`}>
        {ticks.map(value => <line key={value} x1={plot.left} x2={plot.left + plot.width} y1={y(value)} y2={y(value)} className="coin-chart-grid" />)}
        {view === "daily" ? days.map((day, index) => {
          let accumulated = 0;
          return <g key={day.at}>{options.map(option => {
            const count = day.counts[option.key];
            accumulated += count;
            return <rect key={option.key} className={`coin-reveal-bar coin-reveal-${option.key}`}
              x={plot.left + index * step + Math.min(6, step / 8)} y={y(accumulated)}
              width={Math.max(.3, step - Math.min(12, step / 4))} height={count / max * plot.height}>
              <title>{`${dayLabel.format(new Date(day.at))} UTC · ${option.label}: ${shareLabel(count)}`}</title>
            </rect>;
          })}</g>;
        }) : options.map(option => <path key={option.key} className={`coin-reveal-line coin-reveal-${option.key}`} d={stepPath(option.key)} strokeDasharray={option.dash} />)}

      </g>
      {inspection ? <g className="coin-reveal-marker" aria-hidden="true">
        <line x1={markerX} x2={markerX} y1={plot.top} y2={plot.top + plot.height} className="coin-reveal-cursor" />
        {view === "cumulative" ? options.map(option => <ellipse key={option.key} cx={markerX} cy={y(currentValues[option.key])} rx={geometry ? 4 / geometry.scaleX : 4} ry={geometry ? 4 / geometry.scaleY : 4} className={`coin-reveal-point coin-reveal-${option.key}`} />) : null}
      </g> : null}
      <rect className="coin-chart-target" x={plot.left} y={plot.top} width={plot.width} height={plot.height} fill="transparent"
        role="slider" tabIndex={0} aria-label="Inspect revealed shares" aria-orientation="horizontal"
        aria-valuemin={1} aria-valuemax={days.length} aria-valuenow={currentIndex + 1} aria-valuetext={selectionText}
        aria-describedby={`${id}-hint${inspection ? ` ${id}-tooltip` : ""}`}
        onPointerMove={inspectPointer} onPointerDown={inspectPointer}
        onPointerLeave={() => setInspection(previous => !focused.current && previous?.method === "pointer" ? null : previous)}
        onFocus={() => { focused.current = true; measure(); setInspection(previous => previous ?? { index: defaultIndex, method: "keyboard" }); }}
        onBlur={() => { focused.current = false; setInspection(null); }}
        onKeyDown={event => {
          if (event.key === "Escape") { event.preventDefault(); setInspection(null); return; }
          const next = event.key === "Home" ? 0 : event.key === "End" ? days.length - 1 : event.key === "ArrowLeft" ? currentIndex - 1 : event.key === "ArrowRight" ? currentIndex + 1 : null;
          if (next === null) return;
          event.preventDefault(); measure();
          setInspection({ index: Math.max(0, Math.min(days.length - 1, next)), method: "keyboard" });
        }} />
    </svg>
    <CoinholderChartAxes geometry={geometry} ticks={ticks} max={max} labels={coinholderAxisIndices(days.length, geometry ? plot.width * geometry.scaleX : undefined).map(index => ({
      x: plot.left + (index + (view === "daily" ? .5 : 1)) * step,
      label: dayLabel.format(new Date(view === "daily" ? days[index].at : days[index].until)),
    }))} />
    {inspection ? <div className="coin-chart-tooltip coin-reveal-tooltip" role="tooltip" id={`${id}-tooltip`}
      style={{ left: `clamp(min(50%, 128px), ${tooltipPercent}%, max(50%, calc(100% - 128px)))` }}>
      <time dateTime={current.at}>{fullDayLabel.format(new Date(current.at))} · UTC</time>
      <span>{view === "daily" ? "During this day" : `Through ${dayLabel.format(new Date(current.until))}, 00:00 UTC`}</span>
      <dl>{options.map(option => <div key={option.key}><dt><i className={`coin-reveal-swatch coin-reveal-${option.key}`} aria-hidden="true" />{option.label}</dt><dd>{shareLabel(currentValues[option.key])}</dd></div>)}</dl>
      <strong>{shareLabel(currentTotal)} <small>total</small></strong>
    </div> : null}
  </div>;
}

export function CoinholderRevealsChart({ history, selectedBallot }: { history: CoinholderRevealHistory | null; selectedBallot: number | null }) {
  const [view, setView] = useState<RevealView>("cumulative");
  const days = selectedBallot === null ? history?.days : history?.proposals.find(proposal => proposal.id === selectedBallot)?.days;
  const available = Boolean(history?.complete && days?.length);
  return <section className="coin-panel coin-reveal-panel" aria-label="Revealed shares">
    <header className="coin-series-heading"><div><span className="coin-chart-index">02</span><h2>Revealed shares</h2><p>Daily · UTC</p></div>
      {available ? <div className="coin-series-metric"><strong>{numbers.format(days!.at(-1)!.cumulativeTotal)}</strong><span>Total shares</span></div> : null}
    </header>
    <CoinholderChartHelp chart="reveals" />
    {available && days ? <>
      <div className="coin-reveal-toolbar">
        <div className="coin-segmented" role="group" aria-label="Reveal view">{([['daily', 'Daily'], ['cumulative', 'Cumulative']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)}>{label}</button>)}</div>
        <ul className="coin-reveal-legend" aria-label="Share options">{options.map(option => <li key={option.key}><svg viewBox="0 0 24 8" width="24" height="8" aria-hidden="true" className={`coin-reveal-${option.key}`}><line x1="0" y1="4" x2="24" y2="4" stroke="currentColor" strokeWidth="2" strokeDasharray={view === "cumulative" ? option.dash : undefined} /></svg><span>{option.label}</span></li>)}</ul>
      </div>
      <figure className="coin-chart"><RevealPlot key={`${selectedBallot ?? "all"}/${view}/${history!.sha256}`} days={days} view={view} /><figcaption><span>{dayLabel.format(new Date(days[0].at))}–{fullDayLabel.format(new Date(days.at(-1)!.at))} · UTC</span></figcaption></figure>
      <details className="coin-chart-data coin-reveal-data"><summary>Share data</summary><div className="coin-data-scroll" tabIndex={0} role="region" aria-label="Scrollable revealed-share data">
        <table><caption>Revealed shares by UTC day. Option columns show daily counts. The first day starts at round creation.</caption><thead><tr><th scope="col">Day · UTC</th>{options.map(option => <th key={option.key} scope="col">{option.label}</th>)}<th scope="col">Daily total</th><th scope="col">Cumulative total</th></tr></thead>
          <tbody>{days.map(day => <tr key={day.at}><th scope="row"><time dateTime={day.at}>{fullDayLabel.format(new Date(day.at))}</time></th>{options.map(option => <td key={option.key}>{numbers.format(day.counts[option.key])}</td>)}<td>{numbers.format(day.total)}</td><td>{numbers.format(day.cumulativeTotal)}</td></tr>)}</tbody>
        </table>
      </div></details>
    </> : <div className="coin-chart-empty"><strong>Share history unavailable</strong><p>Verified daily records are not available for this selection.</p></div>}
  </section>;
}
