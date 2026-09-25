/**
 * The people of the Zcash Ceremony pages. Witnesses and pseudonyms come from
 * Zooko Wilcox's "The Design of the Ceremony" (Oct 26, 2016); the last
 * pseudonym was revealed by Zcash Media in April 2022.
 */
export type Link = { label: string; href: string };

export type Witness = {
  name: string;
  /** The pseudonym used during the ceremony, when there was one. */
  knownAs: string | null;
  role: string;
  /** When the identity became public. */
  public: string;
  sources: Link[];
};

export const DESIGN_OF_THE_CEREMONY: Link = {
  label: "The Design of the Ceremony, Oct 26, 2016",
  href: "https://github.com/zodl-inc/zcash-blog/blob/master/_posts/2016-10-26-the-design-of-the-ceremony.md",
};

export const WITNESSES: Witness[] = [
  {
    name: "Zooko Wilcox",
    knownAs: null,
    role: "Ran the Denver station",
    public: "From the start",
    sources: [DESIGN_OF_THE_CEREMONY],
  },
  {
    name: "Andrew Miller",
    knownAs: null,
    role: "Computer scientist and Zcash technical advisor",
    public: "From the start",
    sources: [DESIGN_OF_THE_CEREMONY],
  },
  {
    name: "Peter Van Valkenburgh",
    knownAs: null,
    role: "Coin Center",
    public: "From the start",
    sources: [DESIGN_OF_THE_CEREMONY],
  },
  {
    name: "Peter Todd",
    knownAs: "Fabrice Renault",
    role: "Bitcoin Core developer; ran his station on the Cypherpunk Desert Bus",
    public: "October 2016, in his own post",
    sources: [
      {
        label: "Peter Todd's post, Oct 2016",
        href: "https://twitter.com/petertoddbtc/status/791495928108625921",
      },
      DESIGN_OF_THE_CEREMONY,
    ],
  },
  {
    name: "Derek Hinch",
    knownAs: "Moses Spears",
    role: "NCC Group, secretly hired as a compute node",
    public: "October 23, 2016",
    sources: [DESIGN_OF_THE_CEREMONY],
  },
  {
    name: "Edward Snowden",
    knownAs: "John Dobbertin",
    role: "Whistleblower and privacy advocate, pseudonymous until 2022",
    public: "April 2022, Zcash Media",
    sources: [
      {
        label: "Community forum, April 2022",
        href: "https://forum.zcashcommunity.com/t/edward-snowden-revealed-as-john-dobbertin/41388",
      },
      {
        label: "Forbes, Apr 27, 2022",
        href: "https://www.forbes.com/sites/michaeldelcastillo/2022/04/27/edward-snowden-revealed-as-key-participant-in-mysterious-ceremony-creating-2-billion-anonymous-cryptocurrency/",
      },
    ],
  },
];

export const OBSERVER: Witness = {
  name: "Morgen Peck",
  knownAs: null,
  role: "Journalist invited to observe the Denver station",
  public: "Her report, December 2016",
  sources: [
    {
      label: "IEEE Spectrum, the inside story",
      href: "https://spectrum.ieee.org/the-crazy-security-behind-the-birth-of-zcash",
    },
  ],
};

export const PAPERS: Record<"Zerocoin" | "Zerocash", Link> = {
  Zerocoin: {
    label: "Zerocoin, IEEE S&P 2013",
    href: "https://doi.org/10.1109/SP.2013.34",
  },
  Zerocash: {
    label: "Zerocash, IEEE S&P 2014",
    href: "https://eprint.iacr.org/2014/349",
  },
};

export const AUTHORS: { name: string; papers: ("Zerocoin" | "Zerocash")[] }[] =
  [
    { name: "Eli Ben-Sasson", papers: ["Zerocash"] },
    { name: "Alessandro Chiesa", papers: ["Zerocash"] },
    { name: "Christina Garman", papers: ["Zerocoin", "Zerocash"] },
    { name: "Matthew Green", papers: ["Zerocoin", "Zerocash"] },
    { name: "Ian Miers", papers: ["Zerocoin", "Zerocash"] },
    { name: "Aviel D. Rubin", papers: ["Zerocoin"] },
    { name: "Eran Tromer", papers: ["Zerocash"] },
    { name: "Madars Virza", papers: ["Zerocash"] },
  ];

/** The lineage told in Part I; each links to its chapter there. */
export const LINEAGE: { name: string; note: string; chapter: string }[] = [
  {
    name: "David Chaum",
    note: "Blind signatures, 1982; DigiCash",
    chapter: "untraceable-money",
  },
  {
    name: "Eric Hughes",
    note: "A Cypherpunk's Manifesto, 1993",
    chapter: "cypherpunks",
  },
  {
    name: "Tim May",
    note: "The cypherpunks mailing list, 1992",
    chapter: "cypherpunks",
  },
  {
    name: "John Gilmore",
    note: "The cypherpunks mailing list, 1992",
    chapter: "cypherpunks",
  },
  { name: "Adam Back", note: "Hashcash, 1997", chapter: "missing-pieces" },
  { name: "Wei Dai", note: "b-money, late 1990s", chapter: "missing-pieces" },
  {
    name: "Nick Szabo",
    note: "Bit gold, late 1990s",
    chapter: "missing-pieces",
  },
  {
    name: "Hal Finney",
    note: "A zero-knowledge proof talk, 1998; RPOW, 2004; the first Bitcoin transaction",
    chapter: "missing-pieces",
  },
  {
    name: "Satoshi Nakamoto",
    note: "Bitcoin, 2008; doubted zero-knowledge proofs could fit it, 2010",
    chapter: "open-problem",
  },
  {
    name: "Daira-Emma Hopwood",
    note: "Tahoe-LAFS; first-named author of the Zcash protocol specification, 2016",
    chapter: "open-problem",
  },
];

/** Everyone named on the people page, once. */
export function uniquePeople(): string[] {
  return [
    ...new Set([
      ...WITNESSES.map((w) => w.name),
      OBSERVER.name,
      ...AUTHORS.map((a) => a.name),
      ...LINEAGE.map((l) => l.name),
    ]),
  ];
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
