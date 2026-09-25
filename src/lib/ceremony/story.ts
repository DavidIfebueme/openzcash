import type { Link } from "./people";

/**
 * Parts I and V of the Zcash Ceremony pages. The chapters come from the
 * "Zcash at 10" draft (branch zcash-at-10), checked against the original
 * papers and primary reporting. The timeline keeps only what a primary source
 * or this site's own verified records support; figures the draft could not
 * source were left out, and the Major Grants history follows the February 2022
 * rename to Zcash Community Grants.
 */

export const GENESIS = "2016-10-28";
export const TENTH_ANNIVERSARY = "2026-10-28";

/** Whole days from `now` to the start (UTC) of `dateIso`; 0 once it has come. */
export function daysUntil(dateIso: string, now: Date): number {
  const target = new Date(`${dateIso}T00:00:00Z`).getTime();
  return Math.max(0, Math.ceil((target - now.getTime()) / 86_400_000));
}

export type Chapter = {
  id: string;
  era: string;
  title: string;
  who: string;
  text: string[];
  links?: Link[];
};

export const CHAPTERS: Chapter[] = [
  {
    id: "untraceable-money",
    era: "1982",
    title: "The idea of untraceable money",
    who: "David Chaum",
    text: [
      "Long before blockchains, cryptographer David Chaum published “Blind Signatures for Untraceable Payments” (1982): a bank could sign a digital coin without seeing it, so the coin could later be spent without the bank linking it back to you. Digital cash that behaved like cash.",
      "Chaum founded DigiCash in 1989 to build it. Its eCash ran a real pilot at a US bank in 1995, but the company went bankrupt in 1998. The world was not ready, and the money still needed a bank at the center.",
      "One detail matters for this story: among the young cryptographers who worked at DigiCash was Zooko Wilcox. The company failed; the apprenticeship did not.",
    ],
  },
  {
    id: "cypherpunks",
    era: "1992",
    title: "The cypherpunks",
    who: "Hughes, May, Gilmore and a mailing list",
    text: [
      "In 1992 a mailing list formed around a simple position: privacy in the electronic age would have to be built with code, not requested from institutions. Eric Hughes opened his 1993 manifesto with the line “Privacy is necessary for an open society in the electronic age.”",
      "The list became the proving ground for everything that followed: remailers, digital cash schemes, and the culture of shipping working cryptography instead of position papers. Zcash’s founding team traces directly to this milieu.",
    ],
  },
  {
    id: "missing-pieces",
    era: "1997–2004",
    title: "The missing pieces",
    who: "Back, Dai, Szabo, Finney",
    text: [
      "Adam Back’s Hashcash (1997) made computation itself a scarce stamp. Wei Dai’s b-money and Nick Szabo’s bit gold (late 1990s) sketched money without a central issuer. Each solved a piece; none shipped as money.",
      "Hal Finney, veteran cypherpunk and PGP developer, built RPOW (2004), reusable proofs of work: the closest thing to circulating digital scarcity before Bitcoin. When Bitcoin appeared, Finney was the first person besides its creator to run it, and the recipient of the first Bitcoin transaction ever sent (January 12, 2009).",
      "Finney died in 2014. The problem he spent decades on, private electronic cash that needs no permission, is the problem Zcash exists to finish.",
    ],
  },
  {
    id: "bitcoin",
    era: "2008–2009",
    title: "Bitcoin ships, and exposes everything",
    who: "Satoshi Nakamoto",
    text: [
      "The Bitcoin whitepaper (October 31, 2008) and genesis block (January 3, 2009) solved decentralized consensus. Money finally worked without a bank.",
      "But it worked in public. Every amount, every counterparty, every balance, forever, on a ledger anyone can read. Bitcoin realized the cypherpunk dream of permissionless money while inverting its premise of privacy.",
    ],
  },
  {
    id: "zerocash",
    era: "2013–2014",
    title: "Zerocoin, then Zerocash",
    who: "Johns Hopkins, MIT, Technion, Tel Aviv",
    text: [
      "Zerocoin (2013, Miers, Garman, Green and Rubin at Johns Hopkins) proposed a cryptographic washing machine bolted onto Bitcoin. Zerocash (2014, Ben-Sasson, Chiesa, Garman, Green, Miers, Tromer and Virza) went further: a full currency where sender, receiver and amount are hidden, yet every transaction is verified.",
      "The tool that made it possible was the zk-SNARK, a succinct proof that a statement is true without revealing why. The proofs predate these papers; Zerocash was the moment they became a payment system on paper. It needed a team willing to make it real.",
    ],
    links: [
      {
        label: "Zerocoin, IEEE S&P 2013",
        href: "https://doi.org/10.1109/SP.2013.34",
      },
      {
        label: "Zerocash, IEEE S&P 2014",
        href: "https://eprint.iacr.org/2014/349",
      },
    ],
  },
  {
    id: "ceremony",
    era: "2016",
    title: "The Ceremony",
    who: "Six witnesses, air-gapped machines, one secret guest",
    text: [
      "Zcash’s original proving system required secret parameters that, if any single party kept them, could be used to counterfeit coins invisibly. So on October 22 and 23, 2016 the launch team ran a multi-party ceremony: six witnesses in separate places, air-gapped hardware, destroyed key material. If even one of them was honest, the parameters were safe.",
      "The stations were paranoia made real. Peter Todd ran his from a moving vehicle, the “Cypherpunk Desert Bus.” At the Denver station, a phone behaved strangely enough mid-ceremony that the moment became a Radiolab story. And one witness, known only as “John Dobbertin,” stayed pseudonymous for six years: in April 2022, Zcash Media revealed he was Edward Snowden.",
      "On October 28, 2016 the genesis block was mined. For a brief moment on launch week, one ZEC traded above the price of one Bitcoin. The experiment was live.",
    ],
    links: [
      {
        label: "The Design of the Ceremony",
        href: "https://github.com/zodl-inc/zcash-blog/blob/master/_posts/2016-10-26-the-design-of-the-ceremony.md",
      },
      {
        label: "Denver footage",
        href: "https://archive.org/details/ThePhoneAnomalyDuringTheZcashCeremonyDenverStation",
      },
      {
        label: "Ceremony data",
        href: "https://archive.org/details/zcashfinalmpc",
      },
      {
        label: "Desert Bus",
        href: "https://archive.org/details/cypherpunk-desert-bus-2016",
      },
      { label: "Radiolab", href: "https://radiolab.org/podcast/ceremony" },
    ],
  },
];

