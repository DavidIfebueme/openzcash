"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const coinholderPlot = { viewWidth: 872, viewHeight: 252, left: 46, top: 16, width: 802, height: 190 };
const numbers = new Intl.NumberFormat("en-US");

type ChartGeometry = { width: number; scaleX: number; scaleY: number; offsetX: number; offsetY: number; svgLeft: number };
type ChartBounds = Pick<DOMRect, "width" | "height" | "left" | "top">;

/** Integer counts use readable 1/2/2.5/5 steps, never fractional count labels. */
export function coinholderCountScale(peak: number, intervals = 5) {
  if (!Number.isFinite(peak) || peak < 0) throw new Error("Invalid count scale");
  const target = Math.max(1, peak / Math.max(1, Math.floor(intervals)));
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const step = [1, 2, 2.5, 5, 10].map(value => value * magnitude).find(value => Number.isInteger(value) && value >= target)!;
  const max = Math.max(step, Math.ceil(peak / step) * step);
  return { max, ticks: Array.from({ length: Math.round(max / step) + 1 }, (_, index) => index * step) };
}

export function coinholderAxisIndices(length: number, width = coinholderPlot.width) {
  if (length <= 0) return [];
  const count = Math.min(length, 5, Math.max(2, Math.floor(width / 70) + 1));
  if (count === 1) return [0];
  return [...new Set(Array.from({ length: count }, (_, index) => Math.round(index * (length - 1) / (count - 1))))];
}

/** Independent axes let narrow charts keep their height without SVG letterboxing. */
export function coinholderChartGeometry(bounds: ChartBounds, wrapper?: ChartBounds): ChartGeometry | null {
  if (!bounds.width || !bounds.height) return null;
  return {
    width: wrapper?.width || bounds.width,
    scaleX: bounds.width / coinholderPlot.viewWidth,
    scaleY: bounds.height / coinholderPlot.viewHeight,
    svgLeft: bounds.left,
    offsetX: wrapper?.width ? bounds.left - wrapper.left : 0,
    offsetY: wrapper?.height ? bounds.top - wrapper.top : 0,
  };
}

export function coinholderPointerX(clientX: number, geometry: ChartGeometry) {
  return (clientX - geometry.svgLeft) / geometry.scaleX;
}

/** Measure the stretched SVG transform, including the wrapper's mobile gutter. */
export function useCoinholderChartGeometry() {
  const svg = useRef<SVGSVGElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<ChartGeometry | null>(null);
  const measure = useCallback(() => {
    const bounds = svg.current?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return null;
    const wrapper = container.current?.getBoundingClientRect();
    const measured = coinholderChartGeometry(bounds, wrapper)!;
    setGeometry(previous => previous && Object.keys(measured).every(key => previous[key as keyof ChartGeometry] === measured[key as keyof ChartGeometry]) ? previous : measured);
    return measured;
  }, []);
  useEffect(() => {
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (svg.current) observer?.observe(svg.current);
    if (container.current) observer?.observe(container.current);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [measure]);
  return { svg, container, geometry, measure };
}

export function coinholderAxisIntervals(geometry: ChartGeometry | null) {
  return geometry ? Math.max(1, Math.min(5, Math.floor(coinholderPlot.height * geometry.scaleY / 24))) : 5;
}

export function coinholderTooltipPercent(x: number, geometry: ChartGeometry | null) {
  return geometry ? (geometry.offsetX + x * geometry.scaleX) / geometry.width * 100 : x / coinholderPlot.viewWidth * 100;
}

/** HTML labels retain their actual font size instead of shrinking with the SVG viewBox. */
export function CoinholderChartAxes({ geometry, ticks, max, labels }: {
  geometry: ChartGeometry | null;
  ticks: number[];
  max: number;
  labels: { x: number; label: string; detail?: string }[];
}) {
  const plot = coinholderPlot;
  return <div className="coin-axis-overlay" aria-hidden="true">
    {ticks.map(value => {
      const y = plot.top + plot.height - value / max * plot.height;
      return <span className="coin-axis-y" key={value} style={{
        left: geometry ? geometry.offsetX + plot.left * geometry.scaleX - 8 : `calc(${plot.left / plot.viewWidth * 100}% - 8px)`,
        top: geometry ? geometry.offsetY + y * geometry.scaleY : `${y / plot.viewHeight * 100}%`,
      }}>{numbers.format(value)}</span>;
    })}
    {labels.map(({ x, label, detail }, index) => <span className="coin-axis-x" key={index} data-axis-x={x} style={{
      left: geometry ? geometry.offsetX + x * geometry.scaleX : `${x / plot.viewWidth * 100}%`,
      top: geometry ? geometry.offsetY + (plot.top + plot.height) * geometry.scaleY + 12 : `calc(${(plot.top + plot.height) / plot.viewHeight * 100}% + 12px)`,
    }}>{label}{detail ? <span className="coin-axis-x-detail">{detail}</span> : null}</span>)}
  </div>;
}
