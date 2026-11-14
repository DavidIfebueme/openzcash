"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { ZCASH_MARK_PATH, markPieces } from "@/lib/governance/mark-pieces";
import { PIECES } from "@/lib/governance/process";
import styles from "./views.module.css";

const SHAPES = markPieces(PIECES.length);
/** Seconds before the first piece moves, and between one piece and the next. */
const FIRST_DELAY = 0.15;
const STAGGER = 0.32;

/**
 * The Zcash mark as three pieces that slide together: community,
 * organizations and the network. Pressing the diagram plays it again.
 */
export function ZcashPieces() {
  const [run, setRun] = useState(0);
  const summary = PIECES.map((piece) => `${piece.name} ${piece.verb}`).join(
    ", ",
  );

  return (
    <button
      type="button"
      className={styles.replay}
      aria-label={`The Zcash mark in three pieces that meet: ${summary}. Play again`}
      onClick={() => setRun((current) => current + 1)}
    >
      <svg
        key={run}
        className={styles.diagram}
        viewBox="-70 180 1220 830"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {SHAPES.map((shape, index) => (
            <clipPath
              key={shape.middle}
              id={`zcash-piece-${index}`}
              clipPathUnits="userSpaceOnUse"
            >
              <polygon points={shape.wedge} />
            </clipPath>
          ))}
        </defs>
        {SHAPES.map((shape, index) => {
          const piece = PIECES[index];
          const motion = {
            "--dx": `${shape.offset[0]}px`,
            "--dy": `${shape.offset[1]}px`,
            animationDelay: `${FIRST_DELAY + index * STAGGER}s`,
          } as CSSProperties;
          return (
            <g key={piece.id} className={styles.piece} style={motion}>
              <path
                className={styles.mark}
                fillRule="evenodd"
                clipPath={`url(#zcash-piece-${index})`}
                d={ZCASH_MARK_PATH}
              />
              <path className={styles.orbit} d={shape.arc} />
              <circle
                className={styles.dot}
                cx={shape.dot[0]}
                cy={shape.dot[1]}
                r={7}
              />
              <text
                className={styles.name}
                x={shape.label.x}
                y={shape.label.y}
                textAnchor={shape.label.anchor}
              >
                {piece.name}
              </text>
              <text
                className={styles.verb}
                x={shape.label.x}
                y={shape.label.y + 36}
                textAnchor={shape.label.anchor}
              >
                {piece.verb}
              </text>
            </g>
          );
        })}
      </svg>
    </button>
  );
}