export type Year = {
  year: string;
  title: string;
  items: { label: string; text: string }[];
};

export const TIMELINE: Year[] = [
  {
    year: "2016",
    title: "Launch",
    items: [
      {
        label: "Oct 28 · Genesis",
        text: "Mainnet launches with Sprout shielded transactions, a 21M cap, 2.5-minute blocks and a 12.5 ZEC subsidy, ramped in over a 34-day slow start. The Founders’ Reward directs 20% of the subsidy to the founding team, investors and the Zcash Foundation for the first four years, 10% of total supply.",
      },
    ],
  },
  {
    year: "2018",
    title: "The quiet save, then Sapling",
    items: [
      {
        label: "Mar · A flaw found and fixed",
        text: "Ariel Gabizon finds a flaw in the proving system Sprout used that could have allowed invisible counterfeiting. It is fixed silently and disclosed in February 2019. No evidence of exploitation was ever found.",
      },
      {
        label: "Oct 28 · Sapling",
        text: "A redesign of shielded transactions cuts proving time and memory sharply, making shielded payments practical on phones. It ships on the network’s second birthday, on parameters from a new, larger ceremony.",
      },
    ],
  },
  {
    year: "2019",
    title: "Blossom",
    items: [
      {
        label: "Dec 11 · 75-second blocks",
        text: "Block time drops from 150 to 75 seconds and the per-block subsidy from 12.5 to 6.25 ZEC, keeping issuance per hour unchanged. It is why the first halving lands on 3.125, not 6.25.",
      },
    ],
  },
  {
    year: "2020",
    title: "First halving and the Dev Fund",
    items: [
      {
        label: "Jul · Heartwood",
        text: "Shielded coinbase: miners can receive block rewards directly into shielded addresses.",
      },
      {
        label: "Nov 18 · Canopy, the first halving",
        text: "The subsidy halves to 3.125 ZEC. The Founders’ Reward ends and ZIP 1014’s Dev Fund begins: 7% to Bootstrap (ECC), 5% to the Zcash Foundation and 8% to Major Grants, run by ZOMG and renamed Zcash Community Grants in February 2022.",
      },
    ],
  },
  {
    year: "2022",
    title: "NU5: the trusted setup ends",
    items: [
      {
        label: "May 31 · Orchard and Halo 2",
        text: "The Halo 2 proving system removes the trusted setup for the new Orchard pool, and Unified Addresses bundle transparent, Sapling and Orchard receivers into one address.",
      },
      {
        label: "Jun · Sandblasting",
        text: "A sustained spam attack bloats the chain and exposes wallet sync pain. It forces the fee overhaul of ZIP 317 and a generation of faster sync work.",
      },
    ],
  },
  {
    year: "2024",
    title: "Second halving and the lockbox",
    items: [
      {
        label: "2023–2024 · New stewards",
        text: "Zooko steps back from ECC leadership, Zashi ships as ECC’s mobile wallet, and Zebra, the Foundation’s Rust node, reaches production alongside zcashd.",
      },
      {
        label: "Nov 23 · NU6, the second halving",
        text: "The subsidy halves to 1.5625 ZEC. 8% goes to Zcash Community Grants, paid to the Financial Privacy Foundation, and 12%, 0.1875 ZEC per block, accrues in an in-protocol lockbox.",
      },
    ],
  },
  {
    year: "2025",
    title: "Coinholders take the wheel",
    items: [
      {
        label: "Nov 24 · NU6.1",
        text: "The lockbox pays its 78,750 ZEC to a coinholder-controlled fund, and the 8% and 12% streams continue to the third halving (ZIP 271, ZIP 1016). Coinholders now vote on grants from the fund; key-holders sign the payouts.",
      },
    ],
  },
  {
    year: "2026",
    title: "The Orchard emergency, then year ten",
    items: [
      {
        label: "Mar 16 · The first veto",
        text: "Two key-holders, the Zcash Foundation and Shielded Labs, veto the $2.67M Q4 2025 grant to Bootstrap (ECC). The check on coinholder votes is real.",
      },
      {
        label: "Jun 2–3 · The Orchard emergency",
        text: "A soundness flaw in the Orchard circuit is closed by an emergency soft fork at block 3,363,426 and the NU6.2 hotfix at block 3,364,600 (ZIP 257).",
      },
      {
        label: "Jul 28 · Ironwood",
        text: "NU6.3 activates at block 3,428,143 with a new shielded pool, Ironwood (ZIP 258). Orchard stops taking new funds, and balances move out into Ironwood.",
      },
      {
        label: "Sep 14 · NU7’s scope",
        text: "Coinholders set the scope of NU7: keep the halvings, reissue from February 2031, retire v4 transactions and move to 25-second blocks. 2.4M ZEC took part in the first question.",
      },
      {
        label: "Oct 28 · Ten years",
        text: "Ten years since the genesis block.",
      },
    ],
  },
];

/** Claims that keep circulating, kept honest here. */
export const CORRECTIONS: { claim: string; fact: string }[] = [
  {
    claim: "“The reward halved from 12.5 to 6.25 in 2020”",
    fact: "No. Blossom (2019) moved to 75-second blocks and 6.25 ZEC per block with unchanged hourly issuance. The 2020 halving went to 3.125, and 2024 to 1.5625.",
  },
  {
    claim: "“Zerocash created zk-SNARKs”",
    fact: "Zero-knowledge proofs date to 1985 and SNARK constructions to the early 2010s. Zerocash was the first design to turn them into a payment system; Zcash made that run in production.",
  },
  {
    claim: "“Zcash is governed by a DAO”",
    fact: "There is no Zcash DAO. Decisions run through the ZIP process, ZCAP and coinholder polls, coinholder votes on the fund (ZIP 1016) and independent organizations. The only actual DAO in the ecosystem is ZecHub’s, and it governs a community project, not the protocol.",
  },
  {
    claim: "“The Major Grants Fund funds developers”",
    fact: "That name is gone. The Major Grants slice was run by ZOMG, renamed Zcash Community Grants in February 2022; since NU6 in November 2024 its stream is paid to the Financial Privacy Foundation.",
  },
];
