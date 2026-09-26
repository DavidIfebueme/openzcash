"use client";
import { useId } from "react";
import { getImageProps } from "next/image";
import type { ZarvisExpression } from "@/lib/zarvis/types";

const { props: art } = getImageProps({ src: "/zarvis/ironwood-poses-v2.png", alt: "", width: 627, height: 627 });
type Eye = [number, number, number, number];
type Pose = { x: number; y: number; eyes: [Eye, Eye] };
const resting: Pose = { x: 0, y: 0, eyes: [[282, 282, 48, 34], [400, 313, 44, 34]] };
const thinking: Pose = { x: 0, y: 627, eyes: [[275, 252, 36, 40], [383, 296, 34, 40]] };
const poses: Record<ZarvisExpression, Pose> = {
  idle: resting,
  listening: resting,
  greeting: { x: 627, y: 0, eyes: [[228, 274, 48, 34], [345, 309, 44, 34]] },
  thinking,
  explaining: { x: 627, y: 627, eyes: [[209, 276, 44, 33], [324, 300, 44, 33]] },
  pleased: resting,
  error: thinking,
};
const hand = "M91 294C84 285 73 285 66 299L50 304C36 313 43 337 56 350L67 360L70 381C86 421 111 444 137 439L161 431C173 422 183 410 190 399L163 365L148 366L150 344C161 319 149 310 143 315L133 299C123 291 115 303 113 306L111 294C105 279 93 283 91 294Z";

/** Full-body, alpha-transparent artwork. Padding gives the limbs room to move. */
export function ZarvisFigure({ className = "", expression = "idle", animated = true, paused = false }: {
  className?: string;
  expression?: ZarvisExpression;
  animated?: boolean;
  paused?: boolean;
}) {
  const id = useId().replaceAll(":", "");
  const pose = poses[expression];
  const pattern = `zarvis-figure-art-${id}`;
  const mask = `zarvis-figure-arm-${id}`;
  return <svg className={`zarvis-mark zarvis-figure ${className}`} viewBox="-60 -36 747 710"
    data-expression={expression} data-animated={animated} data-paused={paused} aria-hidden="true" focusable="false">
    <defs>
      <pattern id={pattern} width="1254" height="1254" patternUnits="userSpaceOnUse">
        <image href={art.src} x={-pose.x} y={-pose.y} width="1254" height="1254"/>
      </pattern>
      {expression === "greeting" ? <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="627" height="627">
        <rect width="627" height="627" fill="white"/><path d={hand} fill="black"/>
      </mask> : null}
    </defs>
    <ellipse className="zarvis-ground" cx="325" cy="640" rx="138" ry="15"/>
    <g key={expression} className="zarvis-character">
      <g className="zarvis-look">
        <rect width="627" height="627" fill={`url(#${pattern})`} mask={expression === "greeting" ? `url(#${mask})` : undefined}/>
        {expression === "greeting" ? <g className="zarvis-hand"><path d={hand} fill={`url(#${pattern})`}/></g> : null}
        {animated ? pose.eyes.map(([cx, cy, rx, ry], index) => <g key={index}>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#080906"/>
          <g className={`zarvis-eye zarvis-eye-${index}`}><ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${pattern})`}/></g>
        </g>) : null}
      </g>
    </g>
  </svg>;
}
