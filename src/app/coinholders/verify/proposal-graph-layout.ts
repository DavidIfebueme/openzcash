/**
 * Keep a 13px SVG label inside its segment and clear of the reference strokes.
 * Move the baseline only, never the bar or either decision threshold. If a
 * narrow segment has no clear space, its full value remains in the tally table.
 */
export function segmentLabelY(top: number, bottom: number, lines: readonly number[]): number | null {
  const ascent = 12, descent = 4, edgeGap = 4, lineGap = 6;
  if (bottom - top < 27) return null;
  const min = top + ascent + edgeGap;
  const max = bottom - descent - edgeGap;
  const preferred = (top + bottom + ascent - descent) / 2;
  const clear = (baseline: number) => baseline >= min && baseline <= max
    && lines.every(line => baseline <= line - descent - lineGap || baseline >= line + ascent + lineGap);
  const candidates = [preferred, min, max, ...lines.flatMap(line => [line - descent - lineGap, line + ascent + lineGap])];
  return candidates.filter(clear).sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred))[0] ?? null;
}
