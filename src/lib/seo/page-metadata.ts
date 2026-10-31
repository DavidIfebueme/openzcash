import type { Metadata } from "next";
import { APPS, placeOf } from "@/lib/design-routes";
import {
  CARD_LIMITS,
  CARD_SIZE,
  cardImagePath,
  cleanCardText,
  type CardText,
} from "./card-params";

/**
 * Link previews. Next replaces a parent's `openGraph` wholesale when a page
 * sets its own, and a page that sets none inherits the parent's, title
 * included. So the root layout carries only site-wide fields (no title), and
 * every public page builds its complete block here: its own og:title,
 * og:description, og:url and a 1200×630 card from the /og route.
 */

export const SITE_URL = "https://openzcash.org";
export const SITE_NAME = "OpenZcash";
export const SITE_LOCALE = "en_US";
/** How the site introduces itself when a link to the home is shared. */
export const SITE_SHARE_TITLE = `${SITE_NAME} · Zcash funding, in the open`;
export const SITE_DESCRIPTION =
  "Public transparency for the Zcash Dev Fund: ZCG and FPF grant accounting, the live Lockbox, and governance, read-only and mirrored from the official sources.";

const TITLE_SUFFIX = ` · ${SITE_NAME}`;

/** Chat apps and search results cut descriptions longer than this. */
export const DESCRIPTION_LIMIT = 200;

export type PageCard = {
  /** Large text on the card; defaults to the share title minus its app. */
  title?: string;
  /**
   * One short line under the title; defaults only to the app's one-liner on
   * its landing page. Page descriptions stay in the link's text metadata.
   */
  kicker?: string;
  /** A headline figure, shown in gold; only static, source-backed values. */
  stat?: string;
  /** Eyebrow above the title; defaults to the app the route belongs to, null hides it. */
  section?: string | null;
};

export type PageMetadataInput = {
  /** The document title, kept exactly as the page had it. */
  title: string;
  /** Shared as og:description; at most DESCRIPTION_LIMIT characters. */
  description?: string;
  /**
   * og:title, when the document title minus " · OpenZcash" reads badly in a
   * chat ("Grants ZCG" shares as "Grants · ZCG").
   */
  shareTitle?: string;
  /**
   * Canonical path of the page, for og:url. A detail page includes its query
   * (/zcg/grant?g=…) only once the record it names has been found.
   */
  path?: string;
  card?: PageCard;
};

type CardImage = {
  url: string;
  width: number;
  height: number;
  alt: string;
  type: "image/png";
};

function cardImage(card: CardText | null, alt: string): CardImage {
  return { url: cardImagePath(card), ...CARD_SIZE, alt, type: "image/png" };
}

/** og:site_name already says OpenZcash, so the shared title drops it. */
export function shareTitle(title: string): string {
  return title.endsWith(TITLE_SUFFIX)
    ? title.slice(0, -TITLE_SUFFIX.length)
    : title;
}

function appOf(path: string | undefined) {
  if (!path) return undefined;
  const pathname = path.split("?")[0];
  const place = placeOf(pathname);
  if (place) return place;
  const first = `/${pathname.split("/")[1] ?? ""}`;
  const app = APPS.find((a) => a.href === first);
  return app ? { app, page: undefined } : undefined;
}

/** The app a route belongs to, as the sidebar names it. */
export function sectionOf(path: string | undefined): string | undefined {
  return appOf(path)?.app.label;
}

const mentions = (text: string, name: string) =>
  text.toLowerCase().includes(name.toLowerCase());

/** "Decisions · ZCG" reads as "Decisions" under a ZCG eyebrow. */
function withoutSection(title: string, section: string | undefined): string {
  const suffix = section ? ` · ${section}` : "";
  return suffix && title.endsWith(suffix) && title.length > suffix.length
    ? title.slice(0, -suffix.length)
    : title;
}

