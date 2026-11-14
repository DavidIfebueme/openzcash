/**
 * Geometry for the governance diagram: the official Zcash mark cut into equal
 * pieces that slide together. The path is the one in public/zcash-mark.svg
 * (a 1080-unit square, disc of radius 270 at the centre); a test keeps the
 * two in step. The cuts run straight up, down-right and down-left, which
 * keeps them clear of the diagonal of the Z and off the sides of its strokes.
 */
export const ZCASH_MARK_PATH =
  "m270,540c0-148.9,121.1-270,270-270s270,121.1,270,270-121.1,270-270,270-270-121.1-270-270Zm366.31-125.3v41.09l-114.28,155h114.28v54.5h-73.67v45.16h-45.28v-45.16h-73.67v-41.09l114.16-155h-114.16v-54.5h73.67v-45.28h45.28v45.28h73.67Z";

export const MARK_CENTER = 540;
export const MARK_RADIUS = 270;

/** Width of the gap between two pieces, in mark units. */
const SEAM = 8;
/** Radius of the thin arc drawn around each piece. */
const ORBIT = 326;
/** Degrees trimmed from each end of an arc, so arcs do not touch. */
const ARC_TRIM = 8;
/** How far a piece starts from its place. */
const APART = 70;
/** The first cut points straight up (SVG angles grow clockwise from +x). */
const FIRST_CUT = 270;

type Point = [number, number];

export interface MarkPiece {
  /** Direction of the middle of the piece, in degrees. */
  middle: number;
  /** Clip polygon, as SVG `points`. */
  wedge: string;
  /** Path of the arc around the piece. */
  arc: string;
  /** Where the arc meets its label. */
  dot: Point;
  label: { x: number; y: number; anchor: "start" | "middle" | "end" };
  /** Where the piece starts, relative to its place. */
  offset: Point;
}

const unit = (degrees: number): Point => [
  Math.cos((degrees * Math.PI) / 180),
  Math.sin((degrees * Math.PI) / 180),
];
const from = ([x, y]: Point, degrees: number, distance: number): Point => {
  const [ux, uy] = unit(degrees);
  return [x + distance * ux, y + distance * uy];
};
const round = (value: number): number => Math.round(value * 10) / 10;
const pair = ([x, y]: Point, separator: string): string =>
  `${round(x)}${separator}${round(y)}`;

export function markPieces(count = 3): MarkPiece[] {
  const centre: Point = [MARK_CENTER, MARK_CENTER];
  const sweep = 360 / count;
  // Moving the apex out along the middle leaves a seam of even width.
  const inset = SEAM / 2 / Math.sin((sweep / 2) * (Math.PI / 180));

  return Array.from({ length: count }, (_, index) => {
    const start = FIRST_CUT + index * sweep;
    const end = start + sweep;
    const middle = start + sweep / 2;

    const apex = from(centre, middle, inset);
    const wedge = [
      apex,
      from(apex, start, MARK_RADIUS * 2.2),
      from(apex, middle, MARK_RADIUS * 4.4),
      from(apex, end, MARK_RADIUS * 2.2),
    ]
      .map((point) => pair(point, ","))
      .join(" ");

    const arc = `M ${pair(from(centre, start + ARC_TRIM, ORBIT), " ")} A ${ORBIT} ${ORBIT} 0 0 1 ${pair(from(centre, end - ARC_TRIM, ORBIT), " ")}`;
    const dot = from(centre, middle, ORBIT);
    const side = Math.round(unit(middle)[0]);

    return {
      middle,
      wedge,
      arc,
      dot: [round(dot[0]), round(dot[1])],
      label:
        side === 0
          ? { x: MARK_CENTER, y: round(dot[1] + 58), anchor: "middle" }
          : {
              x: round(dot[0] + side * 30),
              y: round(dot[1] - 4),
              anchor: side > 0 ? "start" : "end",
            },
      offset: [round(unit(middle)[0] * APART), round(unit(middle)[1] * APART)],
    };
  });
}
