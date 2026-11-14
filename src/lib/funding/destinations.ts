import type { Link } from "./streams";

/**
 * Where each slice went after the coinbase, in the words of its primary
 * sources (research record of 2026-09-24). Only what a source states is kept;
 * open questions are listed as such, never filled in.
 */

/** The Founders' Reward split as announced on 2016-09-23, in % of the 21M supply. */
export const FOUNDERS_SPLIT_2016: {
  recipient: string;
  pctOfSupply: number;
  schedule: string;
  /** What a later primary source adds for this recipient. */
  detail?: string;
}[] = [
  {
    recipient: "Investors",
    pctOfSupply: 1.65,
    schedule: "over the first year of mining",
  },
  {
    recipient: "Founders, employees and advisors",
    pctOfSupply: 5.72,
    schedule: "over four years",
  },
  {
    recipient: "Zcash Company strategic reserve",
    pctOfSupply: 1.19,
    schedule: "over four years",
  },
  {
    recipient: "Zcash Foundation, by donation",
    pctOfSupply: 1.44,
    schedule: "over four years",
    detail:
      "Pledged 273,000 ZEC in 2017; 87,000 ZEC received by January 2019.",
  },
];

export const MAX_SUPPLY_ZEC = 21_000_000;

export const FOUNDERS_SOURCES: Link[] = [
  {
    label: "Continued funding and transparency, 2016",
    href: "https://github.com/zodl-inc/zcash-blog/blob/master/_posts/2016-09-23-continued-funding-and-transparency.md",
  },
  {
    label: "Announcing the Zcash Foundation, 2017",
    href: "https://github.com/zodl-inc/zcash-blog/blob/master/_posts/2017-03-17-announcing-the-zcash-foundation.md",
  },
  {
    label: "State of the Zcash Foundation, 2019",
    href: "https://zfnd.org/the-state-of-the-zcash-foundation-in-2019/",
  },
  {
    label: "ECC Q3 2019 report, forum copy",
    href: "https://forum.zcashcommunity.com/t/34799/1",
  },
];

export const DEV_FUND_2020_SOURCES: Link[] = [
  {
    label: "ECC transparency report, Q4 2024",
    href: "https://electriccoin.co/wp-content/uploads/2025/07/Transparency-Report-June-2025.pdf",
  },
  {
    label: "Zcash Foundation financial transparency",
    href: "https://zfnd.org/financial-transparency/",
  },
  { label: "ZIP 1014", href: "https://zips.z.cash/zip-1014" },
];

export const COINHOLDER_FUND = {
  address: "t3ev37Q2uL1sfTsiJQJiWJoFzQpDhmnUwYo",
  keyHolders: ["Zcash Foundation", "Electric Coin Company", "Shielded Labs"],
  sources: [
    { label: "ZIP 271", href: "https://zips.z.cash/zip-0271" },
    {
      label: "Q4 2025 round results",
      href: "https://forum.zcashcommunity.com/t/coinholder-directed-retroactive-grants-program-results-nov-2025/53487",
    },
    {
      label: "Key-holders' statement on the ECC grant",
      href: "https://forum.zcashcommunity.com/t/statement-on-the-bootstrap-ecc-q4-2025-retroactive-grant/54988",
    },
    {
      label: "Bootstrap board, Feb 2026",
      href: "https://forum.zcashcommunity.com/t/a-message-from-the-bootstrap-board/54329/36",
    },
  ] satisfies Link[],
};

export const NU7_FUNDING_RULES: Link = {
  label: "ZIP 214 · revision 3, deployed with NU7",
  href: "https://zips.z.cash/zip-0214",
};

export const KEYHOLDER_DRAFT: Link = {
  label: "Draft ZIP on key-holder organizations",
  href: "https://github.com/zcash/zips/blob/main/draft-mcgee-keyholders-organizations.md",
};

/**
 * What the research of 2026-09-24 could not settle from a primary source.
 * Shown as open, never estimated.
 */
export const OPEN_QUESTIONS = {
  founders:
    "The split after June 2019: ECC's August 2019 statement is offline and secondary sources disagree. Also what the Foundation finally received.",
  devfund2020:
    "How much Major Grants money the Foundation moved to FPF after NU6, and in which transactions.",
  nu6: "Which organization holds which key, and the agreement that binds the key-holders.",
} as const;
