import type { CSSProperties } from "react";
import { CARD_SIZE } from "@/lib/seo/card-params";

/**
 * Typesetting for the share card, kept apart from the JSX so it can be tested
 * without rendering. Keep the title on ordinary wrapping: Satori's balance
 * pass can shrink a single-glyph title below that glyph's width, causing its
 * break-word loop to stop making progress and block the server event loop.
 * Word breaking remains enabled so long tokens stay inside the card.
 */

export const GUTTER = 72;
export const CONTENT_WIDTH = CARD_SIZE.width - 2 * GUTTER;

/** Line height of the title, in ems. */
export const TITLE_LEADING = 1.08;
/** Titles never take more than three lines; the character cap fits in three at the smallest size. */
export const TITLE_MAX_LINES = 3;

export const BAND_HEIGHT = 116;
/** Breathing room above the title area. */
export const BODY_TOP = 32;
export const BODY_BOTTOM = 28;
export const ACCENT = { height: 4, gap: 26 } as const;
/** The footer carries the domain and an optional figure or round label. */
export const FOOTER_HEIGHT = 96;

/** Vertical rhythm of the body, shared with the card so the title budget matches what is drawn. */
export const BODY = {
  /** Height left under the band, after the top offset and a bottom margin. */
  height: CARD_SIZE.height - BAND_HEIGHT - BODY_TOP - BODY_BOTTOM - ACCENT.height - ACCENT.gap - FOOTER_HEIGHT,
  kicker: { fontSize: 30, leading: 1.35, gap: 24, lines: 2 },
  stat: { fontSize: 26, leading: 1.2 },
} as const;

/** Average advance of Inter Medium at the title's tracking, in ems. */
const TITLE_EM = 0.56;
/** Average advance of Inter Regular, in ems. */
const KICKER_EM = 0.5;
/** Share of a line that ragged wrapping reliably fills. */
const LINE_FILL = 0.9;
const TITLE_SIZES = [76, 68, 58] as const;
const TITLE_SMALLEST = 50;
const SITE_TITLE = 96;

const length = (text: string) => Array.from(text).length;

function estimatedLines(text: string, fontSize: number, em: number): number {
  const perLine = (CONTENT_WIDTH * LINE_FILL) / (fontSize * em);
  return Math.max(1, Math.ceil(length(text) / perLine));
}

export type CardLayoutText = {
  title: string;
  kicker?: string;
  stat?: string;
  section?: string;
};

/** Category and figure live outside the title area; only the kicker shares it. */
function titleBudget({ kicker }: CardLayoutText): number {
  const { kicker: k } = BODY;
  const kickerLines = kicker
    ? Math.min(k.lines, estimatedLines(kicker, k.fontSize, KICKER_EM))
    : 0;
  return (
    BODY.height -
    (kicker ? k.gap + kickerLines * k.fontSize * k.leading : 0)
  );
}

/**
 * The title's size: the largest that keeps it to two lines, then three lines
 * at 58px when the rest of the card leaves room, else the smallest size.
 */
export function titleSize(text: CardLayoutText, site = false): number {
  if (site) return SITE_TITLE;
  if (estimatedLines(text.title, SITE_TITLE, TITLE_EM) === 1) return SITE_TITLE;
  const two = TITLE_SIZES.find((s) => estimatedLines(text.title, s, TITLE_EM) <= 2);
  if (two) return two;
  const three = TITLE_SIZES[TITLE_SIZES.length - 1];
  const fits =
    estimatedLines(text.title, three, TITLE_EM) <= TITLE_MAX_LINES &&
    TITLE_MAX_LINES * three * TITLE_LEADING <= titleBudget(text);
  return fits ? three : TITLE_SMALLEST;
}

/** A title with ordinary wrapping and a fixed vertical budget. */
export function titleBlock(
  fontSize: number,
  leading: number,
  maxLines: number,
): CSSProperties {
  return {
    display: "block",
    wordBreak: "break-word",
    maxHeight: Math.ceil(fontSize * leading * maxLines),
    overflow: "hidden",
  };
}

/** A block of text clamped to `lines` with an ellipsis. */
export function clampedBlock(lines: number): CSSProperties {
  return { display: "block", lineClamp: lines, wordBreak: "break-word" };
}

const NBSP = " ";

/**
 * Typographic punctuation with glyphs the card fonts carry: curly apostrophes
 * and quotes. Cards never draw a dash: a dash between two numbers or words
 * with no spaces ("2016–2020") becomes a hyphen, and any other dash or a
 * spaced hyphen becomes the site's middle dot, kept on the line before it
 * ("Ziggurat 3.0 · Network…", never "Ziggurat 3.0 -").
 */
export function typeset(text: string): string {
  return (
    text
      .replace(/(?<=[\p{N}])[–—](?=[\p{L}\p{N}])/gu, "-")
      .replace(/\s*[–—]\s*| - /g, `${NBSP}· `)
      // After a letter or digit a quote is an apostrophe or a closing quote.
      .replace(/(?<=[\p{L}\p{N}.,!?])'/gu, "’")
      .replace(/'/g, "‘")
      .replace(/(^|[\s([‘])"/gu, "$1“")
      .replace(/"/g, "”")
  );
}
