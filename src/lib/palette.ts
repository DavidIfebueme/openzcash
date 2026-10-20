/**
 * The ⌘K palette as data: which rows it lists for a query, in which groups
 * and in which order. The component only draws the result and moves the
 * highlight, so the rules are tested here without a browser.
 */
import {
  overviewEntry,
  paletteEntries,
  type AppDef,
} from "@/lib/design-routes";

export type PaletteRow = {
  href: string;
  label: string;
  /** PNG glyph of an inner page. */
  mark?: string;
  /** Apps without inner pages are one row that carries the app's own mark. */
  app?: AppDef;
  /** The Ask Zarvis row: the question it hands to the chat draft. */
  ask?: string;
};

export type PaletteGroup = {
  id: string;
  label: string;
  /** The app the group lists; absent for the shared groups. */
  app?: AppDef;
  rows: PaletteRow[];
};

export type Palette = {
  groups: PaletteGroup[];
  /** A query was typed and no page answers it. */
  noMatch: boolean;
};

export type PaletteStep = "ArrowDown" | "ArrowUp" | "Home" | "End";

const SINGLES_GROUP = { id: "apps", label: "Apps" };
const ASK_GROUP = { id: "ask", label: "Zarvis" };
const ASK_HREF = "/zarvis";

/**
 * How well a row answers the query, best first. A match at the start of a
 * word always beats letters found inside one ("ver" is Verify, not Overview).
 */
const RANK = {
  exact: 0,
  nameStart: 1,
  nameWord: 2,
  appWord: 3,
  aboutWord: 4,
  nameInside: 5,
  appInside: 6,
  aboutInside: 7,
} as const;
/** Ranks up to this one are matches at the start of a word. */
const LAST_WORD_RANK = RANK.aboutWord;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

type Scored = { row: PaletteRow; rank: number };

/** Lower case, no accents, no surrounding spaces: how the palette compares text. */
export function foldText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** The token occurs in the text right where a word begins. */
function startsWord(text: string, token: string): boolean {
  for (
    let at = text.indexOf(token);
    at !== -1;
    at = text.indexOf(token, at + 1)
  ) {
    if (at === 0 || !LETTER_OR_DIGIT.test(text[at - 1])) return true;
  }
  return false;
}

function rowsOf(app: AppDef): PaletteRow[] {
  if (!app.pages.length) return [{ href: app.href, label: app.label, app }];
  const marks = new Map(app.pages.map((p) => [p.href, p.mark]));
  const overview = overviewEntry(app);
  return paletteEntries(app).map((entry) => {
    const mark =
      entry.href === overview?.href ? overview.mark : marks.get(entry.href);
    return mark
      ? { href: entry.href, label: entry.label, mark }
      : { href: entry.href, label: entry.label };
  });
}

/** How one word of the query finds a row: in its names, its app's name or its app's description. */
function tokenRank(
  token: string,
  names: string[],
  appName: string,
  about: string,
): number {
  if (names.some((name) => name.startsWith(token))) return RANK.nameStart;
  if (names.some((name) => startsWord(name, token))) return RANK.nameWord;
  if (startsWord(appName, token)) return RANK.appWord;
  if (startsWord(about, token)) return RANK.aboutWord;
  if (names.some((name) => name.includes(token))) return RANK.nameInside;
  if (appName.includes(token)) return RANK.appInside;
  return about.includes(token) ? RANK.aboutInside : Infinity;
}

/**
 * The rows of an app that answer every word of the query, each with its rank.
 * The app's landing row (its Overview) also answers to the app's own name, so
 * typing the name opens the app. The description speaks for the app, not for
 * each page: a query found only there lists the landing row alone.
 */
function answering(app: AppDef, tokens: string[]): Scored[] {
  const rows = rowsOf(app);
  if (!tokens.length) return rows.map((row) => ({ row, rank: RANK.exact }));
  const needle = tokens.join(" ");
  const appName = foldText(app.label);
  const about = foldText(app.sub);
  const landing = rows.find((row) => row.href === app.href) ?? rows[0];
  return rows.flatMap((row) => {
    const label = foldText(row.label);
    const names = row.href === app.href ? [label, appName] : [label];
    const ranks = tokens.map((token) =>
      tokenRank(token, names, appName, about),
    );
    const worst = Math.max(...ranks);
    if (worst === Infinity) return [];
    if (names.includes(needle)) return [{ row, rank: RANK.exact }];
    // Every word starts a word somewhere: the best one says how close the row is.
    const rank = worst <= LAST_WORD_RANK ? Math.min(...ranks) : worst;
    const aboutOnly = ranks.every(
      (found) => found === RANK.aboutWord || found === RANK.aboutInside,
    );
    return aboutOnly && row !== landing ? [] : [{ row, rank }];
  });
}

/** Best rows first; equally ranked rows keep the order they were listed in. */
function byRank(scored: Scored[]): PaletteRow[] {
  return [...scored].sort((a, b) => a.rank - b.rank).map((item) => item.row);
}

/**
 * The list for a query. Apps without inner pages share one group; every other
 * app is a group of its own. With no query the groups follow the sidebar.
 * With one, the group holding the best match comes first (sidebar order
 * breaks ties), so Enter opens what the query names. Letters found only
 * inside a word are listed when nothing starts with the query. With text in
 * the box and the chat available, a last group offers to hand the question
 * to Zarvis.
 */
export function buildPalette(
  apps: AppDef[],
  query: string,
  canAsk: boolean,
  additionalGroups: PaletteGroup[] = [],
): Palette {
  const question = query.trim();
  const tokens = foldText(question).split(/\s+/).filter(Boolean);

  const singles = apps
    .filter((app) => !app.pages.length)
    .flatMap((app) => answering(app, tokens));
  const candidates = [
    { ...SINGLES_GROUP, scored: singles },
    ...apps
      .filter((app) => app.pages.length)
      .map((app) => ({
        id: app.id,
        label: app.label,
        app,
        scored: answering(app, tokens),
      })),
  ];
  const startsAWord = candidates.some((group) =>
    group.scored.some((item) => item.rank <= LAST_WORD_RANK),
  );
  const pageGroups: PaletteGroup[] = candidates
    .map(({ scored, ...group }) => {
      const kept = startsAWord
        ? scored.filter((item) => item.rank <= LAST_WORD_RANK)
        : scored;
      return {
        group: { ...group, rows: byRank(kept) },
        best: Math.min(...kept.map((item) => item.rank)),
      };
    })
    .filter(({ group }) => group.rows.length > 0)
    .sort((a, b) => a.best - b.best)
    .map(({ group }) => group);

  const askGroup: PaletteGroup[] =
    question && canAsk
      ? [
          {
            ...ASK_GROUP,
            rows: [
              {
                href: ASK_HREF,
                label: `Ask Zarvis: “${question}”`,
                ask: question,
              },
            ],
          },
        ]
      : [];

  return {
    groups: [...pageGroups, ...additionalGroups, ...askGroup],
    noMatch: question !== "" && pageGroups.length === 0 && additionalGroups.length === 0,
  };
}

/** Every row in reading order: what the arrow keys walk through. */
export function paletteRows(groups: PaletteGroup[]): PaletteRow[] {
  return groups.flatMap((group) => group.rows);
}

/** The highlighted row after a navigation key, wrapping at both ends. */
export function stepActive(
  index: number,
  count: number,
  key: PaletteStep,
): number {
  if (count <= 0) return 0;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  const delta = key === "ArrowDown" ? 1 : -1;
  return (index + delta + count) % count;
}
