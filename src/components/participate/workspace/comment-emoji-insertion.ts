const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Textarea offsets and maxLength use UTF-16; preserve complete emoji clusters. */
export function insertCommentEmoji(value: string, emoji: string, start: number, end: number, maxLength: number): { value: string; caret: number } | null {
  if (!emoji || !Number.isFinite(maxLength) || maxLength < 0) return null;
  const clamp = (offset: number) => Math.max(0, Math.min(value.length, Number.isFinite(offset) ? Math.trunc(offset) : value.length));
  let from = Math.min(clamp(start), clamp(end));
  let to = Math.max(clamp(start), clamp(end));
  const collapsed = from === to;
  for (const { index, segment } of graphemes.segment(value)) {
    const next = index + segment.length;
    if (from > index && from < next) from = collapsed ? next : index;
    if (to > index && to < next) to = next;
  }
  const result = value.slice(0, from) + emoji + value.slice(to);
  if (result.length > Math.floor(maxLength)) return null;
  return { value: result, caret: from + emoji.length };
}
