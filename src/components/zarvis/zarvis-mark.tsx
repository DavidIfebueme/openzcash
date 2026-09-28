"use client";
import { useId } from "react";
import { getImageProps } from "next/image";
import type { ZarvisExpression } from "@/lib/zarvis/types";

// The original reference sheet stays intact. SVG layers animate its eyes and
// greeting hand independently, using the same artwork for each moving part.
const { props: portrait } = getImageProps({
  src: "/zarvis/ironwood-reference.png", alt: "", width: 606, height: 649,
});
type Eye = [x: number, y: number, rx: number, ry: number];
type Frame = { box: [number, number, number, number]; eyes: [Eye, Eye] };
const happy: Frame = { box: [17, 620, 122, 133], eyes: [[56, 700, 14, 11], [94, 708, 13, 10]] };
const thoughtful: Frame = { box: [281, 620, 124, 133], eyes: [[329, 704, 14, 10], [366, 699, 12, 11]] };
const frames: Record<Exclude<ZarvisExpression, "comparing" | "uncertain" | "clarifying">, Frame> = {
  idle: happy,
  listening: { box: [147, 620, 124, 133], eyes: [[195, 699, 13, 15], [236, 706, 13, 15]] },
  thinking: thoughtful,
  explaining: { box: [542, 620, 124, 133], eyes: [[582, 711, 15, 10], [620, 708, 14, 10]] },
  error: thoughtful,
  greeting: { box: [25, 832, 136, 144], eyes: [[84, 900, 13, 10], [116, 908, 12, 10]] },
  pleased: happy,
  reading: thoughtful,
  exploring: thoughtful,
  protecting: happy,
};
const wavingHand = "M 31 891 Q 42 880 54 888 L 64 909 L 77 927 L 64 942 L 38 923 Q 25 910 31 891 Z";

export function ZarvisMark({ className = "", expression = "idle", animated = false, paused = false }: {
  className?: string;
  expression?: ZarvisExpression;
  animated?: boolean;
  paused?: boolean;
}) {
  const id = useId().replaceAll(":", "");
  const frame = frames[expression === "comparing" ? "explaining" : expression === "uncertain" ? "thinking" : expression === "clarifying" ? "listening" : expression];
  const [x, y, width, height] = frame.box;
  const pattern = `zarvis-art-${id}`;
  const mask = `zarvis-hand-${id}`;
  return <svg className={`zarvis-mark ${className}`} data-expression={expression}
    data-animated={animated} data-paused={paused} viewBox={frame.box.join(" ")}
    aria-hidden="true" focusable="false">
    <defs>
      <pattern id={pattern} width="1212" height="1297" patternUnits="userSpaceOnUse">
        <image href={portrait.src} width="1212" height="1297"/>
      </pattern>
      {expression === "greeting" ? <mask id={mask} maskUnits="userSpaceOnUse" x={x} y={y} width={width} height={height}>
        <rect x={x} y={y} width={width} height={height} fill="white"/>
        <path d={wavingHand} fill="black"/>
      </mask> : null}
    </defs>
    <g className="zarvis-character" key={expression}>
      <g className="zarvis-look">
        <rect x={x} y={y} width={width} height={height} fill={`url(#${pattern})`}
          mask={expression === "greeting" ? `url(#${mask})` : undefined}/>
        {expression === "greeting" ? <g className="zarvis-hand"><path d={wavingHand} fill={`url(#${pattern})`}/></g> : null}
        {animated ? frame.eyes.map(([cx, cy, rx, ry], index) => <g key={index}>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#090a07"/>
          <g className={`zarvis-eye zarvis-eye-${index}`}>
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${pattern})`}/>
          </g>
        </g>) : null}
      </g>
    </g>
  </svg>;
}
