"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useThemeColor } from "@/components/use-theme-color";
import { NetworkIcon } from "./network-icons";
import type { NetworkCore, NetworkSeries, NetworkSeriesPoint, NetworkMetric, NetworkPeriod, NetworkSnapshot } from "@/lib/network/types";
import { newBlockHashes } from "@/lib/network/updates";
import { AnimatedValue } from "./network-motion";
import { ExplorerPicker } from "./explorer-picker";
import { MiningPoolIdentity } from "./mining-pool-identity";
import s from "./network.module.css";

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const precise = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 });
const short = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const periodLabels: Record<NetworkPeriod, string> = { day: "24H", week: "7D", month: "30D" };
const periodNames: Record<NetworkPeriod, string> = { day: "24 hours", week: "7 days", month: "30 days" };
const poolColors: Record<string, string> = { ironwood: "var(--pool-ironwood)", orchard: "var(--pool-orchard)", sapling: "var(--pool-sapling)", sprout: "var(--pool-sprout)", transparent: "var(--pool-transparent)", lockbox: "var(--pool-lockbox)" };

function age(time: string | null | undefined, now: number) {
  if (!time) return "—";
  const seconds = Math.max(0, Math.floor((now - Date.parse(time)) / 1000));
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function bytes(value: number) { return value >= 1_000_000 ? `${decimal.format(value / 1_000_000)} MB` : `${decimal.format(value / 1000)} kB`; }
function pct(value: number) { return `${decimal.format(value)}%`; }
function clampPercent(value: number) { return Math.max(0, Math.min(100, value)); }
function dated(time: string) { return new Date(time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }); }
function poolColor(id: string) { return poolColors[id.toLowerCase()] ?? "var(--muted)"; }

function Card({ title, icon, className, children, action, id, motionPaused = false }: { title: string; icon: ReactNode; className: string; children: ReactNode; action?: ReactNode; id?: string; motionPaused?: boolean }) {
  return <section id={id} className={`${s.card} ${className}`} data-motion-paused={motionPaused} aria-label={title}><div className={s.cardHeader}><div className={s.cardTitle}><span className={s.cardIcon}>{icon}</span><h2>{title}</h2></div>{action}</div><div className={s.cardBody}>{children}</div></section>;
}

