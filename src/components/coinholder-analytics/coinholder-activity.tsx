"use client";

import Link from "next/link";
import { proposalVerifyHref } from "@/lib/coinholder/proposal-decision";
import { useId, useMemo, useRef, useState, type PointerEvent } from "react";
import type { CoinholderActivitySeries, CoinholderHistoryBucket, CoinholderProposal } from "@/lib/coinholder/analytics/model";
import { CoinholderRevealsChart } from "@/components/coinholder-analytics/coinholder-reveals-chart";
import type { CoinholderRevealHistory } from "@/lib/coinholder/analytics/reveals";
import { CoinholderShareWeightChart } from "@/components/coinholder-analytics/coinholder-share-weight-chart";
import { CoinholderDecisionChart } from "@/components/coinholder-analytics/coinholder-decision-chart";
import { CoinholderHeatmap } from "@/components/coinholder-analytics/coinholder-heatmap";
import { CoinholderChartHelp } from "@/components/coinholder-analytics/coinholder-chart-help";
import { CoinholderChartAxes, coinholderAxisIndices, coinholderAxisIntervals, coinholderCountScale, coinholderPlot as plot, coinholderTooltipPercent, coinholderPointerX, useCoinholderChartGeometry } from "@/components/coinholder-analytics/coinholder-chart-axis";

const HOUR = 3_600_000;
const MINUTE = 60_000;
const DAY = 24 * HOUR;
type ChartInterval = "day" | "hour" | "minute";
const chartDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
const dayDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const countFormat = new Intl.NumberFormat("en-US");
const castCount = (count: number) => `${countFormat.format(count)} ${count === 1 ? "cast" : "casts"}`;

function periodLabel(at: string, interval: ChartInterval) {
  const end = new Date(Date.parse(at) + (interval === "day" ? DAY : interval === "hour" ? HOUR : MINUTE)).toISOString();
  return `${chartDate.format(new Date(at))}–${at.slice(0, 10) === end.slice(0, 10) ? end.slice(11, 16) : chartDate.format(new Date(end))} UTC`;
}

function CastPlot({ buckets, interval, total }: {
  buckets: CoinholderHistoryBucket[];
  interval: ChartInterval;
  total: number;
}) {
  const id = useId();
  const focused = useRef(false);
  const { svg, container, geometry, measure } = useCoinholderChartGeometry();
  const [inspection, setInspection] = useState<{ index: number; method: "pointer" | "keyboard" | "touch" } | null>(null);
  const values = buckets.map(bucket => bucket.count);
  const highest = Math.max(1, ...values);
  const { max, ticks } = coinholderCountScale(highest, coinholderAxisIntervals(geometry));
  const step = plot.width / buckets.length;
  const y = (value: number) => plot.top + plot.height - value / max * plot.height;
  const x = (index: number) => plot.left + (index + .5) * step;
  const peakIndex = values.indexOf(Math.max(...values));
  const currentIndex = inspection?.index ?? peakIndex;
  const current = buckets[currentIndex];
  const inspectPointer = (event: PointerEvent<SVGRectElement>) => {
    const bounds = measure();
    if (!bounds) return;
    const position = coinholderPointerX(event.clientX, bounds) - plot.left;
    const index = Math.max(0, Math.min(buckets.length - 1, Math.floor(position / step)));
    const method = event.pointerType === "touch" ? "touch" : "pointer";
    setInspection(previous => previous?.index === index && previous.method === method ? previous : { index, method });
  };

  return <div ref={container} className="coin-chart-plot">
    <p className="coin-sr-only" id={`${id}-hint`}>Hover or tap to inspect a period. Use the left and right arrow keys to move, Home or End to jump, and Escape to dismiss.</p>
    <svg ref={svg} viewBox="0 0 872 252" preserveAspectRatio="none" role="group" aria-label="Interactive voting activity chart">
      <g role="img" aria-label={`Casts per ${interval}, ${countFormat.format(total)} casts in the selected period. Times in UTC. A data table follows.`}>
        {ticks.map(value => <line key={value} x1={plot.left} x2={plot.left + plot.width} y1={y(value)} y2={y(value)} className="coin-chart-grid" />)}
        {buckets.map((bucket, index) => <rect key={bucket.at} x={plot.left + index * step + Math.min(6, step / 8)} y={y(bucket.count)} width={Math.max(.3, step - Math.min(12, step / 4))} height={bucket.count / max * plot.height} rx={Math.min(3, step / 4)} className={`coin-chart-bar${inspection?.index === index ? " coin-chart-bar--active" : ""}`}><title>{`${chartDate.format(new Date(bucket.at))} UTC · ${countFormat.format(bucket.count)} casts`}</title></rect>)}

      </g>
      {inspection ? <g aria-hidden="true" className="coin-chart-marker"><line x1={x(currentIndex)} x2={x(currentIndex)} y1={plot.top} y2={plot.top + plot.height} /><ellipse cx={x(currentIndex)} cy={y(values[currentIndex])} rx={geometry ? 4 / geometry.scaleX : 4} ry={geometry ? 4 / geometry.scaleY : 4} /></g> : null}
      <rect className="coin-chart-target" x={plot.left} y={plot.top} width={plot.width} height={plot.height}
        fill="transparent" role="slider" tabIndex={0} aria-label="Inspect cast activity"
        aria-orientation="horizontal" aria-valuemin={1} aria-valuemax={buckets.length} aria-valuenow={currentIndex + 1}
        aria-valuetext={`${periodLabel(current.at, interval)}; ${castCount(current.count)}; ${countFormat.format(current.cumulative)} cumulative`}
        aria-describedby={`${id}-hint${inspection ? ` ${id}-tooltip` : ""}`}
        onPointerMove={inspectPointer} onPointerDown={inspectPointer}
        onPointerLeave={() => setInspection(previous => !focused.current && previous?.method === "pointer" ? null : previous)}
        onFocus={() => { focused.current = true; measure(); setInspection(previous => previous ?? { index: peakIndex, method: "keyboard" }); }}
        onBlur={() => { focused.current = false; setInspection(null); }}
        onKeyDown={event => {
          if (event.key === "Escape") { event.preventDefault(); setInspection(null); return; }
          const next = event.key === "Home" ? 0 : event.key === "End" ? buckets.length - 1 : event.key === "ArrowLeft" ? currentIndex - 1 : event.key === "ArrowRight" ? currentIndex + 1 : null;
          if (next === null) return;
          event.preventDefault(); measure();
          setInspection({ index: Math.max(0, Math.min(buckets.length - 1, next)), method: "keyboard" });
        }} />
    </svg>
    <CoinholderChartAxes geometry={geometry} ticks={ticks} max={max} labels={coinholderAxisIndices(buckets.length, geometry ? plot.width * geometry.scaleX : undefined).map(index => ({
      x: x(index), label: interval === "minute" ? buckets[index].at.slice(11, 16) : dayDate.format(new Date(buckets[index].at)),
      detail: interval === "hour" ? buckets[index].at.slice(11, 16) : undefined,
    }))} />
    {inspection ? <div className="coin-chart-tooltip" role="tooltip" id={`${id}-tooltip`} style={{ left: `clamp(96px, ${coinholderTooltipPercent(x(currentIndex), geometry)}%, calc(100% - 96px))` }}>
      <time>{periodLabel(current.at, interval)}</time>
      <strong>{castCount(current.count)}</strong>
      <span>{countFormat.format(current.cumulative)} cumulative</span>
    </div> : null}
  </div>;
}

