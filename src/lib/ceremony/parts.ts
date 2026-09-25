/**
 * The Zcash Ceremony app opens in five parts. One list feeds the sidebar,
 * the overview and the previous/next links at the foot of every part.
 */
export type CeremonyPart = {
  numeral: "I" | "II" | "III" | "IV" | "V";
  slug: string;
  href: string;
  title: string;
  /** Sidebar label, short enough not to truncate. */
  short: string;
  mark: string;
  summary: string;
  meta: string;
};

export const CEREMONY_HREF = "/ceremony";

export const PARTS: CeremonyPart[] = [
  {
    numeral: "I",
    slug: "road",
    href: "/ceremony/road",
    title: "The road to Zcash",
    short: "I · The road",
    mark: "/logos/glyphs/road.png",
    summary:
      "From Chaum's blind signatures and the cypherpunks to Zerocash: the forty years before the genesis block.",
    meta: "1982 to 2016 · 6 chapters",
  },
  {
    numeral: "II",
    slug: "people",
    href: "/ceremony/people",
    title: "The people",
    short: "II · The people",
    mark: "/logos/glyphs/people.png",
    summary:
      "The six witnesses and their pseudonyms, the authors of Zerocoin and Zerocash, and the lineage behind them.",
    meta: "23 people",
  },
  {
    numeral: "III",
    slug: "watch",
    href: "/ceremony/watch",
    title: "Watch the ceremony",
    short: "III · Watch",
    mark: "/logos/glyphs/watch.png",
    summary:
      "The Denver station in seven parts: three cameras and three microphones, kept in step, or just the sound.",
    meta: "71 min · 3 cameras · 3 microphones",
  },
  {
    numeral: "IV",
    slug: "record",
    href: "/ceremony/record",
    title: "The record",
    short: "IV · The record",
    mark: "/logos/glyphs/record.png",
    summary:
      "Everything the witnesses published: footage, transcript, keys, disc images and the Radiolab story, each with licence and source.",
    meta: "8 records",
  },
  {
    numeral: "V",
    slug: "ten-years",
    href: "/ceremony/ten-years",
    title: "Ten years",
    short: "V · Ten years",
    mark: "/logos/glyphs/ten-years.png",
    summary:
      "From the genesis block to NU5, which ended the need for any ceremony, and on to the tenth anniversary.",
    meta: "2016 to 2026",
  },
];

/** The part before and after `slug`; the overview comes before part I. */
export function neighbours(slug: string): {
  prev: { href: string; label: string } | null;
  next: { href: string; label: string } | null;
} {
  const i = PARTS.findIndex((p) => p.slug === slug);
  const label = (p: CeremonyPart) => `${p.numeral} · ${p.title}`;
  return {
    prev:
      i > 0
        ? { href: PARTS[i - 1].href, label: label(PARTS[i - 1]) }
        : { href: CEREMONY_HREF, label: "Overview" },
    next:
      i >= 0 && i < PARTS.length - 1
        ? { href: PARTS[i + 1].href, label: label(PARTS[i + 1]) }
        : null,
  };
}
