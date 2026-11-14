import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MARK_CENTER,
  MARK_RADIUS,
  ZCASH_MARK_PATH,
  markPieces,
} from "./mark-pieces";

type Point = [number, number];

const polygon = (points: string): Point[] =>
  points.split(" ").map((pair) => pair.split(",").map(Number) as Point);

/** Ray casting: is the point inside the polygon? */
function inside([x, y]: Point, shape: Point[]): boolean {
  let hit = false;
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
    const [xi, yi] = shape[i];
    const [xj, yj] = shape[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      hit = !hit;
  }
  return hit;
}

const onRing = (degrees: number, radius: number): Point => [
  MARK_CENTER + radius * Math.cos((degrees * Math.PI) / 180),
  MARK_CENTER + radius * Math.sin((degrees * Math.PI) / 180),
];

describe("the Zcash mark in three pieces", () => {
  const pieces = markPieces();

  it("uses the official mark as published in the repository", () => {
    const file = readFileSync("public/zcash-mark.svg", "utf8");
    expect(file).toContain(`d="${ZCASH_MARK_PATH}"`);
  });

  it("cuts the mark into three equal pieces", () => {
    expect(pieces).toHaveLength(3);
    expect(pieces.map((piece) => piece.middle)).toEqual([330, 450, 570]);
  });

  it("keeps the cuts off the vertical strokes' sides and the diagonal", () => {
    // Cuts run straight up, down-right and down-left.
    expect(pieces.map((piece) => piece.middle - 60)).toEqual([270, 390, 510]);
  });

  it("gives each piece its own part of the disc and nothing else", () => {
    pieces.forEach((piece, index) => {
      const shape = polygon(piece.wedge);
      expect(inside(onRing(piece.middle, MARK_RADIUS * 0.8), shape)).toBe(true);
      pieces.forEach((other, otherIndex) => {
        if (otherIndex === index) return;
        expect(inside(onRing(other.middle, MARK_RADIUS * 0.8), shape)).toBe(
          false,
        );
      });
    });
  });

  it("leaves a seam between neighbours", () => {
    // A point exactly on a cut line belongs to no piece.
    const onCut = onRing(270, MARK_RADIUS * 0.9);
    expect(pieces.some((piece) => inside(onCut, polygon(piece.wedge)))).toBe(
      false,
    );
  });

  it("starts each piece apart, along its own direction", () => {
    for (const piece of pieces) {
      const [dx, dy] = piece.offset;
      const direction = (Math.atan2(dy, dx) * 180) / Math.PI;
      expect(((direction % 360) + 360) % 360).toBeCloseTo(
        piece.middle % 360,
        0,
      );
      expect(Math.hypot(dx, dy)).toBeGreaterThan(40);
    }
  });

  it("places the labels outside the disc, on the side of their piece", () => {
    expect(pieces.map((piece) => piece.label.anchor)).toEqual([
      "start",
      "middle",
      "end",
    ]);
    for (const piece of pieces) {
      const distance = Math.hypot(
        piece.label.x - MARK_CENTER,
        piece.label.y - MARK_CENTER,
      );
      expect(distance).toBeGreaterThan(MARK_RADIUS);
    }
  });
});