const length = (text: string) => Array.from(text).length;
const SENTENCE_END = /(?<=[.!?])\s+(?=[A-Z0-9"“‘'])/u;
// A colon, semicolon or spaced dash ends a clause more cleanly than a comma.
const CLAUSE_BREAKS = [/[:;]\s|\s[—–]\s/gu, /,\s/gu];
/** A clause shorter than this says too little to stand alone on a card. */
const MIN_LEAD = 30;

/** True when every parenthesis or bracket opened in the text is closed. */
const balanced = (text: string) =>
  (text.match(/[([]/g)?.length ?? 0) === (text.match(/[)\]]/g)?.length ?? 0);

/**
 * The start of a description, as a card kicker: its first sentence (with the
 * next one when it is too short to stand alone) when that fits, else its
 * first clause long enough to stand alone and not inside parentheses, else
 * the sentence cut at a word boundary.
 */
export function descriptionLead(
  description: string | undefined,
  max: number = CARD_LIMITS.kicker,
): string | undefined {
  const [first = "", ...rest] = description?.trim().split(SENTENCE_END) ?? [];
  const lead = rest
    .reduce(
      (text, next) => (length(text) < MIN_LEAD ? `${text} ${next}` : text),
      first,
    )
    .replace(/\.$/, "");
  if (!lead) return undefined;
  if (length(lead) <= max) return lead;
  for (const pattern of CLAUSE_BREAKS) {
    for (const match of lead.matchAll(pattern)) {
      const head = lead.slice(0, match.index).trim();
      if (length(head) > max) break;
      if (length(head) >= MIN_LEAD && balanced(head)) return head;
    }
  }
  return cleanCardText(lead, max);
}

function cardFor(input: PageMetadataInput, ogTitle: string): CardText {
  const place = appOf(input.path);
  const section =
    input.card?.section === null
      ? undefined
      : (input.card?.section ?? place?.app.label);
  const title = input.card?.title ?? withoutSection(ogTitle, section);
  // An app's landing page borrows the sidebar's one-liner and its block-reward share.
  const landing =
    place && !place.page && input.path === place.app.href ? place.app : undefined;
  const kicker = input.card?.kicker ?? landing?.sub;
  return {
    title,
    kicker: kicker === title ? undefined : kicker,
    stat: input.card?.stat ?? landing?.share?.label,
    section: section && !mentions(title, section) ? section : undefined,
  };
}

/**
 * Fails loudly outside production when a description is too long to share
 * whole; production never breaks a page over it.
 */
function checkDescription(description: string | undefined): void {
  if (!description || process.env.NODE_ENV === "production") return;
  const chars = length(description);
  if (chars > DESCRIPTION_LIMIT) {
    throw new Error(
      `Share description is ${chars} characters, over ${DESCRIPTION_LIMIT}: "${description.slice(0, 60)}…"`,
    );
  }
}

/** Title, description and the complete share block for one public page. */
export function pageMetadata(input: PageMetadataInput): Metadata {
  checkDescription(input.description);
  const ogTitle = input.shareTitle ?? shareTitle(input.title);
  const description = input.description
    ? { description: input.description }
    : {};
  const image = cardImage(cardFor(input, ogTitle), ogTitle);
  return {
    title: input.title,
    ...description,
    openGraph: {
      title: ogTitle,
      ...description,
      siteName: SITE_NAME,
      type: "website",
      locale: SITE_LOCALE,
      ...(input.path ? { url: input.path } : {}),
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      ...description,
      images: [image],
    },
  };
}

/**
 * The home (the root redirects here) keeps its document title but shares as
 * the site: a link to openzcash.org previews as OpenZcash, not as one app.
 */
export function homeMetadata({
  title,
  path,
}: {
  title: string;
  path: string;
}): Metadata {
  const image = cardImage(null, SITE_SHARE_TITLE);
  return {
    title,
    description: SITE_DESCRIPTION,
    openGraph: {
      title: SITE_SHARE_TITLE,
      description: SITE_DESCRIPTION,
      siteName: SITE_NAME,
      type: "website",
      locale: SITE_LOCALE,
      url: path,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_SHARE_TITLE,
      description: SITE_DESCRIPTION,
      images: [image],
    },
  };
}

/**
 * Site-wide share fields for the root layout. No title or description: a page
 * without its own block fills og:title from its own document title.
 */
export function rootShareMetadata(): Pick<
  Metadata,
  "metadataBase" | "openGraph" | "twitter"
> {
  const image = cardImage(null, SITE_SHARE_TITLE);
  return {
    metadataBase: new URL(SITE_URL),
    openGraph: {
      siteName: SITE_NAME,
      type: "website",
      locale: SITE_LOCALE,
      images: [image],
    },
    twitter: { card: "summary_large_image", images: [image] },
  };
}
