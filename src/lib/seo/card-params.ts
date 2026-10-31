/**
 * The contract between a page's metadata and the share-card image route
 * (/og): which query parameters carry which text, and how long each may be.
 * Both sides clean the text the same way, so a hand-written URL can never ask
 * the renderer for more than a page could.
 */

export const CARD_ROUTE = "/og";

/** Bumped when the card design changes, so chat apps fetch the new image. */
export const CARD_VERSION = "3";

export const CARD_SIZE = { width: 1200, height: 630 } as const;

/**
 * Characters (code points) per field. The kicker is cut at a word boundary
 * here, before the renderer's two-line clamp could cut it mid-word.
 */
export const CARD_LIMITS = {
  title: 90,
  kicker: 100,
  section: 40,
  stat: 48,
} as const;

export type CardText = {
  title: string;
  kicker?: string;
  stat?: string;
  section?: string;
};

const PARAM = { title: "t", kicker: "k", stat: "n", section: "s" } as const;

/**
 * What the card fonts can draw: the Windows-1252 repertoire that the Latin
 * subsets of Inter and Geist cover (Basic Latin, Latin-1, curly quotes,
 * dashes, bullet, ellipsis, euro, trade mark) plus the minus sign. Anything
 * else would make the renderer fetch fonts or emoji from the network at
 * request time, so it never reaches it.
 */
const DRAWABLE =
  /[ -~ -¬®-ÿıŒœˆ˜–—‘-‚“-„†-•…‰‹›€™−]/u;

/** Letters that do not decompose to a Latin base letter, and dash variants. */
const TRANSLITERATION: Record<string, string> = {
  "Đ": "D",
  "đ": "d",
  "Ħ": "H",
  "ħ": "h",
  "Ł": "L",
  "ł": "l",
  "Ŋ": "N",
  "ŋ": "n",
  "Ŧ": "T",
  "ŧ": "t",
  "‐": "-",
  "‑": "-",
  "‒": "–",
  "―": "—",
};

// C0 and C1 control characters, DEL included, become spaces.
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;
const COMBINING_MARK = /\p{M}/gu;
const TRAILING_PUNCTUATION = /[\s,;:·—–-]+$/u;

/**
 * One character as the card can draw it: kept, transliterated ("ł" → "l"),
 * reduced to its base letter ("ő" → "o"), or dropped (scripts the fonts do
 * not cover, emoji, symbols, and invisible or bidi-control characters).
 */
function drawable(char: string): string {
  if (/\s/u.test(char)) return " ";
  if (DRAWABLE.test(char)) return char;
  const mapped = TRANSLITERATION[char];
  if (mapped) return mapped;
  const base = char.normalize("NFKD").replace(COMBINING_MARK, "");
  return Array.from(base).every((c) => DRAWABLE.test(c)) ? base : "";
}

/** Single-line, trimmed, drawable, capped text; undefined when nothing is left. */
export function cleanCardText(raw: unknown, max: number): string | undefined {
  if (typeof raw !== "string") return undefined;
  const text = Array.from(raw.normalize("NFC").replace(CONTROL, " "))
    .map(drawable)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return undefined;
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  const cut = chars.slice(0, max - 1).join("");
  const space = cut.lastIndexOf(" ");
  const head = space > cut.length * 0.6 ? cut.slice(0, space) : cut;
  return `${head.replace(TRAILING_PUNCTUATION, "")}…`;
}

/** Keep each label in one place, including older or manually composed card URLs. */
export function distinctCardText(card: CardText): CardText {
  const key = (text: string) => text.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim().replace(/[.!?]+$/u, "");
  const seen = new Set([key(card.title), "openzcash"]);
  const result: CardText = { title: card.title };
  for (const field of ["section", "stat", "kicker"] as const) {
    const value = card[field];
    if (!value) continue;
    const normalized = key(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result[field] = value;
  }
  return result;
}

/** Relative URL of a page's card; `null` is the site card. */
export function cardImagePath(card: CardText | null): string {
  const text = card ? distinctCardText(card) : null;
  const fields = text
    ? (["title", "kicker", "stat", "section"] as const).flatMap((key) => {
        const value = cleanCardText(text[key], CARD_LIMITS[key]);
        return value ? [[PARAM[key], value]] : [];
      })
    : [];
  const query = new URLSearchParams([...fields, ["v", CARD_VERSION]]);
  return `${CARD_ROUTE}?${query.toString()}`;
}

/** The card a request asks for; `null` (no title) renders the site card. */
export function readCardParams(params: URLSearchParams): CardText | null {
  const read = (key: keyof CardText) =>
    cleanCardText(params.get(PARAM[key]), CARD_LIMITS[key]);
  const title = read("title");
  if (!title) return null;
  const optional = (["kicker", "stat", "section"] as const).flatMap((key) => {
    const value = read(key);
    return value ? [[key, value] as const] : [];
  });
  return distinctCardText({ title, ...Object.fromEntries(optional) });
}