/** Fill missing intervals with zero casts; a missing source is handled separately. */
export function fillCoinholderBuckets(buckets: CoinholderHistoryBucket[], from: number, to: number, interval: number) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from || (to - from) / interval > 10_000) return [];
  const values = new Map(buckets.map(bucket => [Date.parse(bucket.at), bucket.count]));
  const result: CoinholderHistoryBucket[] = [];
  let cumulative = buckets.filter(bucket => Date.parse(bucket.at) < from).reduce((sum, bucket) => sum + bucket.count, 0);
  for (let at = from; at <= to; at += interval) {
    const count = values.get(at) ?? 0;
    cumulative += count;
    result.push({ at: new Date(at).toISOString(), count, cumulative });
  }
  return result;
}

/** UTC day totals from the verified hourly series; never redistribute final ZEC weights. */
export function groupCoinholderDays(hours: CoinholderHistoryBucket[]) {
  const counts = new Map<number, number>();
  for (const bucket of hours) {
    const day = Math.floor(Date.parse(bucket.at) / DAY) * DAY;
    counts.set(day, (counts.get(day) ?? 0) + bucket.count);
  }
  let cumulative = 0;
  return [...counts].sort(([a], [b]) => a - b).map(([at, count]) => {
    cumulative += count;
    return { at: new Date(at).toISOString(), count, cumulative };
  });
}

