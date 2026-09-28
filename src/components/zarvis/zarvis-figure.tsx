"use client";
import { memo, useId, type CSSProperties } from "react";
import { getImageProps } from "next/image";
import type { ZarvisExpression } from "@/lib/zarvis/types";

const original = getImageProps({ src: "/zarvis/ironwood-poses-v2.png", alt: "", width: 627, height: 627 }).props.src;
const actions = getImageProps({ src: "/zarvis/ironwood-actions-v3.png", alt: "", width: 627, height: 627 }).props.src;
type Eye = [number, number, number, number];
type Pose = {
  art: string; x: number; y: number; eyes: [Eye, Eye]; head: string;
  foreground?: string; arm?: string; pivot?: string;
};
const head = "M80 0H580V292Q570 375 486 397Q325 410 194 356L91 298Z";
const wave = "M91 294C84 285 73 285 66 299L50 304C36 313 43 337 56 350L67 360L70 381C86 421 111 444 137 439L161 431C173 422 183 410 190 399L163 365L148 366L150 344C161 319 149 310 143 315L133 299C123 291 115 303 113 306L111 294C105 279 93 283 91 294Z";
const poses = {
  resting: { art: original, x: 0, y: 0, eyes: [[282, 282, 48, 34], [400, 313, 44, 34]], head },
  greeting: { art: original, x: 627, y: 0, eyes: [[228, 274, 48, 34], [345, 309, 44, 34]], head: "M20 0H555V285Q550 369 472 400Q312 416 154 352L69 292Z", arm: wave, pivot: "175px 404px" },
  thinking: { art: original, x: 0, y: 627, eyes: [[275, 252, 36, 40], [383, 296, 34, 40]], head: "M80 0H580V300Q558 365 480 379Q343 390 208 334L91 288Z", foreground: "M225 352Q269 312 325 336L370 420L290 466L206 401Z" },
  explaining: { art: original, x: 627, y: 627, eyes: [[209, 276, 44, 33], [324, 300, 44, 33]], head: "M25 0H545V274Q520 361 460 378Q280 390 115 329L59 278Z", arm: "M377 416Q408 433 436 409L465 402Q497 393 508 376L493 365L483 366L487 355L477 345L466 351L465 335Q452 324 445 339L432 355L411 365L391 370Z", pivot: "390px 417px" },
  reading: { art: actions, x: 0, y: 0, eyes: [[285, 291, 39, 40], [404, 315, 34, 37]], head, foreground: "M251 363L372 389L472 361L498 490L365 524L243 484Z" },
  exploring: { art: actions, x: 627, y: 0, eyes: [[237, 286, 38, 40], [352, 313, 35, 39]], head: "M20 0H560V289Q533 370 468 392Q294 405 137 339L58 279Z", foreground: "M451 279Q522 270 529 332L492 444L438 471L402 414L436 373Q394 326 451 279Z" },
  protecting: { art: actions, x: 0, y: 627, eyes: [[294, 261, 47, 34], [411, 284, 45, 34]], head: "M80 0H580V292Q550 365 489 383Q330 392 204 338L90 286Z", foreground: "M340 338L434 309L506 352L488 447L433 518L359 453Z" },
  celebrating: { art: actions, x: 627, y: 627, eyes: [[237, 260, 49, 34], [354, 296, 47, 33]], head: "M20 0H568V286Q542 373 468 393Q296 405 139 344L61 286Z", arm: "M84 269Q128 257 139 296L152 315L187 355L166 395Q111 406 81 366L58 319Q59 283 84 269Z", pivot: "177px 380px" },
} satisfies Record<string, Pose>;
type PoseName = keyof typeof poses;
const selectedPose: Record<ZarvisExpression, PoseName> = {
  idle: "resting", listening: "resting", greeting: "greeting", thinking: "thinking",
  explaining: "explaining", reading: "reading", exploring: "exploring", protecting: "protecting",
  pleased: "celebrating", error: "thinking", comparing: "explaining", uncertain: "thinking", clarifying: "exploring",
};

/** Stable layers preserve motion and blend poses without remounting the character. */
export const ZarvisFigure = memo(function ZarvisFigure({ className = "", expression = "idle", animated = true, paused = false, settled = false }: {
  className?: string; expression?: ZarvisExpression; animated?: boolean; paused?: boolean; settled?: boolean;
}) {
  const id = useId().replaceAll(":", "");
  return <svg className={`zarvis-mark zarvis-figure ${className}`} viewBox="-60 -36 747 710"
    data-expression={expression} data-animated={animated} data-paused={paused} data-settled={settled} aria-hidden="true" focusable="false">
    <defs>{Object.entries(poses).map(([name, definition]) => {
      const pose: Pose = definition;
      const prefix = `zarvis-${id}-${name}`;
      return <g key={name}>
        <pattern id={`${prefix}-art`} width="1254" height="1254" patternUnits="userSpaceOnUse"><image href={pose.art} x={-pose.x} y={-pose.y} width="1254" height="1254"/></pattern>
        <mask id={`${prefix}-body`} maskUnits="userSpaceOnUse" x="0" y="0" width="627" height="627">
          <rect width="627" height="627" fill="white"/><path d={pose.head} fill="black"/>
          {pose.foreground ? <path d={pose.foreground} fill="white"/> : null}
          {pose.arm ? <path d={pose.arm} fill="black"/> : null}
        </mask>
        <mask id={`${prefix}-head`} maskUnits="userSpaceOnUse" x="0" y="0" width="627" height="627">
          <rect width="627" height="627" fill="black"/><path d={pose.head} fill="white"/>
          {pose.foreground ? <path d={pose.foreground} fill="black"/> : null}
          {pose.arm ? <path d={pose.arm} fill="black"/> : null}
        </mask>
      </g>;
    })}</defs>
    <ellipse className="zarvis-ground" cx="325" cy="637" rx="132" ry="12"/>
    <g className="zarvis-character zarvis-rig">
      {Object.entries(poses).map(([name, definition], index) => {
        const pose: Pose = definition;
        const prefix = `zarvis-${id}-${name}`;
        const fill = `url(#${prefix}-art)`;
        return <g key={name} className="zarvis-pose" data-pose={name} data-visible={selectedPose[expression] === name}
          style={{ "--zarvis-blink-phase": `${-index * .43}s` } as CSSProperties}>
          <rect width="627" height="627" fill={fill} mask={`url(#${prefix}-body)`}/>
          <g className="zarvis-rig-head">
            <g className="zarvis-rig-gaze">
              <rect width="627" height="627" fill={fill} mask={`url(#${prefix}-head)`}/>
              {pose.eyes.map(([cx, cy, rx, ry], eye) => <g key={eye}>
                <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#080906"/>
                <g className={`zarvis-eye zarvis-eye-${eye}`}><ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={fill}/></g>
              </g>)}
            </g>
          </g>
          {pose.arm ? <g className="zarvis-rig-arm" style={{ transformOrigin: pose.pivot }}><path d={pose.arm} fill={fill}/></g> : null}
        </g>;
      })}
    </g>
  </svg>;
});
