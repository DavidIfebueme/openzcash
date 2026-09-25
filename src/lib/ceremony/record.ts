import type { Link } from "./people";

/**
 * Part IV: everything the ceremony left behind, where it lives and under
 * which licence. Sizes and lengths come from the Internet Archive's item
 * metadata (checked 2026-09-25); nothing here is re-hosted by OpenZcash.
 */
export type RecordItem = {
  item: string;
  contents: string;
  bytes: number | null;
  lengthS: number | null;
  licence: string;
  source: Link;
};

const IA = (id: string, label = "Internet Archive"): Link => ({
  label,
  href: `https://archive.org/details/${id}`,
});

export const RECORDS: RecordItem[] = [
  {
    item: "Denver station, three cameras",
    contents: "MP4 originals in 720p, light OGV copies",
    bytes: 4_976_814_779 + 4_978_822_904 + 4_974_715_237,
    lengthS: 4290,
    licence: "CC BY-NC 4.0",
    source: IA("ThePhoneAnomalyDuringTheZcashCeremonyDenverStation"),
  },
  {
    item: "Denver station, three microphones",
    contents: "WAV, FLAC and MP3",
    bytes: 411_921_354 + 411_921_348 + 411_921_354,
    lengthS: 4290,
    licence: "CC BY-NC 4.0",
    source: IA("ThePhoneAnomalyDuringTheZcashCeremonyDenverStation"),
  },
  {
    item: "Denver station, Vcam-long",
    contents: "The same wide shot as Camera 3, in an item of its own",
    bytes: 5_547_383_245,
    lengthS: 4292,
    licence: "Not stated",
    source: IA("ZcashCeremony_201612"),
  },
  {
    item: "Sprout MPC data",
    contents: "Transcript, proving key, R1CS, OS images and checksums",
    bytes: 8_936_037_171,
    lengthS: null,
    licence: "Not stated",
    source: IA("zcashfinalmpc"),
  },
  {
    item: "Cypherpunk Desert Bus, Peter Todd",
    contents: "Disc images and Tails",
    bytes: 3_798_946_568,
    lengthS: null,
    licence: "CC BY 3.0",
    source: IA("cypherpunk-desert-bus-2016"),
  },
  {
    item: "DC station",
    contents: "Disc images",
    bytes: 2_630_142_317,
    lengthS: null,
    licence: "Not stated",
    source: IA("ZcashParamgenDCDiscImages"),
  },
  {
    item: 'Radiolab, "The Ceremony"',
    contents: "Podcast episode, July 14, 2017",
    bytes: null,
    lengthS: 2848,
    licence: "WNYC Studios, all rights reserved",
    source: {
      label: "Radiolab",
      href: "https://radiolab.org/podcast/ceremony",
    },
  },
  {
    item: '"Zcash Ceremony", short film',
    contents: "Video by Electric Coin Company, 2017",
    bytes: null,
    lengthS: 256,
    licence: "Electric Coin Company, YouTube licence",
    source: {
      label: "YouTube",
      href: "https://www.youtube.com/watch?v=D6dY-3x3teM",
    },
  },
];

/** What followed the ceremony, in its own terms. */
export const AFTER: { date: string; title: string; text: string }[] = [
  {
    date: "Oct 28, 2016",
    title: "Genesis block",
    text: "Mainnet launches on the parameters the ceremony produced.",
  },
  {
    date: "Mar 2018",
    title: "The quiet save",
    text: "A flaw in the proving system is found and fixed in silence, then disclosed in February 2019. No exploitation was ever found.",
  },
  {
    date: "May 31, 2022",
    title: "The trusted setup ends",
    text: "NU5 brings Orchard and Halo 2, a proving system that needs no ceremony at all.",
  },
];

/** "4.98 GB" or "·". */
export const gigabytes = (bytes: number | null) =>
  bytes === null ? "·" : `${(bytes / 1e9).toFixed(2)} GB`;