export function CoinholderActivityChart({ activity, revealHistory, proposals, selectedBallot, onSelectBallot }: {
  revealHistory: CoinholderRevealHistory | null;
  activity: CoinholderActivitySeries | null;
  proposals: CoinholderProposal[];
  selectedBallot: number | null;
  onSelectBallot: (ballot: number | null) => void;
}) {
  const [interval, setInterval] = useState<ChartInterval>("day");
  const [hour, setHour] = useState<{ at: string; ballot: number | null } | null>(null);
  const selectedProposal = proposals.find(proposal => proposal.ballot === selectedBallot);
  const selected = selectedBallot === null ? activity : activity?.proposals.find(proposal => proposal.id === selectedBallot);
  const hours = useMemo(() => {
    if (!activity?.coverage.firstAt || !activity.coverage.lastAt || !selected) return [];
    return fillCoinholderBuckets(selected.hours, Math.floor(Date.parse(activity.coverage.firstAt) / HOUR) * HOUR, Math.floor(Date.parse(activity.coverage.lastAt) / HOUR) * HOUR, HOUR);
  }, [activity, selected]);
  const peak = hours.reduce<CoinholderHistoryBucket | null>((largest, bucket) => !largest || bucket.count > largest.count ? bucket : largest, null);
  const selectedHour = (hour?.ballot === selectedBallot ? hours.find(bucket => bucket.at === hour.at)?.at : null) ?? peak?.at ?? null;
  const buckets = interval === "day" ? groupCoinholderDays(hours) : interval === "hour" ? hours : selectedHour && selected
    ? fillCoinholderBuckets(selected.minutes, Date.parse(selectedHour), Date.parse(selectedHour) + HOUR - MINUTE, MINUTE) : [];
  const shownTotal = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const peakCount = Math.max(0, ...buckets.map(bucket => bucket.count));
  const range = interval === "minute" && selectedHour ? periodLabel(selectedHour, "hour") : activity?.coverage.firstAt && activity.coverage.lastAt
    ? `${dayDate.format(new Date(activity.coverage.firstAt))}–${dayDate.format(new Date(activity.coverage.lastAt))}, 2026 · UTC` : "UTC";
  const complete = Boolean(activity?.complete && selected);
  const selectionKey = `${selectedBallot}/${interval}/${selectedHour}`;

  return <div className="coin-chart-stack">
    <div className="coin-shared-controls">
      <label><select aria-label="Activity proposal" value={selectedBallot ?? "all"} onChange={event => { onSelectBallot(event.target.value === "all" ? null : Number(event.target.value)); setHour(null); }}><option value="all">All {proposals.length} proposals</option>{proposals.map(proposal => <option key={proposal.ballot} value={proposal.ballot}>#{proposal.ballot} · {proposal.title}</option>)}</select></label>
      <Link className="coin-verify-link" href={selectedProposal ? proposalVerifyHref("q3-2026", selectedProposal.id) : "/coinholders/verify?round=q3-2026"}>{selectedProposal ? "Verify this proposal" : "Verify results"}<span aria-hidden="true"> ↗</span></Link>
    </div>
    <section className="coin-panel coin-activity coin-series--volume" aria-label="Cast volume">
      <header className="coin-series-heading"><div><span className="coin-chart-index">01</span><h2>Cast volume</h2><p>Recorded casts</p></div>{complete ? <div className="coin-series-metric"><strong>{countFormat.format(shownTotal)}</strong><span>Peak {countFormat.format(peakCount)} / {interval}</span></div> : null}</header>
      <CoinholderChartHelp chart="casts" />
      <div className="coin-cast-controls">
      <div className="coin-segmented" role="group" aria-label="Cast interval">{([['day', 'Daily'], ['hour', 'Hourly'], ['minute', 'Per minute']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={interval === value} onClick={() => setInterval(value)}>{label}</button>)}</div>
      {interval === "minute" && complete ? <label className="coin-hour-picker">Inspect hour <select aria-label="Inspect hour (UTC)" value={selectedHour ?? ""} onChange={event => setHour({ at: event.target.value, ballot: selectedBallot })}>{hours.map(bucket => <option key={bucket.at} value={bucket.at}>{chartDate.format(new Date(bucket.at))} UTC · {castCount(bucket.count)}</option>)}</select></label> : null}
      </div>
      {!complete ? <div className="coin-chart-empty"><strong>{activity ? "Activity index incomplete" : "Activity index unavailable"}</strong><p>{activity?.coverage.reason ?? "A complete activity index is required. Final results are available below."}</p></div> : buckets.length ? <figure className="coin-chart"><CastPlot key={selectionKey} buckets={buckets} interval={interval} total={shownTotal} /><figcaption><span>{range}</span></figcaption></figure> : <div className="coin-chart-empty">No indexed casts in this selection.</div>}
      {complete ? <details className="coin-chart-data"><summary>Chart data</summary><div className="coin-data-scroll" tabIndex={0} role="region" aria-label="Scrollable chart data"><table><caption>{interval === "day" ? "Daily" : interval === "hour" ? "Hourly" : "Per-minute"} encrypted cast activity. All times UTC.</caption><thead><tr><th scope="col">Period starts</th><th scope="col">Casts</th><th scope="col">Cumulative</th></tr></thead><tbody>{buckets.map(bucket => <tr key={bucket.at}><td>{chartDate.format(new Date(bucket.at))}</td><td>{countFormat.format(bucket.count)}</td><td>{countFormat.format(bucket.cumulative)}</td></tr>)}</tbody></table></div></details> : null}
    </section>
    <CoinholderRevealsChart history={revealHistory} selectedBallot={selectedBallot} />
    <CoinholderShareWeightChart proposals={proposals} history={revealHistory} selectedBallot={selectedBallot} onSelectBallot={onSelectBallot} />
    <CoinholderDecisionChart proposals={proposals} selectedBallot={selectedBallot} onSelectBallot={onSelectBallot} />
    <CoinholderHeatmap proposals={proposals} history={revealHistory} selectedBallot={selectedBallot} onSelectBallot={onSelectBallot} />
  </div>;
}