function External({ href, children, className = s.cardLink }: { href: string; children: ReactNode; className?: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className={className}>{children}<NetworkIcon name="external" /></a>;
}

function Empty({ loading, href = "https://zcashinfo.com/", message = "This data is temporarily unavailable." }: { loading: boolean; href?: string; message?: string }) {
  return <div className={s.empty}><span>{loading ? "Reading the network…" : message}</span>{!loading && <a href={href} target="_blank" rel="noreferrer" className={s.cardLink}>Check the source <NetworkIcon name="external" /></a>}</div>;
}

function Freshness({ fetchedAt, stale, now }: { fetchedAt: string; stale: boolean; now: number }) {
  return stale ? <span className={s.sectionState}>Delayed · {age(fetchedAt, now)}</span> : null;
}

const metricNames: Record<NetworkMetric, string> = { solrate: "Solrate", blockTime: "Block time", blocks: "Blocks · 24h" };

function NetworkChart({ history, metric, now }: { history: NetworkSeries; metric: NetworkMetric; now: number }) {
  const gradientId = useId().replaceAll(":", "");
  const [hovered, setHovered] = useState<number | null>(null);
  const [width, setWidth] = useState(600);
  const chartRef = useRef<SVGSVGElement>(null);
  const endpointRef = useRef<SVGCircleElement>(null);
  const previousEndpoint = useRef<string | null>(null);
  const lastPoint = history.points.find((point) => point.current) ?? history.points.at(-1)!;
  const endpointIdentity = `${lastPoint.time}:${lastPoint.value}`;
  useEffect(() => {
    const changed = previousEndpoint.current !== null && previousEndpoint.current !== endpointIdentity;
    previousEndpoint.current = endpointIdentity;
    if (!changed || history.stale || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = endpointRef.current?.animate([
      { opacity: .35, transform: "scale(2.5)" },
      { opacity: 1, transform: "scale(1)" },
    ], { duration: 850, easing: "ease-out" });
    return () => animation?.cancel();
  }, [endpointIdentity, history.stale]);
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))));
    observer.observe(chart);
    return () => observer.disconnect();
  }, []);
  const points = history.points;
  const values = points.flatMap((p) => p.value == null ? [] : [p.value]);
  const low = Math.min(...values) * .9;
  const high = Math.max(...values) * 1.06;
  const span = Math.max(high - low, 1);
  const left = 46, right = width - 10, top = 10, bottom = 91;
  const firstTime = Date.parse(points[0].time), lastTime = Date.parse(points.at(-1)!.time);
  const timeSpan = Math.max(lastTime - firstTime, 1);
  const x = (point: NetworkSeriesPoint) => left + (Date.parse(point.time) - firstTime) / timeSpan * (right - left);
  const y = (point: NetworkSeriesPoint) => bottom - ((point.value ?? low) - low) / span * (bottom - top);
  const segments: NetworkSeriesPoint[][] = [];
  let segment: NetworkSeriesPoint[] = [];
  for (const point of points) {
    if (point.value == null) { if (segment.length) segments.push(segment); segment = []; }
    else segment.push(point);
  }
  if (segment.length) segments.push(segment);
  const lineFor = (part: NetworkSeriesPoint[]) => part.map((point, index) => `${index === 0 ? "M" : "L"}${x(point)},${y(point)}`).join(" ");
  const selected = hovered === null ? lastPoint : points[Math.min(hovered, points.length - 1)];
  const valueLabel = (value: number | null) => value == null ? "—" : metric === "solrate" ? `${decimal.format(value)} GSol/s` : metric === "blockTime" ? `${decimal.format(value)} sec` : `${number.format(value)} blocks`;
  const timeLabel = (time: string) => new Date(time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  const selectedDate = selected.current ? "Latest" : `${timeLabel(selected.time)} UTC`;
  return <>
    <div className={s.chartSummary} aria-live="polite" aria-atomic="true"><strong>{valueLabel(selected.value)}</strong><small>{selectedDate} · {history.windowLabel}</small></div>
    <svg ref={chartRef} className={s.chart} viewBox={`0 0 ${width} 120`} role="img" tabIndex={0}
      aria-label={`${metricNames[metric]} history with ${points.length} data points. Latest ${valueLabel(lastPoint.value)}. Use left and right arrows to explore.`}
      onPointerMove={(event) => {
        const matrix = event.currentTarget.getScreenCTM();
        if (!matrix) return;
        const position = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()).x;
        let closest = 0;
        points.forEach((point, index) => { if (Math.abs(x(point) - position) < Math.abs(x(points[closest]) - position)) closest = index; });
        setHovered(closest);
      }} onPointerLeave={() => setHovered(null)} onBlur={() => setHovered(null)}
      onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); setHovered((previous) => Math.max(0, Math.min(points.length - 1, (previous ?? points.indexOf(lastPoint)) + (event.key === "ArrowLeft" ? -1 : 1)))); } }}>
      <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".2" /><stop offset="100%" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3].map((tick) => { const value = low + span * tick / 3; const at = bottom - (bottom - top) * tick / 3; return <g key={tick}><line className={s.chartGrid} x1={left} x2={right} y1={at} y2={at} /><text x="0" y={at + 3}>{short.format(value)}</text></g>; })}
      {segments.map((part) => <g key={part[0].time}><path d={`${lineFor(part)} L${x(part.at(-1)!)},${bottom} L${x(part[0])},${bottom} Z`} fill={`url(#${gradientId})`} /><path className={s.chartLine} d={lineFor(part)} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" /></g>)}
      {lastPoint.value != null && <circle ref={endpointRef} className={s.chartEndpoint} style={{ visibility: hovered === null ? "visible" : "hidden" }} cx={x(lastPoint)} cy={y(lastPoint)} r="4" fill="var(--accent)" />}
      {points.length < 12 && points.filter((point) => point.value != null).map((point) => <circle key={point.time} cx={x(point)} cy={y(point)} r="3" fill="var(--accent)" />)}
      {hovered !== null && <g><line x1={x(selected)} x2={x(selected)} y1={top} y2={bottom} stroke="var(--muted)" strokeDasharray="3 4" />{selected.value != null && <circle cx={x(selected)} cy={y(selected)} r="4" fill="var(--accent)" stroke="var(--panel)" strokeWidth="2" />}</g>}
      <text x={left} y="115">{new Date(points[0].time).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</text>
      <text x={right} y="115" textAnchor="end">{new Date(points.at(-1)!.time).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</text>
    </svg>
    <div className={s.caption}><span>{history.truncated ? "Limited coverage" : metric === "blockTime" ? "Observed block intervals" : "Daily samples + latest"}</span><span className={history.stale ? s.sectionState : undefined}>{history.observedAt ? `${history.stale ? "Last reading" : "Updated"} ${age(history.observedAt, now)}` : "Update time unavailable"}</span></div>
  </>;
}

function Stat({ label, children, note }: { label: string; children: ReactNode; note?: ReactNode }) {
  return <div className={s.stat}><span className={s.statLabel}>{label}</span><strong>{children}</strong>{note && <small>{note}</small>}</div>;
}

function PrivacyPools({ core, now }: { core: NetworkCore; now: number }) {
  const sorted = [...core.pools].sort((a, b) => Number(b.shielded) - Number(a.shielded) || b.zec - a.zec);
  return <>
    <div className={s.stats}>
      <Stat label="Shielded balance"><AnimatedValue value={core.shieldedZec} format={short} /><small> ZEC</small></Stat>
      <Stat label="Share of pool balances"><AnimatedValue value={core.shieldedPercent} /><small>%</small></Stat>
    </div>
    <div className={s.poolDistribution} role="img" aria-label={`${pct(core.shieldedPercent)} of reported pool balances are shielded`}>{sorted.map((pool) => <span key={pool.id} style={{ width: `${core.poolTotalZec > 0 ? pool.zec / core.poolTotalZec * 100 : 0}%`, background: poolColor(pool.id) }} title={`${pool.name}: ${number.format(pool.zec)} ZEC`} />)}</div>
    <div className={s.poolLegend}>{sorted.map((pool) => <div className={s.legendItem} key={pool.id}><span className={s.legendName}><span className={s.legendSwatch} style={{ background: poolColor(pool.id) }} />{pool.name}</span><strong title={`${precise.format(pool.zec)} ZEC`}>{short.format(pool.zec)} <small>ZEC</small></strong><span className={s.poolPercent}>{core.poolTotalZec > 0 ? pct(pool.zec / core.poolTotalZec * 100) : "—"}</span></div>)}</div>
    <Freshness fetchedAt={core.fetchedAt} stale={core.stale} now={now} />
  </>;
}

export function NetworkDashboard() {
  const [data, setData] = useState<NetworkSnapshot | null>(null);
  const [period, setPeriod] = useState<NetworkPeriod>("week");
  const [metric, setMetric] = useState<NetworkMetric>("solrate");
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const root = useRef<HTMLDivElement>(null);
  useThemeColor(root, theme);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [insightsExpanded, setInsightsExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [arrivals, setArrivals] = useState<string[]>([]);
  const previousCore = useRef<NetworkCore | null>(null);
  const arrivalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [now, setNow] = useState(0);
  const controller = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    try {
      const response = await fetch(`/api/network?period=${period}`, { signal: request.signal, cache: "no-store" });
      if (!response.ok) throw new Error("Network data unavailable");
      const snapshot = await response.json() as NetworkSnapshot;
      if (!request.signal.aborted) {
        const hashes = newBlockHashes(previousCore.current, snapshot.core);
        previousCore.current = snapshot.core;
        if (hashes.length) {
          setArrivals(hashes);
          if (arrivalTimer.current) clearTimeout(arrivalTimer.current);
          arrivalTimer.current = setTimeout(() => setArrivals([]), 4500);
        }
        setData(snapshot); setError(false);
      }
    } catch {
      if (!request.signal.aborted) { previousCore.current = null; setArrivals([]); setError(true); }
    } finally { if (!request.signal.aborted) setLoading(false); }
  }, [period]);

  useEffect(() => {
    // The external request updates state only when its asynchronous response arrives.
    void refresh();
    const interval = setInterval(() => { if (document.visibilityState === "visible") { setLoading(true); void refresh(); } }, 30_000);
    const visible = () => { if (document.visibilityState === "visible") { setLoading(true); void refresh(); } };
    document.addEventListener("visibilitychange", visible);
    return () => { clearInterval(interval); controller.current?.abort(); document.removeEventListener("visibilitychange", visible); };
  }, [refresh]);

  useEffect(() => {
    // Restoring a visitor's preference after hydration keeps the server output stable.
    /* eslint-disable react-hooks/set-state-in-effect */
    setNow(Date.now());
    try { if (localStorage.getItem("oz-theme") === "dark") setTheme("dark"); } catch { /* Storage is optional. */ }
    /* eslint-enable react-hooks/set-state-in-effect */
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => { clearInterval(timer); if (arrivalTimer.current) clearTimeout(arrivalTimer.current); };
  }, []);

  const core = data?.core;
  const activity = data?.activity;
  const current = activity?.current;
  const selectedSeries = activity?.[metric];
  const chartHistory = selectedSeries?.period === period ? selectedSeries : null;
  const blockTime = activity?.blockTime;
  const currentBlockTime = blockTime?.points.find((point) => point.current)?.value;
  const mining = data?.period === period ? data.mining : null;
  const mempool = data?.mempool;
  const clock = now;
  const old = !!core && clock - Date.parse(core.fetchedAt) > 120_000;
  const state = error || old ? (core ? "stale" : "unavailable") : data?.status ?? "loading";
  const stateLabels: Record<string, string> = { live: "Live", partial: "Partial data", stale: "Delayed", unavailable: "Unavailable", loading: "Connecting" };
  const emission = core?.emission;
  const namedPools = mining?.pools.filter((pool) => pool.name !== "Unknown") ?? [];
  const unknownPool = mining?.pools.find((pool) => pool.name === "Unknown");
  const miningPools = namedPools.slice(0, unknownPool ? 4 : 5);
  if (unknownPool) miningPools.push(unknownPool);
  const otherPools = namedPools.slice(unknownPool ? 4 : 5);
  if (otherPools.length) miningPools.push({ name: "Other pools", blocks: otherPools.reduce((sum, pool) => sum + pool.blocks, 0), sharePercent: otherPools.reduce((sum, pool) => sum + pool.sharePercent, 0) });
  const topTwo = mining?.pools.slice(0, 2).reduce((sum, pool) => sum + pool.sharePercent, 0);
  const averageBlockBytes = core && core.recentBlocks.length > 0
    ? core.recentBlocks.reduce((sum, block) => sum + block.sizeBytes, 0) / core.recentBlocks.length : null;
  const blockPace = core?.averageBlockSeconds != null && core.averageBlockSeconds > 0 && core.targetBlockSeconds > 0
    ? (core.targetBlockSeconds / core.averageBlockSeconds - 1) * 100 : null;
  const coreDelayed = !!core && (core.stale || old || error);
  const currentDelayed = !!current && (current.stale || error || now - Date.parse(current.fetchedAt) > 120_000);
  const blockTimeDelayed = !!blockTime && (blockTime.stale || error || now - Date.parse(blockTime.fetchedAt) > 120_000);

  const periods = <div className={s.periods} aria-label="History period">{(Object.keys(periodLabels) as NetworkPeriod[]).filter((p) => metric !== "blockTime" || p !== "month").map((p) => <button key={p} onClick={() => { if (p !== period) { setLoading(true); setPeriod(p); } }} aria-pressed={period === p} aria-label={`Show ${periodNames[p]} history`}>{periodLabels[p]}</button>)}</div>;

  return <div ref={root} className={s.root} data-theme={theme} data-motion-paused={error || old}>
    <header className={s.header}><div className={s.headerInner}>
      <div className={s.identity}>
        <Link href="/" className={s.brand} aria-label="OpenZcash home"><Image src="/zcash-mark.svg" alt="" width={32} height={32} className={s.brandMark} /><span>OpenZcash</span></Link>
        <span className={s.headerDivider} aria-hidden="true" />
        <h1 className={s.appName}>Zcash Network</h1>
      </div>
      <span className={s.mainnet}>Mainnet</span>
      <div className={s.headerRight}>
        <div className={s.toolbar}><span className={s.status} data-state={state} role="status"><span className={s.statusDot} />{stateLabels[state]}</span><span className={s.updated}>30s refresh</span><button className={s.refresh} disabled={loading} onClick={() => { setLoading(true); void refresh(); }} aria-label="Refresh network data" title="Refresh network data"><NetworkIcon name="refresh" className={loading ? s.spinning : undefined} /></button></div>
        <ExplorerPicker /><button className={s.iconButton} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} onClick={() => { const next = theme === "dark" ? "light" : "dark"; setTheme(next); try { localStorage.setItem("oz-theme", next); } catch { /* Storage is optional. */ } }}><NetworkIcon name={theme === "dark" ? "sun" : "moon"} /></button>
      </div>
    </div></header>

    <main className={s.main}>
      {(error || old || data?.status === "unavailable") && <p className={s.notice}>{core ? "Connection interrupted. Showing the last available data." : "Source unavailable. Retrying automatically."}</p>}
      {core && !core.synced && <p className={s.notice}>Catching up: block {number.format(core.indexedHeight)} of {number.format(core.chainTip)}.</p>}

      <div className={s.grid}>
        <Card id="blocks" title="Latest blocks" icon={<NetworkIcon name="blocks" />} className={s.blocks} motionPaused={core?.stale ?? false} action={<span className={s.arrivalLabel} role="status">{arrivals.length > 0 && <><span className={s.statusDot} />+{arrivals.length} new</>}</span>}>
          {core ? <>
            <div className={`${s.stats} ${s.blockStats}`}>
              <Stat label="Height"><AnimatedValue value={core.height} format={number} /></Stat>
              <Stat label="Mined"><time dateTime={core.lastBlockAt}>{age(core.lastBlockAt, clock)}</time></Stat>
            </div>
            <div className={s.tableWrap}><table className={s.table}><thead><tr><th scope="col">Height</th><th scope="col">Pool</th><th scope="col">Txs</th><th scope="col" className={s.feeColumn}>Fees · ZEC</th><th scope="col">Size</th><th scope="col">Age</th></tr></thead><tbody>{core.recentBlocks.slice(0, 5).map((block) => <tr key={block.hash} data-new={arrivals.includes(block.hash)}><td><a href={`https://zecblock.com/block/${block.height}`} target="_blank" rel="noopener noreferrer">{number.format(block.height)}</a></td><td><MiningPoolIdentity name={block.pool} /></td><td>{number.format(block.txCount)}</td><td className={s.feeColumn}>{block.feesZec === null ? "—" : precise.format(block.feesZec)}</td><td>{bytes(block.sizeBytes)}</td><td><time dateTime={block.time} title={new Date(block.time).toUTCString()}>{age(block.time, clock)}</time></td></tr>)}</tbody></table></div>
            <div className={s.panelFooter}><External href="https://zcashinfo.com/blocks">More blocks</External><Freshness fetchedAt={core.fetchedAt} stale={core.stale || old || error} now={clock} /></div>
          </> : <Empty loading={loading} />}
        </Card>

        <Card title="Network" icon={<NetworkIcon name="network" />} className={s.activity} action={periods}>
          {current || blockTime ? <div className={s.networkSnapshot} data-motion-paused={currentDelayed || blockTimeDelayed}>
            <div className={`${s.stats} ${s.networkStats}`}>
              <Stat label="Difficulty · latest">{current ? <AnimatedValue value={current.difficulty} format={short} /> : "—"}</Stat>
              <Stat label="Block time · s">{currentBlockTime != null ? <AnimatedValue value={currentBlockTime} /> : "—"}</Stat>
              <Stat label="Txs / block">{current?.averageTxsPerBlock != null ? <AnimatedValue value={current.averageTxsPerBlock} /> : "—"}</Stat>
            </div>
            <div className={s.caption}><span>Txs: 24h · {blockTime?.windowLabel ?? "Block time unavailable"}</span>{(currentDelayed || blockTimeDelayed) && <span className={s.sectionState}>Last available reading</span>}</div>
          </div> : <Empty loading={loading} href="https://zecblock.com/network" />}
          <div className={s.chartTabs} aria-label="Chart metric">{(Object.keys(metricNames) as NetworkMetric[]).map((key) => <button key={key} aria-pressed={key === metric} onClick={() => { setMetric(key); if (key === "blockTime" && period === "month") { setLoading(true); setPeriod("week"); } }}>{metricNames[key]}</button>)}</div>
          {chartHistory && chartHistory.points.filter((point) => point.value != null).length >= 1 ? <NetworkChart key={`${chartHistory.source.name}-${period}-${metric}`} history={{ ...chartHistory, stale: chartHistory.stale || error || now - Date.parse(chartHistory.fetchedAt) > 120_000 }} metric={metric} now={clock} /> : <Empty loading={loading} href="https://zecblock.com/network" />}
        </Card>

        <Card id="privacy" title="Privacy" icon={<NetworkIcon name="privacy" />} className={s.privacy} motionPaused={core?.stale ?? false} action={<External href="https://zcashinfo.com/#value-pool-distribution">Pools</External>}>
          {core ? <PrivacyPools core={{ ...core, stale: core.stale || old || error }} now={clock} /> : <Empty loading={loading} />}
        </Card>

        <Card title="Mempool & fees" icon={<NetworkIcon name="mempool" />} className={s.mempool} motionPaused={mempool?.stale ?? false} action={mempool ? <span className={s.sectionMeta}>{age(mempool.fetchedAt, clock)}{mempool.stale || error ? " · delayed" : ""}</span> : undefined}>
          {mempool ? <><div className={s.stats}>
            <Stat label="Pending transactions"><AnimatedValue value={mempool.count} format={number} /></Stat>
            <Stat label="Total size">{bytes(mempool.bytes)}</Stat>
          </div><div className={s.feeStat}><Stat label={`Average fees / block · ${core?.sampleBlocks ?? 100} blocks`}>{core?.averageFeesZecPerBlock != null ? precise.format(core.averageFeesZecPerBlock) : "—"}<small> ZEC</small></Stat></div><div className={s.panelFooter}><span className={s.queueState} data-clear={mempool.count === 0}><span className={s.statusDot} />{mempool.count === 0 ? "No pending transactions reported" : "Awaiting confirmation"}</span>{core && <Freshness fetchedAt={core.fetchedAt} stale={core.stale || old || error} now={clock} />}</div></> : <Empty loading={loading} />}
        </Card>

        <Card id="mining" title="Mining pools" icon={<NetworkIcon name="mining" />} className={s.mining} motionPaused={mining?.stale ?? false} action={<span className={s.sectionMeta}>{periodLabels[period]} · block share</span>}>
          {mining ? <><div className={s.poolBarList}>{miningPools.map((pool, index) => <div className={s.poolBarRow} key={pool.name}><MiningPoolIdentity name={pool.name} /><div className={s.track}><span style={{ width: `${clampPercent(pool.sharePercent)}%`, background: index < 2 ? "var(--accent)" : "var(--dim)" }} /></div><strong>{pct(pool.sharePercent)}</strong></div>)}</div><div className={s.panelFooter}><span className={s.sectionMeta}>{number.format(mining.totalBlocks)} blocks</span><span className={s.sectionMeta}>Top 2 · {topTwo != null ? pct(topTwo) : "—"}</span></div><Freshness fetchedAt={mining.fetchedAt} stale={mining.stale || error} now={clock} /></> : <Empty loading={loading} href="https://zcashinfo.com/pools" />}
        </Card>

        <Card title="Supply & emission" icon={<NetworkIcon name="supply" />} className={s.supply} motionPaused={core?.stale ?? false}>
          {core ? <>
            <Stat label="Reported on-chain supply"><AnimatedValue value={core.totalSupplyZec} format={number} /><small> ZEC</small></Stat>
            <div className={s.supplyProgress}><div className={s.track}><span style={{ width: `${clampPercent(core.totalSupplyZec / 21_000_000 * 100)}%`, background: "var(--accent)" }} /></div><div className={s.caption}><span>{pct(core.totalSupplyZec / 21_000_000 * 100)} issued</span><span>21M ZEC maximum</span></div></div>
            <dl className={s.detailRows}>
              <div><dt>Block subsidy</dt><dd>{emission?.blockSubsidyZec != null ? `${precise.format(emission.blockSubsidyZec)} ZEC` : "—"}</dd></div>
              <div><dt>Miner subsidy</dt><dd>{emission?.minerSubsidyZec != null ? `${precise.format(emission.minerSubsidyZec)} ZEC` : "—"}</dd></div>
              <div><dt>Daily issuance · target</dt><dd>{emission?.blockSubsidyZec != null ? `${number.format(emission.blockSubsidyZec * 86400 / core.targetBlockSeconds)} ZEC` : "—"}</dd></div>
              <div><dt>To miners / day · target</dt><dd>{emission?.minerSubsidyZec != null ? `${number.format(emission.minerSubsidyZec * 86400 / core.targetBlockSeconds)} ZEC` : "—"}</dd></div>
            </dl><Freshness fetchedAt={core.fetchedAt} stale={core.stale || old || error} now={clock} />
          </> : <Empty loading={loading} />}
        </Card>

        <Card title="Next halving" icon={<NetworkIcon name="halving" />} className={s.halving} motionPaused={core?.stale ?? false}>
          {core ? <>
            <Stat label="Blocks remaining">{emission?.blocksRemaining != null ? <AnimatedValue value={emission.blocksRemaining} format={number} /> : "—"}</Stat>
            <div className={s.supplyProgress}><div className={s.track}><span style={{ width: `${clampPercent(emission?.eraProgressPercent ?? 0)}%`, background: "var(--accent)" }} /></div><div className={s.caption}><span>Current era</span><span>{emission?.eraProgressPercent != null ? pct(emission.eraProgressPercent) : "—"}</span></div></div>
            <dl className={s.detailRows}>
              <div><dt>Estimated date</dt><dd>{emission?.estimatedHalvingAt ? dated(emission.estimatedHalvingAt) : "—"}</dd></div>
              <div><dt>Halving height</dt><dd>{emission?.nextHalvingHeight != null ? number.format(emission.nextHalvingHeight) : "—"}</dd></div>
              <div><dt>Next block subsidy</dt><dd>{emission?.nextBlockSubsidyZec != null ? `${precise.format(emission.nextBlockSubsidyZec)} ZEC` : "—"}</dd></div>
            </dl><Freshness fetchedAt={core.fetchedAt} stale={core.stale || old || error} now={clock} />
          </> : <Empty loading={loading} />}
        </Card>
      </div>

      <section id="network-insights" className={s.insights} data-expanded={insightsExpanded} aria-label="Network insights">
        <div className={s.insight} data-motion-paused={coreDelayed}>
          <div className={s.insightHeading}><NetworkIcon name="activity" /><h3>Transactions sampled</h3></div>
          <strong>{core ? <AnimatedValue value={Math.round(core.averageTxsPerBlock * core.sampleBlocks)} format={number} /> : "—"}</strong><small>{core ? `${core.sampleBlocks} blocks · includes coinbase${coreDelayed ? " · delayed" : ""}` : "Awaiting source"}</small>
        </div>
        <div className={s.insight} data-motion-paused={coreDelayed}>
          <div className={s.insightHeading}><NetworkIcon name="blocks" /><h3>Average block size</h3></div>
          <strong>{averageBlockBytes != null ? bytes(averageBlockBytes) : "—"}</strong><small>{core ? `${core.recentBlocks.length} recent blocks${coreDelayed ? " · delayed" : ""}` : "Awaiting source"}</small>
        </div>
        <div className={s.insight} data-motion-paused={coreDelayed}>
          <div className={s.insightHeading}><NetworkIcon name="mining" /><h3>Block pace</h3></div>
          <strong>{blockPace != null ? <>{pct(Math.abs(blockPace))}<span className={s.insightUnit}>{blockPace > 0 ? " faster" : blockPace < 0 ? " slower" : " · on target"}</span></> : "—"}</strong><small>{core ? `${core.sampleBlocks} blocks · ${core.targetBlockSeconds}s target${coreDelayed ? " · delayed" : ""}` : "Awaiting source"}</small>
        </div>
        <div className={s.insight} data-motion-paused={currentDelayed}>
          <div className={s.insightHeading}><NetworkIcon name="network" /><h3>Blocks · last 24h</h3></div>
          <strong>{current ? <AnimatedValue value={current.blocks24h} format={number} /> : "—"}</strong><small>{current ? currentDelayed ? "Last available reading" : "Rolling 24h window" : "Awaiting source"}</small>
        </div>
      </section>

      <footer className={s.footer}>
        <div className={s.footerTop}>
          <div className={s.sourceLink}><NetworkIcon name="globe" /><span>Public network data</span></div>
          <div className={s.footerActions}>
            <button className={s.insightsToggle} aria-expanded={insightsExpanded} aria-controls="network-insights" onClick={() => setInsightsExpanded(!insightsExpanded)}><NetworkIcon name="activity" />{insightsExpanded ? "Less insights" : "More insights"}<NetworkIcon name="chevron" /></button>
            <button aria-expanded={notesExpanded} aria-controls="data-notes" onClick={() => setNotesExpanded(!notesExpanded)}>Data notes<NetworkIcon name="chevron" /></button>
          </div>
        </div>
      <div className={s.dataNotes} id="data-notes" hidden={!notesExpanded}>
        <p><strong>Freshness.</strong> Readings refresh every 30 seconds. See the <a href="https://zecblock.com/docs" target="_blank" rel="noreferrer">network API</a> and <a href="https://api.zcashinfo.com/docs" target="_blank" rel="noreferrer">chain data API</a> for source documentation. Source observation times are preserved when a request fails. Upstream caches can add a few minutes.</p>
        <p><strong>Network.</strong> Solrate estimates work over a full rolling 24-hour window. The chart ends at the latest available estimate. Earlier solrate and block-count samples end at midnight UTC; gaps remain missing. Transactions per block use the same 24h count and include coinbase. Difficulty is current; block time averages 120 intervals and has up to 7 days of history.</p>
        <p><strong>Privacy.</strong> Shielded share uses all reported pool balances, including Lockbox. It measures ZEC holdings, not people or private transactions.</p>
        <p><strong>Mining.</strong> Distribution is the share of sampled blocks. Pool attribution is inferred by the explorer; unknown miners may share a group.</p>
        <p><strong>Supply.</strong> Reported on-chain supply differs from market circulating supply. Miner subsidy excludes fees. Halving estimates use the current block target and schedule.</p>
        <p><strong>Fees & mempool.</strong> Fees average the latest {core?.sampleBlocks ?? 100} blocks. Pending transactions reflect the explorer’s mempool view.</p>
        <p><strong>Insights.</strong> Transaction counts use the full block sample; average block size uses the recent blocks returned by the source. Each window is shown below its reading. Block pace compares observed block frequency with the source&apos;s target. Blocks in the last 24 hours use a full rolling window.</p>
      </div>
      </footer>
    </main>
  </div>;
}
